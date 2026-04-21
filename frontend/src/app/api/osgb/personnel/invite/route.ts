import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountContextForUser,
  hasOsgbManagementAccess,
} from "@/lib/account/account-routing";
import { isDemoRestrictedAccount } from "@/lib/platform-admin/demo-access";
import {
  sendOsgbPersonnelInviteEmail,
  type OsgbPersonnelInvitePreview,
} from "@/lib/mailer";
import { isCompatError } from "@/lib/osgb/server";
import {
  createServiceClient,
  logSecurityEventWithContext,
  parseJsonBody,
} from "@/lib/security/server";

const bodySchema = z.object({
  fullName: z.string().trim().min(2, "Ad soyad zorunludur."),
  email: z.string().trim().email("Gecerli bir e-posta girin."),
  title: z.string().trim().max(160).optional(),
  professionalRole: z.enum([
    "isg_uzmani",
    "isyeri_hekimi",
    "diger_saglik_personeli",
    "operasyon_sorumlusu",
    "viewer",
  ]),
  companyWorkspaceId: z.string().uuid("Gecerli bir firma secin."),
});

function mapProfessionalRoleLabel(role: z.infer<typeof bodySchema>["professionalRole"]) {
  switch (role) {
    case "isg_uzmani":
      return "Is Guvenligi Uzmani";
    case "isyeri_hekimi":
      return "Isyeri Hekimi";
    case "diger_saglik_personeli":
      return "Diger Saglik Personeli";
    case "operasyon_sorumlusu":
      return "Operasyon Sorumlusu";
    default:
      return "Goruntuleyici";
  }
}

function mapLegacyRoleCode(role: z.infer<typeof bodySchema>["professionalRole"]) {
  switch (role) {
    case "isg_uzmani":
      return "ohs_specialist";
    case "isyeri_hekimi":
      return "workplace_physician";
    case "diger_saglik_personeli":
      return "dsp";
    default:
      return "viewer";
  }
}

function mapCompanyMembershipRole(role: z.infer<typeof bodySchema>["professionalRole"]) {
  switch (role) {
    case "isg_uzmani":
      return "ohs_specialist";
    case "isyeri_hekimi":
      return "workplace_physician";
    case "diger_saglik_personeli":
      return "other_health_personnel";
    case "operasyon_sorumlusu":
      return "support_staff";
    default:
      return "viewer";
  }
}

function generateTemporaryPassword() {
  return `Rn!${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}Aa9`;
}

function resolveWorkspaceOfficialName(
  workspaceRow: {
    display_name?: string | null;
    company_identities?:
      | { official_name?: string | null }
      | Array<{ official_name?: string | null }>
      | null;
  } | null | undefined,
) {
  if (!workspaceRow) {
    return "Firma";
  }

  const rawIdentity = workspaceRow.company_identities;
  const identity = Array.isArray(rawIdentity) ? (rawIdentity[0] ?? null) : (rawIdentity ?? null);
  return identity?.official_name || workspaceRow.display_name || "Firma";
}

function buildInvitePreview(options: {
  loginEmail: string;
  temporaryPassword: string | null;
  loginUrl: string;
  resetPasswordUrl: string;
}): OsgbPersonnelInvitePreview {
  return {
    loginEmail: options.loginEmail,
    temporaryPassword: options.temporaryPassword,
    loginUrl: options.loginUrl,
    resetPasswordUrl: options.resetPasswordUrl,
    note: options.temporaryPassword
      ? "Yeni kullanici icin gecici sifre uretildi. Ilk giristen sonra sifresini degistirmesi gerekir."
      : "Kullanici zaten mevcut. Mevcut sifresiyle giris yapabilir veya sifresini yenileyebilir.",
  };
}

async function upsertOrganizationMembership(
  service: ReturnType<typeof createServiceClient>,
  organizationId: string,
  userId: string,
) {
  const { error } = await service.from("organization_memberships").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      role: "staff",
      status: "active",
    },
    { onConflict: "organization_id,user_id" },
  );

  if (error && !isCompatError(error.message)) {
    throw new Error(error.message);
  }
}

