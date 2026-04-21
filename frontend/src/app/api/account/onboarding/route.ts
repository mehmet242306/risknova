import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, parseJsonBody } from "@/lib/security/server";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
  type AccountType,
} from "@/lib/account/account-routing";

const onboardingSchema = z.object({
  accountType: z.enum(["individual", "osgb", "enterprise"]),
  displayName: z.string().trim().min(2).max(120).optional(),
  companyName: z.string().trim().min(2).max(180).optional(),
  contactName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().max(4000).optional().nullable(),
  estimatedEmployeeCount: z.number().int().positive().optional().nullable(),
  estimatedLocationCount: z.number().int().positive().optional().nullable(),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildDefaultOrganizationName(
  accountType: AccountType,
  inputName: string | undefined,
  fallbackEmail: string,
) {
  if (inputName?.trim()) return inputName.trim();
  const local = fallbackEmail.split("@")[0] || "kullanici";
  if (accountType === "osgb") return `${local} OSGB`;
  if (accountType === "enterprise") return `${local} Enterprise`;
  return `${local} Bireysel Hesabi`;
}

function buildPlanCode(accountType: AccountType) {
  if (accountType === "osgb") return "osgb_starter";
  if (accountType === "enterprise") return "enterprise";
  return "individual_free";
}

function isSchemaCompatError(message: string | undefined | null) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 });
    }

    const parsed = await parseJsonBody(request, onboardingSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const service = createServiceClient();
    const context = await getAccountContextForUser(user.id);

    if (context.isPlatformAdmin) {
      return NextResponse.json({
        ok: true,
        redirectPath: "/platform-admin",
        context,
      });
    }

    const effectiveEmail = body.email?.trim() || user.email || "";

    if (body.accountType === "enterprise") {
      const { error: leadError } = await service.from("enterprise_leads").insert({
        company_name: body.companyName || body.displayName || null,
        contact_name: body.contactName || body.displayName || user.user_metadata?.full_name || null,
        email: effectiveEmail || null,
        phone: body.phone || null,
        message: body.message || null,
        estimated_employee_count: body.estimatedEmployeeCount ?? null,
        estimated_location_count: body.estimatedLocationCount ?? null,
        status: "new",
      });

      if (leadError) {
        return NextResponse.json(
          { error: `Enterprise talebi kaydedilemedi: ${leadError.message}` },
          { status: 500 },
        );
      }

      return NextResponse.json({
        ok: true,
        redirectPath: "/enterprise",
        enterpriseLeadCreated: true,
      });
    }

    const organizationName = buildDefaultOrganizationName(
      body.accountType,
      body.displayName,
      effectiveEmail || user.id,
    );

    const planCode = buildPlanCode(body.accountType);
    const { data: plan, error: planError } = await service
      .from("plans")
      .select("id, code")
      .eq("code", planCode)
      .maybeSingle();

    const planId = !planError && plan?.id ? plan.id : null;
    const planUnavailable = !!planError || !planId;

    if (planError && !isSchemaCompatError(planError.message)) {
      return NextResponse.json(
        { error: `Varsayilan plan okunamadi: ${planError.message}` },
        { status: 500 },
      );
    }

    const { data: profile, error: profileError } = await service
      .from("user_profiles")
      .select("id, auth_user_id, organization_id, full_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: `Profil okunamadi: ${profileError.message}` },
        { status: 500 },
      );
    }

    let organizationId = profile?.organization_id ?? null;

    if (!organizationId) {
      const slugBase = slugify(organizationName) || "hesap";
      const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;

      const createPayload: Record<string, unknown> = {
        name: organizationName,
        slug,
        organization_type: body.accountType,
        account_type: body.accountType,
        status: "active",
      };
      if (planId) {
        createPayload.current_plan_id = planId;
      }

      let { data: organization, error: organizationError } = await service
        .from("organizations")
        .insert(createPayload)
        .select("id")
        .single();

      if (organizationError && isSchemaCompatError(organizationError.message)) {
        const fallbackPayload = {
          name: organizationName,
          slug,
          organization_type: body.accountType,
        };
        const fallbackResult = await service
          .from("organizations")
          .insert(fallbackPayload)
          .select("id")
          .single();
        organization = fallbackResult.data;
        organizationError = fallbackResult.error;
      }

      if (organizationError || !organization?.id) {
        return NextResponse.json(
          { error: `Hesap olusturulamadi: ${organizationError?.message || "unknown"}` },
          { status: 500 },
        );
      }

      organizationId = organization.id;

      if (profile?.id) {
        const { error: updateProfileError } = await service
          .from("user_profiles")
          .update({
            organization_id: organizationId,
            full_name: profile.full_name || body.displayName || null,
            email: effectiveEmail || null,
          })
          .eq("id", profile.id);

        if (updateProfileError) {
          return NextResponse.json(
            { error: `Profil guncellenemedi: ${updateProfileError.message}` },
            { status: 500 },
          );
        }
      } else {
        const { error: insertProfileError } = await service
          .from("user_profiles")
          .insert({
            auth_user_id: user.id,
            organization_id: organizationId,
            email: effectiveEmail || null,
            full_name: body.displayName || user.user_metadata?.full_name || null,
          });

        if (insertProfileError) {
          return NextResponse.json(
            { error: `Profil olusturulamadi: ${insertProfileError.message}` },
            { status: 500 },
          );
        }
      }
    } else {
      const updatePayload: Record<string, unknown> = {
        name: organizationName,
        organization_type: body.accountType,
        account_type: body.accountType,
        status: "active",
      };
      if (planId) {
        updatePayload.current_plan_id = planId;
      }

      let { error: organizationUpdateError } = await service
        .from("organizations")
        .update(updatePayload)
        .eq("id", organizationId);

      if (organizationUpdateError && isSchemaCompatError(organizationUpdateError.message)) {
        const fallbackUpdate = await service
          .from("organizations")
          .update({
            name: organizationName,
            organization_type: body.accountType,
          })
          .eq("id", organizationId);
        organizationUpdateError = fallbackUpdate.error;
      }

      if (organizationUpdateError) {
        return NextResponse.json(
          { error: `Hesap guncellenemedi: ${organizationUpdateError.message}` },
          { status: 500 },
        );
      }
    }

    const { error: membershipError } = await service
      .from("organization_memberships")
      .upsert(
        {
          organization_id: organizationId,
          user_id: user.id,
          role: "owner",
          status: "active",
        },
        {
          onConflict: "organization_id,user_id",
        },
      );

    if (membershipError && !isSchemaCompatError(membershipError.message)) {
      return NextResponse.json(
        { error: `Uyelik olusturulamadi: ${membershipError.message}` },
        { status: 500 },
      );
    }

    const { data: existingSubscription, error: existingSubscriptionError } =
      await service
        .from("organization_subscriptions")
        .select("id")
        .eq("organization_id", organizationId)
        .in("status", ["active", "trialing"])
        .maybeSingle();

    if (existingSubscriptionError && !isSchemaCompatError(existingSubscriptionError.message)) {
      return NextResponse.json(
        { error: `Abonelik durumu okunamadi: ${existingSubscriptionError.message}` },
        { status: 500 },
      );
    }

    if (!planUnavailable && !existingSubscription?.id) {
      const { error: subscriptionError } = await service
        .from("organization_subscriptions")
        .insert({
          organization_id: organizationId,
          plan_id: planId,
          status: "active",
        });

      if (subscriptionError && !isSchemaCompatError(subscriptionError.message)) {
        return NextResponse.json(
          { error: `Abonelik olusturulamadi: ${subscriptionError.message}` },
          { status: 500 },
        );
      }
    }

    const refreshedContext = await getAccountContextForUser(user.id);

    return NextResponse.json({
      ok: true,
      context: refreshedContext,
      redirectPath: resolvePostLoginPath(refreshedContext),
      planProvisioningDeferred: planUnavailable,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Hesap kurulumu su anda tamamlanamiyor.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
