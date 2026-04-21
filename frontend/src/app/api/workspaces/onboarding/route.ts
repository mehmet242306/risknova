import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/supabase/api-auth";
import { createServiceClient, logSecurityEventWithContext, parseJsonBody } from "@/lib/security/server";
import { locales, type Locale } from "@/i18n/routing";

const COUNTRY_CONFIG = {
  TR: {
    name: "Türkiye",
    defaultLanguage: "tr",
    timezone: "Europe/Istanbul",
    workspaceSuffix: "Türkiye Operasyonu",
  },
  US: {
    name: "United States",
    defaultLanguage: "en",
    timezone: "America/New_York",
    workspaceSuffix: "US Operations",
  },
  GB: {
    name: "United Kingdom",
    defaultLanguage: "en",
    timezone: "Europe/London",
    workspaceSuffix: "UK Operations",
  },
  DE: {
    name: "Deutschland",
    defaultLanguage: "de",
    timezone: "Europe/Berlin",
    workspaceSuffix: "Deutschland Betrieb",
  },
  FR: {
    name: "France",
    defaultLanguage: "fr",
    timezone: "Europe/Paris",
    workspaceSuffix: "France Operations",
  },
  ES: {
    name: "España",
    defaultLanguage: "es",
    timezone: "Europe/Madrid",
    workspaceSuffix: "España Operación",
  },
} as const;

const ROLE_OPTIONS = [
  "safety_professional",
  "occupational_physician",
  "industrial_hygienist",
  "safety_officer",
  "auditor",
  "workspace_admin",
  "viewer",
] as const;

const roleLabels: Record<(typeof ROLE_OPTIONS)[number], string> = {
  safety_professional: "İSG uzmanı",
  occupational_physician: "İşyeri hekimi",
  industrial_hygienist: "Endüstriyel hijyen uzmanı",
  safety_officer: "Diğer sağlık personeli / güvenlik görevlisi",
  auditor: "Denetçi",
  workspace_admin: "Workspace yöneticisi",
  viewer: "Görüntüleyici",
};

const LANGUAGE_LABELS: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
  ar: "العربية",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  hi: "हिन्दी",
  az: "Azərbaycanca",
  id: "Bahasa Indonesia",
};

const fallbackCertifications = [
  {
    id: "fallback-tr-isg-a",
    country_code: "TR",
    role_key: "safety_professional",
    code: "ISG-A",
    name_en: "OHS Specialist Class A",
    name_local: "İSG Uzmanı (A Sınıfı)",
    issuer: "ÇSGB",
    level: "A",
  },
  {
    id: "fallback-tr-isg-b",
    country_code: "TR",
    role_key: "safety_professional",
    code: "ISG-B",
    name_en: "OHS Specialist Class B",
    name_local: "İSG Uzmanı (B Sınıfı)",
    issuer: "ÇSGB",
    level: "B",
  },
  {
    id: "fallback-tr-isg-c",
    country_code: "TR",
    role_key: "safety_professional",
    code: "ISG-C",
    name_en: "OHS Specialist Class C",
    name_local: "İSG Uzmanı (C Sınıfı)",
    issuer: "ÇSGB",
    level: "C",
  },
  {
    id: "fallback-tr-iyh",
    country_code: "TR",
    role_key: "occupational_physician",
    code: "IYH",
    name_en: "Workplace Physician",
    name_local: "İşyeri Hekimi",
    issuer: "ÇSGB",
    level: null,
  },
  {
    id: "fallback-tr-dsp",
    country_code: "TR",
    role_key: "safety_officer",
    code: "DSP",
    name_en: "Other Health Personnel",
    name_local: "Diğer Sağlık Personeli",
    issuer: "ÇSGB",
    level: null,
  },
] as const;

const onboardingSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  roleKey: z.enum(ROLE_OPTIONS),
  defaultLanguage: z.enum(locales),
  certificationId: z.string().trim().min(1).nullable().optional(),
  workspaceName: z.string().trim().min(3).max(120).optional(),
  makePrimary: z.boolean().optional().default(true),
});

function isMissingRelationError(message: string | undefined) {
  return Boolean(
    message &&
      (message.includes("Could not find the table") ||
        message.includes("schema cache") ||
        message.includes("does not exist")),
  );
}

function getCountryConfig(code: string) {
  const config = COUNTRY_CONFIG[code as keyof typeof COUNTRY_CONFIG];
  if (config) return config;

  return {
    name: code,
    defaultLanguage: "en",
    timezone: "UTC",
    workspaceSuffix: `${code} Workspace`,
  };
}