async function upsertLegacyRole(
  service: ReturnType<typeof createServiceClient>,
  profileId: string,
  professionalRole: z.infer<typeof bodySchema>["professionalRole"],
) {
  const legacyCode = mapLegacyRoleCode(professionalRole);
  const { data: roleRow, error: roleError } = await service
    .from("roles")
    .select("id")
    .eq("code", legacyCode)
    .maybeSingle();

  if (roleError) {
    throw new Error(roleError.message);
  }

  if (!roleRow?.id) {
    return;
  }

  const { error } = await service.from("user_roles").upsert(
    {
      user_profile_id: profileId,
      role_id: roleRow.id,
    },
    { onConflict: "user_profile_id,role_id" },
  );

  if (error && !isCompatError(error.message)) {
    throw new Error(error.message);
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Giris gerekli." }, { status: 401 });
  }

  if (
    isDemoRestrictedAccount({
      userMetadata: user.user_metadata,
      appMetadata: user.app_metadata,
    })
  ) {
    return NextResponse.json(
      { error: "Demo modunda personel daveti ve yeni kullanici olusturma kapali." },
      { status: 403 },
    );
  }

  const context = await getAccountContextForUser(user.id);
  if (
    context.accountType !== "osgb" ||
    !context.organizationId ||
    !hasOsgbManagementAccess(context)
  ) {
    return NextResponse.json({ error: "Bu islem icin yetkiniz yok." }, { status: 403 });
  }

  const service = createServiceClient();
  const email = parsed.data.email.toLowerCase();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  const { data: workspaceRow, error: workspaceError } = await service
    .from("company_workspaces")
    .select(
      "id, company_identity_id, display_name, company_identities!inner(official_name)",
    )
    .eq("id", parsed.data.companyWorkspaceId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 });
  }

  if (!workspaceRow?.id) {
    return NextResponse.json({ error: "Firma kaydi bulunamadi." }, { status: 404 });
  }

  const [{ data: usageRows, error: usageError }, { data: staffCountRows, error: staffCountError }] =
    await Promise.all([
      service.rpc("current_plan_limits", {
        p_organization_id: context.organizationId,
      }),
      service.rpc("active_account_staff_count", {
        p_organization_id: context.organizationId,
      }),
    ]);

  if (usageError && !isCompatError(usageError.message)) {
    return NextResponse.json({ error: usageError.message }, { status: 500 });
  }
  if (staffCountError && !isCompatError(staffCountError.message)) {
    return NextResponse.json({ error: staffCountError.message }, { status: 500 });
  }

  const usageRow = Array.isArray(usageRows)
    ? ((usageRows[0] ?? null) as { max_active_staff_seats?: number | null } | null)
    : ((usageRows ?? null) as { max_active_staff_seats?: number | null } | null);
  const activeStaffCount = Number(
    Array.isArray(staffCountRows) ? staffCountRows[0] ?? 0 : staffCountRows ?? 0,
  );

  const { data: existingProfile, error: existingProfileError } = await service
    .from("user_profiles")
    .select("id, auth_user_id, organization_id, email, full_name, title")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  }

  if (
    existingProfile?.organization_id &&
    existingProfile.organization_id !== context.organizationId
  ) {
    return NextResponse.json(
      {
        error:
          "Bu e-posta baska bir hesapta kayitli. Personel daveti icin farkli bir e-posta kullanin.",
      },
      { status: 409 },
    );
  }

  const isAlreadyStaff =
    existingProfile?.auth_user_id !== null &&
    existingProfile?.auth_user_id !== undefined &&
    existingProfile.organization_id === context.organizationId;

  if (
    typeof usageRow?.max_active_staff_seats === "number" &&
    !isAlreadyStaff &&
    activeStaffCount >= usageRow.max_active_staff_seats
  ) {
    return NextResponse.json(
      {
        error:
          "Aktif personel koltuk limiti dolu. Yeni personel daveti icin once mevcut seat bosaltin ya da paketi buyutun.",
      },
      { status: 409 },
    );
  }

  let targetUserId = existingProfile?.auth_user_id ?? null;
  let targetProfileId = existingProfile?.id ?? null;
  let temporaryPassword: string | null = null;

  try {
    if (!targetUserId) {
      temporaryPassword = generateTemporaryPassword();
      const { data: createdUserData, error: createUserError } = await service.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        app_metadata: {
          organization_id: context.organizationId,
        },
        user_metadata: {
          full_name: parsed.data.fullName,
          organization_id: context.organizationId,
          must_change_password: true,
          invited_company_workspace_id: workspaceRow.id,
          invited_professional_role: parsed.data.professionalRole,
        },
      });

      if (createUserError) {
        return NextResponse.json({ error: createUserError.message }, { status: 500 });
      }

      targetUserId = createdUserData.user?.id ?? null;
      if (!targetUserId) {
        return NextResponse.json({ error: "Yeni kullanici olusturulamadi." }, { status: 500 });
      }
    }

    const profilePayload = {
      auth_user_id: targetUserId,
      organization_id: context.organizationId,
      email,
      full_name: parsed.data.fullName,
      title: parsed.data.title?.trim() || null,
      is_active: true,
    };

    const profileMutation = targetProfileId
      ? service
          .from("user_profiles")
          .update(profilePayload)
          .eq("id", targetProfileId)
          .select("id")
          .single()
      : service
          .from("user_profiles")
          .upsert(profilePayload, { onConflict: "auth_user_id" })
          .select("id")
          .single();

    const { data: upsertedProfile, error: profileUpsertError } = await profileMutation;

    if (profileUpsertError) {
      return NextResponse.json({ error: profileUpsertError.message }, { status: 500 });
    }

    targetProfileId = upsertedProfile.id;

    await upsertOrganizationMembership(service, context.organizationId, targetUserId);
    await upsertLegacyRole(service, targetProfileId, parsed.data.professionalRole);

    const { error: assignmentError } = await service.from("workspace_assignments").upsert(
      {
        organization_id: context.organizationId,
        company_workspace_id: workspaceRow.id,
        user_id: targetUserId,
        professional_role: parsed.data.professionalRole,
        assignment_status: "active",
        can_view: true,
        can_create_risk: true,
        can_edit_risk: true,
        can_approve: false,
        can_sign: false,
      },
      { onConflict: "company_workspace_id,user_id,professional_role" },
    );

    if (assignmentError && !isCompatError(assignmentError.message)) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }

    const { error: companyMembershipError } = await service.from("company_memberships").upsert(
      {
        company_identity_id: workspaceRow.company_identity_id,
        company_workspace_id: workspaceRow.id,
        organization_id: context.organizationId,
        user_id: targetUserId,
        membership_role: mapCompanyMembershipRole(parsed.data.professionalRole),
        employment_type: "osgb",
        status: "active",
        can_view_shared_operations: true,
        can_create_shared_operations: true,
        can_approve_join_requests: false,
        is_primary_contact: false,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      },
      { onConflict: "company_identity_id,organization_id,user_id,membership_role" },
    );

    if (companyMembershipError && !isCompatError(companyMembershipError.message)) {
      return NextResponse.json({ error: companyMembershipError.message }, { status: 500 });
    }

    const inviteMailPayload = {
      to: email,
      fullName: parsed.data.fullName,
      organizationName: context.organizationName || "OSGB hesabi",
      companyName: resolveWorkspaceOfficialName(workspaceRow),
      professionalRole: mapProfessionalRoleLabel(parsed.data.professionalRole),
      loginEmail: email,
      temporaryPassword,
      loginUrl: `${origin}/login`,
      resetPasswordUrl: `${origin}/forgot-password`,
    };

    let emailDelivered = true;
    let deliveryMode: "resend" | "preview" | "failed" = "resend";
    let invitePreview: OsgbPersonnelInvitePreview | null = null;
    let warning: string | null = null;

    try {
      const delivery = await sendOsgbPersonnelInviteEmail(inviteMailPayload);
      if (!delivery.delivered) {
        emailDelivered = false;
        deliveryMode = delivery.mode;
        invitePreview = delivery.preview;
        warning =
          "Mail servisi bu ortamda etkin degil. Personel olusturuldu ve atandi; asagidaki giris bilgilerini manuel paylasin.";
      }
    } catch (mailError) {
      emailDelivered = false;
      deliveryMode = "failed";
      invitePreview = buildInvitePreview({
        loginEmail: email,
        temporaryPassword,
        loginUrl: inviteMailPayload.loginUrl,
        resetPasswordUrl: inviteMailPayload.resetPasswordUrl,
      });
      warning =
        "Personel olusturuldu ve atandi ancak davet maili gonderilemedi. Giris bilgilerini manuel paylasin.";

      await logSecurityEventWithContext({
        eventType: "osgb.personnel.invite_mail_failed",
        userId: user.id,
        organizationId: context.organizationId,
        severity: "warning",
        details: {
          invitedUserId: targetUserId,
          invitedEmail: email,
          message:
            mailError instanceof Error
              ? mailError.message.slice(0, 300)
              : "invite_mail_failed",
        },
      });
    }

    await logSecurityEventWithContext({
      eventType: "osgb.personnel.invited",
      userId: user.id,
      organizationId: context.organizationId,
      severity: "info",
      details: {
        invitedUserId: targetUserId,
        invitedEmail: email,
        companyWorkspaceId: workspaceRow.id,
        professionalRole: parsed.data.professionalRole,
        createdNewUser: Boolean(temporaryPassword),
        emailDelivered,
        deliveryMode,
      },
    });

    return NextResponse.json({
      ok: true,
      createdNewUser: Boolean(temporaryPassword),
      temporaryPasswordIssued: Boolean(temporaryPassword),
      emailDelivered,
      deliveryMode,
      invitePreview,
      warning,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Personel daveti tamamlanamadi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
