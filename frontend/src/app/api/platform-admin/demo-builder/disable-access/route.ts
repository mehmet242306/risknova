import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAccountContextForUser } from "@/lib/account/account-routing";
import {
  createServiceClient,
  logSecurityEventWithContext,
  parseJsonBody,
} from "@/lib/security/server";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

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
    const isDemo =
      targetUser.app_metadata?.demo_mode === true ||
      targetUser.user_metadata?.demo_mode === true ||
      looksLikeDemoRecord(targetUser.email) ||
      looksLikeDemoRecord(String(targetUser.user_metadata?.organization_name ?? "")) ||
      looksLikeDemoRecord(String(targetUser.user_metadata?.full_name ?? ""));

    if (!isDemo) {
      return NextResponse.json(
        { error: "Secilen kullanici demo hesabi olarak isaretli degil." },
        { status: 400 },
      );
    }

    const disabledAt = new Date().toISOString();

    const { error: updateError } = await service.auth.admin.updateUserById(targetUser.id, {
      user_metadata: {
        ...targetUser.user_metadata,
        demo_mode: true,
        demo_access_disabled_at: disabledAt,
      },
      app_metadata: {
        ...targetUser.app_metadata,
        demo_mode: true,
        demo_access_disabled_at: disabledAt,
      },
    });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Demo erisimi engellenemedi." },
        { status: 500 },
      );
    }

    await logSecurityEventWithContext({
      eventType: "platform_admin.demo_account.access_disabled",
      endpoint: "/api/platform-admin/demo-builder/disable-access",
      userId: user.id,
      organizationId: adminContext.organizationId,
      severity: "info",
      details: {
        demo_user_id: targetUser.id,
        demo_email: targetUser.email ?? null,
        demo_access_disabled_at: disabledAt,
      },
    });

    return NextResponse.json({
      ok: true,
      demo: {
        userId: targetUser.id,
        loginEmail: targetUser.email ?? "",
        accessDisabledAt: disabledAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Demo erisimi engellenemedi.",
      },
      { status: 500 },
    );
  }
}
