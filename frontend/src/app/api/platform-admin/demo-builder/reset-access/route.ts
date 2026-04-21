import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultLocale, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountContextForUser,
  type AccountType,
} from "@/lib/account/account-routing";
import {
  createServiceClient,
  logSecurityEventWithContext,
  parseJsonBody,
} from "@/lib/security/server";
import { sendDemoAccountProvisionEmail } from "@/lib/mailer";
import { buildDemoAccessExpiresAt } from "@/lib/platform-admin/demo-access";
import { getLocalizedAccountTypeLabel } from "@/lib/platform-admin/demo-localization";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

function isCompatError(message: string | undefined | null) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("column") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

function generateTemporaryPassword() {
  return `Rn!${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}Aa9`;
}

function normalizeAccountType(value: unknown): AccountType {
  if (value === "osgb" || value === "enterprise") return value;
  return "individual";
}

function looksLikeDemoRecord(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .includes("demo");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Giris gerekli." }, { status: 401 });
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const adminContext = await getAccountContextForUser(user.id);
  if (!adminContext.isPlatformAdmin) {
    return NextResponse.json({ error: "Bu islem icin yetkiniz yok." }, { status: 403 });
  }

  const service = createServiceClient();
  const temporaryPassword = generateTemporaryPassword();
  const demoAccessExpiresAt = buildDemoAccessExpiresAt();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  try {
    const { data: fetchedUser, error: fetchUserError } = await service.auth.admin.getUserById(
      parsed.data.userId,
    );

    if (fetchUserError || !fetchedUser.user) {
      return NextResponse.json(
        { error: fetchUserError?.message || "Demo kullanicisi bulunamadi." },
        { status: 404 },
      );
    }

    const targetUser = fetchedUser.user;
    let isDemo =
      targetUser.app_metadata?.demo_mode === true || targetUser.user_metadata?.demo_mode === true;

    const organizationId = String(
      targetUser.app_metadata?.organization_id ??
        targetUser.user_metadata?.organization_id ??
        "",
    );
    const locale = (
      targetUser.app_metadata?.preferred_locale ??
      targetUser.user_metadata?.preferred_locale ??
      defaultLocale
    ) as Locale;
    const accountType = normalizeAccountType(
      targetUser.app_metadata?.demo_account_type ??
        targetUser.user_metadata?.demo_account_type,
    );

    let organizationName =
      String(targetUser.user_metadata?.organization_name ?? "").trim() || "Demo hesap";

    if (organizationId) {
      const { data: orgRow, error: orgError } = await service
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle();

      if (orgError && !isCompatError(orgError.message)) {
        throw new Error(orgError.message);
      }

      if (orgRow?.name) {
        organizationName = orgRow.name;
      }
    }

    if (!isDemo) {
      const { data: profileRow, error: profileError } = await service
        .from("user_profiles")
        .select("full_name, email")
        .eq("auth_user_id", targetUser.id)
        .maybeSingle();

      if (profileError && !isCompatError(profileError.message)) {
        throw new Error(profileError.message);
      }

      isDemo =
        looksLikeDemoRecord(targetUser.email) ||
        looksLikeDemoRecord(organizationName) ||
        looksLikeDemoRecord(String(profileRow?.full_name ?? "")) ||
        looksLikeDemoRecord(String(profileRow?.email ?? ""));
    }

    if (!isDemo) {
      return NextResponse.json(
        { error: "Secilen kullanici demo hesabi olarak isaretli degil." },
        { status: 400 },
      );
    }

    const updateMetadata = {
      ...targetUser.user_metadata,
      must_change_password: true,
      demo_mode: true,
      demo_account_type: accountType,
      preferred_locale: locale,
      organization_name: organizationName,
      demo_access_expires_at: demoAccessExpiresAt,
      demo_access_disabled_at: null,
    };

    const { error: updateError } = await service.auth.admin.updateUserById(targetUser.id, {
      password: temporaryPassword,
      user_metadata: updateMetadata,
      app_metadata: {
        ...targetUser.app_metadata,
        demo_mode: true,
        demo_account_type: accountType,
        preferred_locale: locale,
        demo_access_expires_at: demoAccessExpiresAt,
        demo_access_disabled_at: null,
      },
    });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Demo erisim bilgileri yenilenemedi." },
        { status: 500 },
      );
    }

    const delivery = await sendDemoAccountProvisionEmail({
      to: targetUser.email ?? "",
      fullName: String(targetUser.user_metadata?.full_name ?? targetUser.email ?? "Demo kullanici"),
      organizationName,
      accountTypeLabel: getLocalizedAccountTypeLabel(locale, accountType),
      locale,
      loginEmail: targetUser.email ?? "",
      temporaryPassword,
      loginUrl: `${origin}/login`,
      resetPasswordUrl: `${origin}/reset-password`,
      accessExpiresAt: demoAccessExpiresAt,
    });

    await logSecurityEventWithContext({
      eventType: "platform_admin.demo_account.access_reissued",
      endpoint: "/api/platform-admin/demo-builder/reset-access",
      userId: user.id,
      organizationId: adminContext.organizationId,
      severity: "info",
      details: {
        demo_user_id: targetUser.id,
        demo_organization_id: organizationId || null,
        demo_account_type: accountType,
        demo_locale: locale,
      },
    });

    return NextResponse.json({
      ok: true,
      demo: {
        userId: targetUser.id,
        accountType,
        locale,
        organizationName,
        loginEmail: targetUser.email ?? "",
        temporaryPassword,
        accessExpiresAt: demoAccessExpiresAt,
      },
      delivery,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Demo erisim bilgileri yenilenemedi.",
      },
      { status: 500 },
    );
  }
}