function buildSuggestedWorkspaceName(orgName: string, countryCode: string) {
  const config = getCountryConfig(countryCode);
  return `${orgName} ${config.workspaceSuffix}`.slice(0, 120);
}

async function persistUserPreferenceLanguage(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  language: string,
) {
  const result = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      language,
    },
    {
      onConflict: "user_id",
    },
  );

  if (result.error && !isMissingRelationError(result.error.message)) {
    throw new Error(result.error.message);
  }
}

async function resolveWorkspaceFallback(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const { data } = await supabase
    .from("nova_workspace_members")
    .select(
      `
      workspace:nova_workspaces!inner (
        id,
        organization_id,
        country_code,
        name,
        default_language,
        timezone,
        is_active,
        created_at,
        updated_at
      )
    `,
    )
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const rawWorkspace = data?.workspace as
    | {
        id: string;
        organization_id: string;
        country_code: string;
        name: string;
        default_language: string;
        timezone: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }
    | {
        id: string;
        organization_id: string;
        country_code: string;
        name: string;
        default_language: string;
        timezone: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }[]
    | null
    | undefined;

  return Array.isArray(rawWorkspace) ? rawWorkspace[0] ?? null : rawWorkspace ?? null;
}

async function loadProfileForOnboarding(
  supabase: ReturnType<typeof createServiceClient>,
  profileId: string,
  authUserId: string,
) {
  const primaryQuery = await supabase
    .from("user_profiles")
    .select(
      `
      id,
      full_name,
      email,
      title,
      phone,
      active_workspace_id,
      organization:organizations!user_profiles_organization_id_fkey (
        id,
        name,
        country_code
      )
    `,
    )
    .eq("id", profileId)
    .maybeSingle();

  if (!primaryQuery.error) {
    return {
      profile: primaryQuery.data,
      activeWorkspaceId: primaryQuery.data?.active_workspace_id ?? null,
    };
  }

  if (!primaryQuery.error.message.includes("active_workspace_id")) {
    throw new Error(primaryQuery.error.message);
  }

  const { data: fallbackProfile, error: fallbackError } = await supabase
    .from("user_profiles")
    .select(
      `
      id,
      full_name,
      email,
      title,
      phone,
      organization:organizations!user_profiles_organization_id_fkey (
        id,
        name,
        country_code
      )
    `,
    )
    .eq("id", profileId)
    .maybeSingle();

  if (fallbackError) {
    throw new Error(fallbackError.message);
  }

  const fallbackWorkspace = await resolveWorkspaceFallback(supabase, authUserId);
  return {
    profile: fallbackProfile,
    activeWorkspaceId: fallbackWorkspace?.id ?? null,
  };
}

