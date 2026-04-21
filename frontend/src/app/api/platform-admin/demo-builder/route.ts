import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultLocale, locales, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
  type AccountType,
} from "@/lib/account/account-routing";
import {
  createServiceClient,
  logSecurityEventWithContext,
  parseJsonBody,
} from "@/lib/security/server";
import { sendDemoAccountProvisionEmail } from "@/lib/mailer";
import { buildDemoAccessExpiresAt } from "@/lib/platform-admin/demo-access";
import {
  buildLocalizedCompanyName,
  buildLocalizedDemoDocument,
  buildLocalizedNovaStarterPrompts,
  buildLocalizedDemoTask,
  buildLocalizedOrganizationName,
  buildLocalizedStarterNotification,
  buildLocalizedTrainingSeed,
  buildLocalizedWelcomeDocument,
  getLocalizedAccountTypeLabel,
  getLocalizedWorkspaceNote,
} from "@/lib/platform-admin/demo-localization";

const bodySchema = z.object({
  accountType: z.enum(["individual", "osgb", "enterprise"]),
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).optional().default("TR"),
  locale: z.enum(locales).optional().default(defaultLocale),
  includeSampleData: z.boolean().optional().default(true),
  companyName: z.string().trim().min(2).max(180).optional(),
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

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function generateTemporaryPassword() {
  return `Rn!${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}Aa9`;
}

function buildPlanCode(accountType: AccountType) {
  if (accountType === "osgb") return "osgb_starter";
  if (accountType === "enterprise") return "enterprise";
  return "individual_free";
}

async function resolvePlanId(
  service: ReturnType<typeof createServiceClient>,
  accountType: AccountType,
) {
  const { data, error } = await service
    .from("plans")
    .select("id")
    .eq("code", buildPlanCode(accountType))
    .maybeSingle();

  if (error) {
    if (isCompatError(error.message)) return null;
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function createOrganization(
  service: ReturnType<typeof createServiceClient>,
  input: {
    name: string;
    accountType: AccountType;
    planId: string | null;
  },
) {
  const slug = `${slugify(input.name) || "demo-hesap"}-${Date.now().toString().slice(-6)}`;
  const createPayload: Record<string, unknown> = {
    name: input.name,
    slug,
    organization_type: input.accountType,
    account_type: input.accountType,
    status: "active",
  };

  if (input.planId) {
    createPayload.current_plan_id = input.planId;
  }

  let result = await service
    .from("organizations")
    .insert(createPayload)
    .select("id")
    .single();

  if (result.error && isCompatError(result.error.message)) {
    result = await service
      .from("organizations")
      .insert({
        name: input.name,
        slug,
        organization_type: input.accountType,
      })
      .select("id")
      .single();
  }

  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message || "Demo hesabi olusturulamadi.");
  }

  const { error: syncError } = await service
    .from("organizations")
    .update({
      account_type: input.accountType,
      status: "active",
      ...(input.planId ? { current_plan_id: input.planId } : {}),
    })
    .eq("id", result.data.id);

  if (syncError && !isCompatError(syncError.message)) {
    throw new Error(syncError.message);
  }

  return result.data.id as string;
}

async function upsertUserProfile(
  service: ReturnType<typeof createServiceClient>,
  input: {
    userId: string;
    organizationId: string;
    email: string;
    fullName: string;
  },
) {
  const { data, error } = await service
    .from("user_profiles")
    .upsert(
      {
        auth_user_id: input.userId,
        organization_id: input.organizationId,
        email: input.email,
        full_name: input.fullName,
        is_active: true,
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Demo kullanicisinin profili olusturulamadi.");
  }

  return data.id as string;
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
      role: "owner",
      status: "active",
    },
    { onConflict: "organization_id,user_id" },
  );

  if (error) {
    if (isCompatError(error.message)) return false;
    throw new Error(error.message);
  }

  return true;
}