async function loadOrganizationSummary(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, country_code")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    return {
      organization: {
        id: organizationId,
        name: "Organization",
        country_code: "TR",
      },
      warning: `Organizasyon ozeti okunamadi: ${error.message}`,
    };
  }

  return {
    organization:
      data ?? {
        id: organizationId,
        name: "Organization",
        country_code: "TR",
      },
    warning: null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceClient();
  const warnings: string[] = [];

  let certifications:
    | Array<{
        id: string;
        country_code: string;
        role_key: string;
        code: string;
        name_en: string;
        name_local: string | null;
        issuer: string;
        level: string | null;
      }>
    | [] = [];
  const certificationResult = await supabase
    .from("certifications")
    .select("id, country_code, role_key, code, name_en, name_local, issuer, level")
    .eq("is_active", true)
    .order("country_code")
    .order("role_key")
    .order("code");

  if (certificationResult.error) {
    if (isMissingRelationError(certificationResult.error.message)) {
      warnings.push(
        "Sertifika sozlugu bu veritabaninda henuz kurulu degil. Türkiye için temel sertifikalari fallback olarak gosteriyorum.",
      );
      certifications = [...fallbackCertifications];
    } else {
      warnings.push(`Sertifika sozlugu okunamadi: ${certificationResult.error.message}`);
    }
  } else {
    certifications = certificationResult.data ?? [];
  }

  let memberships:
    | Array<{
        id: string;
        role_key: string;
        certification_id: string | null;
        is_primary: boolean;
        workspace:
          | {
              id: string;
              name: string;
              country_code: string;
              default_language: string;
              timezone: string;
              organization_id: string;
            }
          | {
              id: string;
              name: string;
              country_code: string;
              default_language: string;
              timezone: string;
              organization_id: string;
            }[];
      }>
    | [] = [];
  const membershipResult = await supabase
    .from("nova_workspace_members")
    .select(
      `
      id,
      role_key,
      certification_id,
      is_primary,
      workspace:nova_workspaces!inner (
        id,
        name,
        country_code,
        default_language,
        timezone,
        organization_id
      )
    `,
    )
    .eq("user_id", auth.userId)
    .order("is_primary", { ascending: false })
    .order("joined_at", { ascending: true });

  if (membershipResult.error) {
    if (isMissingRelationError(membershipResult.error.message)) {
      warnings.push(
        "Workspace tabloları bu veritabaninda henuz kurulu degil. Secim ekranini gosterecegim ama kaydetme adimi icin migration gerekecek.",
      );
    } else {
      warnings.push(`Workspace uyelikleri okunamadi: ${membershipResult.error.message}`);
    }
  } else {
    memberships = membershipResult.data ?? [];
  }

  let profile: {
    id?: string | null;
    full_name?: string | null;
    email?: string | null;
    title?: string | null;
    phone?: string | null;
    organization?:
      | { id: string; name: string; country_code: string | null }
      | { id: string; name: string; country_code: string | null }[]
      | null;
  } | null = null;
  let activeWorkspaceId: string | null = null;

  try {
    const profileResult = await loadProfileForOnboarding(supabase, auth.userProfileId, auth.userId);
    profile = profileResult.profile;
    activeWorkspaceId = profileResult.activeWorkspaceId;
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Profil okunamadi.");
  }

  const organization = Array.isArray(profile?.organization)
    ? profile.organization[0]
    : profile?.organization;
  const organizationSummary = organization?.id
    ? { organization, warning: null }
    : await loadOrganizationSummary(supabase, auth.organizationId);

  if (organizationSummary.warning) {
    warnings.push(organizationSummary.warning);
  }

  const resolvedOrganization = organizationSummary.organization;

  const recommendedCountryCode = resolvedOrganization.country_code || "TR";

  return NextResponse.json({
    profile: {
      id: profile?.id ?? auth.userProfileId,
      fullName: profile?.full_name ?? null,
      email: profile?.email ?? null,
      title: profile?.title ?? null,
      phone: profile?.phone ?? null,
      activeWorkspaceId,
    },
    organization: {
      id: resolvedOrganization.id,
      name: resolvedOrganization.name,
      countryCode: resolvedOrganization.country_code ?? null,
    },
    countries: Object.entries(COUNTRY_CONFIG).map(([code, config]) => ({
      code,
      name: config.name,
      defaultLanguage: config.defaultLanguage,
      timezone: config.timezone,
      suggestedWorkspaceName: buildSuggestedWorkspaceName(resolvedOrganization.name, code),
    })),
    recommendedCountryCode,
    roleOptions: ROLE_OPTIONS.map((value) => ({
      value,
      label: roleLabels[value],
    })),
    languageOptions: locales.map((value) => ({
      value,
      label: LANGUAGE_LABELS[value],
    })),
    certifications: certifications.map((item) => ({
      id: item.id,
      countryCode: item.country_code,
      roleKey: item.role_key,
      code: item.code,
      name: item.name_local || item.name_en,
      issuer: item.issuer,
      level: item.level,
    })),
    warnings,
    memberships: (memberships ?? []).map((row) => {
      const workspace = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
      return {
        id: row.id,
        roleKey: row.role_key,
        certificationId: row.certification_id,
        isPrimary: row.is_primary,
        workspace,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, onboardingSchema);
  if (!parsed.ok) return parsed.response;

  const supabase = createServiceClient();

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(
      `
      id,
      full_name,
      organization:organizations!user_profiles_organization_id_fkey (
        id,
        name
      )
    `,
    )
    .eq("id", auth.userProfileId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const organization = Array.isArray(profile?.organization)
    ? profile.organization[0]
    : profile?.organization;

  if (!organization?.id) {
    return NextResponse.json({ error: "Organizasyon bulunamadi." }, { status: 404 });
  }

  let certificationId = parsed.data.certificationId ?? null;
  if (certificationId) {
    const fallbackCertification = fallbackCertifications.find((item) => item.id === certificationId);
    if (fallbackCertification) {
      if (
        fallbackCertification.country_code !== parsed.data.countryCode ||
        fallbackCertification.role_key !== parsed.data.roleKey
      ) {
        return NextResponse.json(
          { error: "Secilen sertifika ulke veya role uymuyor." },
          { status: 400 },
        );
      }
      certificationId = null;
    } else {
    const { data: certification, error: certificationError } = await supabase
      .from("certifications")
      .select("id, country_code, role_key, is_active")
      .eq("id", certificationId)
      .maybeSingle();

    if (certificationError) {
      if (isMissingRelationError(certificationError.message)) {
        return NextResponse.json(
          { error: "Sertifika tablosu bu ortamda henuz yok. Sertifika secmeden devam et." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: certificationError.message }, { status: 500 });
    }

    if (
      !certification ||
      certification.is_active !== true ||
      certification.country_code !== parsed.data.countryCode ||
      certification.role_key !== parsed.data.roleKey
    ) {
      return NextResponse.json(
        { error: "Secilen sertifika ulke veya role uymuyor." },
        { status: 400 },
      );
    }
    }
  }

  const countryConfig = getCountryConfig(parsed.data.countryCode);
  const selectedLanguage = parsed.data.defaultLanguage;
  const desiredWorkspaceName =
    parsed.data.workspaceName?.trim() ||
    buildSuggestedWorkspaceName(organization.name, parsed.data.countryCode);

  try {
    await persistUserPreferenceLanguage(supabase, auth.userId, selectedLanguage);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kullanici tercihleri kaydedilemedi." },
      { status: 500 },
    );
  }

  const workspaceLookup = await supabase
    .from("nova_workspaces")
    .select(
      "id, organization_id, country_code, name, default_language, timezone, is_active, created_at, updated_at",
    )
    .eq("organization_id", organization.id)
    .eq("country_code", parsed.data.countryCode)
    .maybeSingle();

  if (workspaceLookup.error && isMissingRelationError(workspaceLookup.error.message)) {
    return NextResponse.json({
      ok: true,
      mode: "local_fallback",
      warning:
        "Workspace tabloları bu veritabanında henüz kurulu değil. Seçimin bu cihazda yerel bağlam olarak kaydedildi.",
      workspace: {
        id: `local-${parsed.data.countryCode}`,
        name: desiredWorkspaceName,
        countryCode: parsed.data.countryCode,
        defaultLanguage: selectedLanguage,
        timezone: countryConfig.timezone,
      },
    });
  }

  if (workspaceLookup.error) {
    return NextResponse.json({ error: workspaceLookup.error.message }, { status: 500 });
  }

  let workspace = workspaceLookup.data ?? null;

  if (!workspace) {
    const { data: insertedWorkspace, error: workspaceInsertError } = await supabase
      .from("nova_workspaces")
      .insert({
        organization_id: organization.id,
        country_code: parsed.data.countryCode,
        name: desiredWorkspaceName,
        default_language: selectedLanguage,
        timezone: countryConfig.timezone,
      })
      .select("id, organization_id, country_code, name, default_language, timezone, is_active, created_at, updated_at")
      .single();

    if (workspaceInsertError) {
      if (isMissingRelationError(workspaceInsertError.message)) {
        return NextResponse.json({
          ok: true,
          mode: "local_fallback",
          warning:
            "Workspace tabloları bu veritabanında henüz kurulu değil. Seçimin bu cihazda yerel bağlam olarak kaydedildi.",
          workspace: {
            id: `local-${parsed.data.countryCode}`,
            name: desiredWorkspaceName,
            countryCode: parsed.data.countryCode,
            defaultLanguage: selectedLanguage,
            timezone: countryConfig.timezone,
          },
        });
      }
      return NextResponse.json({ error: workspaceInsertError.message }, { status: 500 });
    }

    workspace = insertedWorkspace;
  }

  if (
    workspace &&
    (workspace.name !== desiredWorkspaceName ||
      workspace.default_language !== selectedLanguage ||
      workspace.timezone !== countryConfig.timezone)
  ) {
    const { data: updatedWorkspace, error: workspaceUpdateError } = await supabase
      .from("nova_workspaces")
      .update({
        name: desiredWorkspaceName,
        default_language: selectedLanguage,
        timezone: countryConfig.timezone,
      })
      .eq("id", workspace.id)
      .select("id, organization_id, country_code, name, default_language, timezone, is_active, created_at, updated_at")
      .single();

    if (workspaceUpdateError) {
      return NextResponse.json({ error: workspaceUpdateError.message }, { status: 500 });
    }

    workspace = updatedWorkspace;
  }

  if (parsed.data.makePrimary) {
    const { error: unsetPrimaryError } = await supabase
      .from("nova_workspace_members")
      .update({ is_primary: false })
      .eq("user_id", auth.userId);

    if (unsetPrimaryError) {
      if (isMissingRelationError(unsetPrimaryError.message)) {
        return NextResponse.json({
          ok: true,
          mode: "local_fallback",
          warning:
            "Workspace üyelik tabloları bu veritabanında henüz kurulu değil. Seçimin bu cihazda yerel bağlam olarak kaydedildi.",
          workspace: {
            id: `local-${parsed.data.countryCode}`,
            name: desiredWorkspaceName,
            countryCode: parsed.data.countryCode,
            defaultLanguage: selectedLanguage,
            timezone: countryConfig.timezone,
          },
        });
      }
      return NextResponse.json({ error: unsetPrimaryError.message }, { status: 500 });
    }
  }

  const { data: existingMembership, error: existingMembershipError } = await supabase
    .from("nova_workspace_members")
    .select("id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (existingMembershipError) {
    if (isMissingRelationError(existingMembershipError.message)) {
      return NextResponse.json({
        ok: true,
        mode: "local_fallback",
        warning:
          "Workspace üyelik tabloları bu veritabanında henüz kurulu değil. Seçimin bu cihazda yerel bağlam olarak kaydedildi.",
        workspace: {
          id: `local-${parsed.data.countryCode}`,
          name: desiredWorkspaceName,
          countryCode: parsed.data.countryCode,
          defaultLanguage: selectedLanguage,
          timezone: countryConfig.timezone,
        },
      });
    }
    return NextResponse.json({ error: existingMembershipError.message }, { status: 500 });
  }

  if (existingMembership?.id) {
    const { error: updateMembershipError } = await supabase
      .from("nova_workspace_members")
      .update({
        role_key: parsed.data.roleKey,
        certification_id: certificationId,
        is_primary: parsed.data.makePrimary,
      })
      .eq("id", existingMembership.id);

    if (updateMembershipError) {
      if (isMissingRelationError(updateMembershipError.message)) {
        return NextResponse.json({
          ok: true,
          mode: "local_fallback",
          warning:
            "Workspace üyelik tabloları bu veritabanında henüz kurulu değil. Seçimin bu cihazda yerel bağlam olarak kaydedildi.",
          workspace: {
            id: `local-${parsed.data.countryCode}`,
            name: desiredWorkspaceName,
            countryCode: parsed.data.countryCode,
            defaultLanguage: selectedLanguage,
            timezone: countryConfig.timezone,
          },
        });
      }
      return NextResponse.json({ error: updateMembershipError.message }, { status: 500 });
    }
  } else {
    const { error: insertMembershipError } = await supabase
      .from("nova_workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: auth.userId,
        role_key: parsed.data.roleKey,
        certification_id: certificationId,
        is_primary: parsed.data.makePrimary,
      });

    if (insertMembershipError) {
      if (isMissingRelationError(insertMembershipError.message)) {
        return NextResponse.json({
          ok: true,
          mode: "local_fallback",
          warning:
            "Workspace üyelik tabloları bu veritabanında henüz kurulu değil. Seçimin bu cihazda yerel bağlam olarak kaydedildi.",
          workspace: {
            id: `local-${parsed.data.countryCode}`,
            name: desiredWorkspaceName,
            countryCode: parsed.data.countryCode,
            defaultLanguage: selectedLanguage,
            timezone: countryConfig.timezone,
          },
        });
      }
      return NextResponse.json({ error: insertMembershipError.message }, { status: 500 });
    }
  }

  const { error: profileUpdateError } = await supabase
    .from("user_profiles")
    .update({ active_workspace_id: workspace.id })
    .eq("id", auth.userProfileId);

  if (profileUpdateError && !profileUpdateError.message.includes("active_workspace_id")) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  await logSecurityEventWithContext({
    eventType: "workspace.onboarding.completed",
    userId: auth.userId,
    organizationId: organization.id,
    severity: "info",
    details: {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      jurisdictionCode: workspace.country_code,
      roleKey: parsed.data.roleKey,
      certificationId,
    },
  });

  return NextResponse.json({
    ok: true,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      countryCode: workspace.country_code,
      defaultLanguage: workspace.default_language,
      timezone: workspace.timezone,
    },
  });
}