async function upsertLegacyManagementRole(
  service: ReturnType<typeof createServiceClient>,
  profileId: string,
) {
  const { data: roleRow, error: roleError } = await service
    .from("roles")
    .select("id")
    .eq("code", "organization_admin")
    .maybeSingle();

  if (roleError) {
    if (isCompatError(roleError.message)) return;
    throw new Error(roleError.message);
  }

  if (!roleRow?.id) return;

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

async function attachSubscription(
  service: ReturnType<typeof createServiceClient>,
  organizationId: string,
  planId: string | null,
) {
  if (!planId) return;

  const { error } = await service.from("organization_subscriptions").insert({
    organization_id: organizationId,
    plan_id: planId,
    status: "active",
  });

  if (error && !isCompatError(error.message)) {
    throw new Error(error.message);
  }
}

async function persistUserPreferenceLanguage(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  language: string,
) {
  const { error } = await service.from("user_preferences").upsert(
    {
      user_id: userId,
      language,
    },
    { onConflict: "user_id" },
  );

  if (error && !isCompatError(error.message)) {
    throw new Error(error.message);
  }
}

async function seedDemoCompanyWorkspace(
  service: ReturnType<typeof createServiceClient>,
  input: {
    organizationId: string;
    userId: string;
    companyName: string;
    accountType: AccountType;
    locale: Locale;
  },
) {
  const sector = input.accountType === "osgb" ? "OSGB Hizmetleri" : "Danismanlik";
  const hazardClass = input.accountType === "enterprise" ? "Tehlikeli" : "Az Tehlikeli";
  const workspaceNote = getLocalizedWorkspaceNote(input.locale);

  const { data: identityRow, error: identityError } = await service
    .from("company_identities")
    .insert({
      official_name: input.companyName,
      sector,
      hazard_class: hazardClass,
      city: "Istanbul",
      owner_organization_id: input.organizationId,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select("id")
    .single();

  if (identityError || !identityRow?.id) {
    throw new Error(identityError?.message || "Demo firma kimligi olusturulamadi.");
  }

  let workspaceResult = await service
    .from("company_workspaces")
    .insert({
      organization_id: input.organizationId,
      company_identity_id: identityRow.id,
      display_name: input.companyName,
      notes: workspaceNote,
      is_primary_workspace: true,
      is_archived: false,
      status: "active",
      created_by: input.userId,
      updated_by: input.userId,
      created_by_user_id: input.userId,
    })
    .select("id")
    .single();

  if (workspaceResult.error && isCompatError(workspaceResult.error.message)) {
    workspaceResult = await service
      .from("company_workspaces")
      .insert({
        organization_id: input.organizationId,
        company_identity_id: identityRow.id,
        display_name: input.companyName,
        notes: workspaceNote,
        is_primary_workspace: true,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select("id")
      .single();
  }

  if (workspaceResult.error || !workspaceResult.data?.id) {
    throw new Error(workspaceResult.error?.message || "Demo workspace olusturulamadi.");
  }

  const { error: membershipError } = await service.from("company_memberships").upsert(
    {
      company_identity_id: identityRow.id,
      company_workspace_id: workspaceResult.data.id,
      organization_id: input.organizationId,
      user_id: input.userId,
      membership_role: "owner",
      employment_type: input.accountType === "osgb" ? "osgb" : "internal",
      status: "active",
      can_view_shared_operations: true,
      can_create_shared_operations: true,
      can_approve_join_requests: true,
      is_primary_contact: true,
      approved_by: input.userId,
      approved_at: new Date().toISOString(),
      created_by: input.userId,
      updated_by: input.userId,
    },
    { onConflict: "company_identity_id,organization_id,user_id,membership_role" },
  );

  if (membershipError && !isCompatError(membershipError.message)) {
    throw new Error(membershipError.message);
  }

  return {
    companyIdentityId: identityRow.id as string,
    companyWorkspaceId: workspaceResult.data.id as string,
  };
}

async function createSampleDocument(
  service: ReturnType<typeof createServiceClient>,
  input: {
    organizationId: string;
    companyWorkspaceId: string;
    profileId: string;
    userId: string;
    accountType: AccountType;
    companyName: string;
    locale: Locale;
  },
) {
  const demoDocument = buildLocalizedDemoDocument(
    input.locale,
    input.accountType,
    input.companyName,
  );

  let result = await service
    .from("editor_documents")
    .insert({
      organization_id: input.organizationId,
      company_workspace_id: input.companyWorkspaceId,
      group_key: demoDocument.groupKey,
      title: demoDocument.title,
      content_json: demoDocument.contentJson,
      variables_data: {
        demo_mode: true,
        seeded_by: "platform_admin_demo_builder",
      },
      status: "hazir",
      version: 1,
      prepared_by: input.profileId,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select("id")
    .single();

  if (result.error && isCompatError(result.error.message)) {
    result = await service
      .from("editor_documents")
      .insert({
        organization_id: input.organizationId,
        company_workspace_id: input.companyWorkspaceId,
        group_key: demoDocument.groupKey,
        title: demoDocument.title,
        content_json: demoDocument.contentJson,
        variables_data: {
          demo_mode: true,
          seeded_by: "platform_admin_demo_builder",
        },
        status: "hazir",
        version: 1,
        prepared_by: input.profileId,
      })
      .select("id")
      .single();
  }

  if (result.error && !isCompatError(result.error.message)) {
    throw new Error(result.error.message);
  }

  return result.data?.id ?? null;
}

async function createWelcomeDocument(
  service: ReturnType<typeof createServiceClient>,
  input: {
    organizationId: string;
    companyWorkspaceId: string;
    profileId: string;
    userId: string;
    accountType: AccountType;
    locale: Locale;
    organizationName: string;
    companyName: string;
    starterPrompts: Array<{ title: string; description: string; prompt: string }>;
  },
) {
  const welcomeDocument = buildLocalizedWelcomeDocument(
    input.locale,
    input.accountType,
    input.organizationName,
    input.companyName,
    input.starterPrompts,
  );

  let result = await service
    .from("editor_documents")
    .insert({
      organization_id: input.organizationId,
      company_workspace_id: input.companyWorkspaceId,
      group_key: welcomeDocument.groupKey,
      title: welcomeDocument.title,
      content_json: welcomeDocument.contentJson,
      variables_data: {
        demo_mode: true,
        seeded_by: "platform_admin_demo_builder",
        seed_type: "welcome_document",
      },
      status: "hazir",
      version: 1,
      prepared_by: input.profileId,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select("id")
    .single();

  if (result.error && isCompatError(result.error.message)) {
    result = await service
      .from("editor_documents")
      .insert({
        organization_id: input.organizationId,
        company_workspace_id: input.companyWorkspaceId,
        group_key: welcomeDocument.groupKey,
        title: welcomeDocument.title,
        content_json: welcomeDocument.contentJson,
        variables_data: {
          demo_mode: true,
          seeded_by: "platform_admin_demo_builder",
          seed_type: "welcome_document",
        },
        status: "hazir",
        version: 1,
        prepared_by: input.profileId,
      })
      .select("id")
      .single();
  }

  if (result.error && !isCompatError(result.error.message)) {
    throw new Error(result.error.message);
  }

  return result.data?.id ?? null;
}

async function createSampleTask(
  service: ReturnType<typeof createServiceClient>,
  input: {
    organizationId: string;
    companyWorkspaceId: string;
    userId: string;
    companyName: string;
    locale: Locale;
  },
) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const localizedTask = buildLocalizedDemoTask(input.locale, input.companyName);

  const { data, error } = await service
    .from("workspace_tasks")
    .insert({
      organization_id: input.organizationId,
      company_workspace_id: input.companyWorkspaceId,
      title: localizedTask.title,
      description: localizedTask.description,
      status: "open",
      priority: "medium",
      due_date: dueDate.toISOString().slice(0, 10),
      created_by_user_id: input.userId,
    })
    .select("id")
    .single();

  if (error && !isCompatError(error.message)) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function createSampleTraining(
  service: ReturnType<typeof createServiceClient>,
  input: {
    organizationId: string;
    companyWorkspaceId: string;
    userId: string;
    companyName: string;
    locale: Locale;
  },
) {
  const localizedTraining = buildLocalizedTrainingSeed(input.locale, input.companyName);
  const trainingDate = new Date();
  trainingDate.setDate(trainingDate.getDate() + 3);

  const { data, error } = await service
    .from("company_trainings")
    .insert({
      organization_id: input.organizationId,
      company_workspace_id: input.companyWorkspaceId,
      title: localizedTraining.title,
      training_type: "zorunlu",
      trainer_name: localizedTraining.trainerName,
      training_date: trainingDate.toISOString().slice(0, 10),
      duration_hours: 1.5,
      location: input.companyName,
      status: "planned",
      notes: localizedTraining.notes,
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (error) {
    if (isCompatError(error.message)) return null;
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function createStarterNotification(
  service: ReturnType<typeof createServiceClient>,
  input: {
    organizationId: string;
    userId: string;
    companyName: string;
    locale: Locale;
    firstPrompt: { title: string; description: string; prompt: string } | null;
  },
) {
  const localizedNotification = buildLocalizedStarterNotification(
    input.locale,
    input.companyName,
    input.firstPrompt,
  );
  const link = input.firstPrompt
    ? `/solution-center?prompt=${encodeURIComponent(input.firstPrompt.prompt)}`
    : "/solution-center";

  const { data, error } = await service
    .from("notifications")
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      title: localizedNotification.title,
      message: localizedNotification.message,
      type: "system",
      level: "info",
      link,
      actor_name: "RiskNova Demo Builder",
    })
    .select("id")
    .single();

  if (error) {
    if (isCompatError(error.message)) return null;
    throw new Error(error.message);
  }

  return data?.id ?? null;
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

  const adminContext = await getAccountContextForUser(user.id);
  if (!adminContext.isPlatformAdmin) {
    return NextResponse.json({ error: "Bu islem icin yetkiniz yok." }, { status: 403 });
  }

  const body = parsed.data;
  const service = createServiceClient();
  const email = body.email.toLowerCase();
  const accountType = body.accountType;
  const locale = body.locale;
  const displayName = body.displayName.trim();
  const companyName = buildLocalizedCompanyName(
    locale,
    accountType,
    body.companyName,
    displayName,
  );
  const organizationName = buildLocalizedOrganizationName(locale, accountType, displayName);
  const starterPrompts = buildLocalizedNovaStarterPrompts(locale, accountType, companyName);
  const temporaryPassword = generateTemporaryPassword();
  const demoAccessExpiresAt = buildDemoAccessExpiresAt();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;

  const { data: existingProfile, error: existingProfileError } = await service
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError && !isCompatError(existingProfileError.message)) {
    return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  }

  if (existingProfile?.id) {
    return NextResponse.json(
      { error: "Bu e-posta ile daha once bir hesap olusturulmus. Yeni bir demo e-postasi kullanin." },
      { status: 409 },
    );
  }

  const planId = await resolvePlanId(service, accountType);
  let createdUserId: string | null = null;
  let organizationId: string | null = null;
  let profileId: string | null = null;
  let seededWorkspaceId: string | null = null;
  let seededDocumentId: string | null = null;
  let seededWelcomeDocumentId: string | null = null;
  let seededTaskId: string | null = null;
  let seededTrainingId: string | null = null;
  let seededNotificationId: string | null = null;

  try {
    const { data: createdUser, error: createUserError } = await service.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        must_change_password: true,
        demo_mode: true,
        demo_account_type: accountType,
        preferred_locale: locale,
        demo_access_expires_at: demoAccessExpiresAt,
        demo_access_disabled_at: null,
        demo_starter_prompts: starterPrompts.map((item) => item.prompt),
      },
      app_metadata: {
        demo_mode: true,
        demo_account_type: accountType,
        demo_access_expires_at: demoAccessExpiresAt,
        demo_access_disabled_at: null,
      },
    });

    if (createUserError || !createdUser.user?.id) {
      return NextResponse.json(
        { error: createUserError?.message || "Demo kullanicisi olusturulamadi." },
        { status: 500 },
      );
    }

    createdUserId = createdUser.user.id;
    organizationId = await createOrganization(service, {
      name: organizationName,
      accountType,
      planId,
    });
    profileId = await upsertUserProfile(service, {
      userId: createdUserId,
      organizationId,
      email,
      fullName: displayName,
    });

    const membershipCreated = await upsertOrganizationMembership(
      service,
      organizationId,
      createdUserId,
    );
    if (!membershipCreated && accountType !== "individual") {
      await upsertLegacyManagementRole(service, profileId);
    }

    await attachSubscription(service, organizationId, planId);
    await persistUserPreferenceLanguage(service, createdUserId, locale);

    await service.auth.admin.updateUserById(createdUserId, {
      user_metadata: {
        full_name: displayName,
        organization_id: organizationId,
        must_change_password: true,
        demo_mode: true,
        demo_account_type: accountType,
        preferred_locale: locale,
        demo_access_expires_at: demoAccessExpiresAt,
        demo_access_disabled_at: null,
        demo_starter_prompts: starterPrompts.map((item) => item.prompt),
      },
      app_metadata: {
        organization_id: organizationId,
        demo_mode: true,
        demo_account_type: accountType,
        preferred_locale: locale,
        demo_access_expires_at: demoAccessExpiresAt,
        demo_access_disabled_at: null,
        demo_starter_prompts: starterPrompts.map((item) => item.prompt),
      },
    });

    if (body.includeSampleData) {
      const seededCompany = await seedDemoCompanyWorkspace(service, {
        organizationId,
        userId: createdUserId,
        companyName,
        accountType,
        locale,
      });
      seededWorkspaceId = seededCompany.companyWorkspaceId;

      seededDocumentId = await createSampleDocument(service, {
        organizationId,
        companyWorkspaceId: seededWorkspaceId,
        profileId,
        userId: createdUserId,
        accountType,
        companyName,
        locale,
      });

      seededWelcomeDocumentId = await createWelcomeDocument(service, {
        organizationId,
        companyWorkspaceId: seededWorkspaceId,
        profileId,
        userId: createdUserId,
        accountType,
        locale,
        organizationName,
        companyName,
        starterPrompts,
      });

      seededTrainingId = await createSampleTraining(service, {
        organizationId,
        companyWorkspaceId: seededWorkspaceId,
        userId: createdUserId,
        companyName,
        locale,
      });

      seededTaskId = await createSampleTask(service, {
        organizationId,
        companyWorkspaceId: seededWorkspaceId,
        userId: createdUserId,
        companyName,
        locale,
      });

      seededNotificationId = await createStarterNotification(service, {
        organizationId,
        userId: createdUserId,
        companyName,
        locale,
        firstPrompt: starterPrompts[0] ?? null,
      });
    }

    const delivery = await sendDemoAccountProvisionEmail({
      to: email,
      fullName: displayName,
      organizationName,
      accountTypeLabel: getLocalizedAccountTypeLabel(locale, accountType),
      locale,
      loginEmail: email,
      temporaryPassword,
      loginUrl: `${origin}/login`,
      resetPasswordUrl: `${origin}/reset-password`,
      accessExpiresAt: demoAccessExpiresAt,
    });

    await logSecurityEventWithContext({
      eventType: "platform_admin.demo_account.created",
      endpoint: "/api/platform-admin/demo-builder",
      userId: user.id,
      organizationId: adminContext.organizationId,
      severity: "info",
      details: {
        demo_user_id: createdUserId,
        demo_organization_id: organizationId,
        demo_account_type: accountType,
        demo_locale: locale,
        seeded_workspace_id: seededWorkspaceId,
        seeded_document_id: seededDocumentId,
        seeded_welcome_document_id: seededWelcomeDocumentId,
        seeded_task_id: seededTaskId,
        seeded_training_id: seededTrainingId,
        seeded_notification_id: seededNotificationId,
      },
    });

    return NextResponse.json({
      ok: true,
      demo: {
        userId: createdUserId,
        organizationId,
        accountType,
        locale,
        organizationName,
        companyWorkspaceId: seededWorkspaceId,
        redirectPath: resolvePostLoginPath({
          userId: createdUserId,
          isPlatformAdmin: false,
          organizationId,
          organizationName,
          accountType,
          membershipRole: accountType === "individual" ? "owner" : "owner",
          currentPlanCode: buildPlanCode(accountType),
        }),
        loginEmail: email,
        temporaryPassword,
        accessExpiresAt: demoAccessExpiresAt,
      },
      delivery,
      seeded: {
        companyWorkspaceId: seededWorkspaceId,
        documentId: seededDocumentId,
        welcomeDocumentId: seededWelcomeDocumentId,
        taskId: seededTaskId,
        trainingId: seededTrainingId,
        notificationId: seededNotificationId,
        novaStarterPrompts: starterPrompts,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Demo olusturucu su anda tamamlanamiyor.",
      },
      { status: 500 },
    );
  }
}
