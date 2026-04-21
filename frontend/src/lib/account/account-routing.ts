import { createServiceClient } from "@/lib/security/server";

export type AccountType = "individual" | "osgb" | "enterprise";

export type AccountContext = {
  userId: string;
  isPlatformAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  accountType: AccountType | null;
  membershipRole: "owner" | "admin" | "staff" | "viewer" | null;
  currentPlanCode: string | null;
};

type MembershipRole = AccountContext["membershipRole"];
export type AccountSurface = "platform-admin" | "osgb-manager" | "standard";

function isMissingRelationError(message: string | undefined | null): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

function mapOrganizationTypeToAccountType(
  value: string | null | undefined,
): AccountType | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "osgb" || normalized === "osgb_manager") return "osgb";
  if (
    normalized === "enterprise" ||
    normalized === "corporate" ||
    normalized === "kurumsal"
  ) {
    return "enterprise";
  }
  return "individual";
}

async function resolveProfileWithOrganization(service: ReturnType<typeof createServiceClient>, userId: string) {
  const preferred = await service
    .from("user_profiles")
    .select(
      `
      id,
      auth_user_id,
      organization_id,
      organization:organizations!user_profiles_organization_id_fkey (
        id,
        name,
        account_type,
        organization_type,
        current_plan_id
      )
    `,
    )
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!preferred.error) {
    return preferred;
  }

  if (!isMissingRelationError(preferred.error.message)) {
    return preferred;
  }

  return service
    .from("user_profiles")
    .select(
      `
      id,
      auth_user_id,
      organization_id,
      organization:organizations!user_profiles_organization_id_fkey (
        id,
        name,
        organization_type
      )
    `,
    )
    .eq("auth_user_id", userId)
    .maybeSingle();
}

function flattenLegacyRoleCodes(
  rows: Array<{ roles?: { code?: string } | Array<{ code?: string }> | null }>,
): string[] {
  return rows.flatMap((row) => {
    if (Array.isArray(row.roles)) {
      return row.roles
        .map((role) => String(role?.code ?? "").trim().toLowerCase())
        .filter(Boolean);
    }

    const code = String(row.roles?.code ?? "").trim().toLowerCase();
    return code ? [code] : [];
  });
}

async function resolveLegacyMembershipRole(
  service: ReturnType<typeof createServiceClient>,
  profileId: string | null | undefined,
  accountType: AccountType | null,
): Promise<MembershipRole> {
  if (!profileId) {
    return accountType === "individual" ? "owner" : null;
  }

  const { data, error } = await service
    .from("user_roles")
    .select("roles(code)")
    .eq("user_profile_id", profileId);

  if (error) {
    if (isMissingRelationError(error.message)) {
      return accountType === "individual" ? "owner" : null;
    }
    throw new Error(error.message);
  }

  const roleCodes = flattenLegacyRoleCodes(
    (data ?? []) as Array<{ roles?: { code?: string } | Array<{ code?: string }> | null }>,
  );

  if (
    roleCodes.some((code) =>
      [
        "owner",
        "admin",
        "organization_admin",
        "osgb_manager",
        "super_admin",
        "platform_admin",
      ].includes(code),
    )
  ) {
    return accountType === "individual" ? "owner" : "admin";
  }

  if (roleCodes.some((code) => ["viewer", "readonly_admin"].includes(code))) {
    return "viewer";
  }

  if (roleCodes.length > 0) {
    return accountType === "individual" ? "owner" : "staff";
  }

  return accountType === "individual" ? "owner" : null;
}

async function resolveCurrentPlanCode(
  service: ReturnType<typeof createServiceClient>,
  planId: string | null | undefined,
): Promise<string | null> {
  if (!planId) return null;

  const { data, error } = await service
    .from("plans")
    .select("code")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }

  return data?.code ?? null;
}

async function resolvePlatformAdminStatus(
  userId: string,
): Promise<boolean> {
  const service = createServiceClient();

  const { data: rpcData, error: rpcError } = await service.rpc("is_platform_admin", {
    uid: userId,
  });

  if (!rpcError) {
    return rpcData === true;
  }

  if (!isMissingRelationError(rpcError.message)) {
    throw new Error(rpcError.message);
  }

  const { data: platformAdminRow, error: platformAdminTableError } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!platformAdminTableError) {
    return !!platformAdminRow;
  }

  if (!isMissingRelationError(platformAdminTableError.message)) {
    throw new Error(platformAdminTableError.message);
  }

  const { data: legacySuperAdmin, error: legacySuperAdminError } = await service.rpc(
    "is_super_admin",
    { uid: userId },
  );

  if (legacySuperAdminError) {
    if (isMissingRelationError(legacySuperAdminError.message)) {
      return false;
    }
    throw new Error(legacySuperAdminError.message);
  }

  return legacySuperAdmin === true;
}

export async function getAccountContextForUser(
  userId: string,
): Promise<AccountContext> {
  const service = createServiceClient();

  const [
    isPlatformAdminData,
    { data: profile, error: profileError },
  ] = await Promise.all([
    resolvePlatformAdminStatus(userId),
    resolveProfileWithOrganization(service, userId),
  ]);

  if (profileError && !isMissingRelationError(profileError.message)) {
    throw new Error(profileError.message);
  }

  const organization = profile?.organization as
    | {
        id: string;
        name: string;
        account_type: AccountType | null;
        organization_type?: string | null;
        current_plan_id?: string | null;
      }
    | null
    | undefined;
  const profileId =
    profile && typeof profile === "object" && "id" in profile && typeof profile.id === "string"
      ? profile.id
      : null;
  const accountType =
    organization?.account_type ??
    mapOrganizationTypeToAccountType(organization?.organization_type) ??
    null;
  const currentPlanCode = await resolveCurrentPlanCode(service, organization?.current_plan_id);

  let membershipRole: MembershipRole = null;
  if (organization?.id) {
    const { data: membership, error: membershipError } = await service
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", organization.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (membershipError && !isMissingRelationError(membershipError.message)) {
      throw new Error(membershipError.message);
    }

    membershipRole = (membership?.role as AccountContext["membershipRole"]) ?? null;
  }

  if (!membershipRole) {
    membershipRole = await resolveLegacyMembershipRole(service, profileId, accountType);
  }

  return {
    userId,
    isPlatformAdmin: isPlatformAdminData === true,
    organizationId: organization?.id ?? profile?.organization_id ?? null,
    organizationName: organization?.name ?? null,
    accountType,
    membershipRole,
    currentPlanCode,
  };
}

export function hasOsgbManagementAccess(
  context: Pick<AccountContext, "accountType" | "membershipRole">,
): boolean {
  if (context.accountType !== "osgb") {
    return false;
  }

  return (
    context.membershipRole === "owner" ||
    context.membershipRole === "admin"
  );
}

export function resolveAccountSurface(
  context: Pick<AccountContext, "accountType" | "membershipRole" | "isPlatformAdmin">,
): AccountSurface {
  if (context.isPlatformAdmin) {
    return "platform-admin";
  }

  if (hasOsgbManagementAccess(context)) {
    return "osgb-manager";
  }

  return "standard";
}

export function resolvePostLoginPath(context: AccountContext): string {
  const surface = resolveAccountSurface(context);

  if (surface === "platform-admin") {
    return "/platform-admin";
  }

  if (!context.organizationId || !context.accountType) {
    return "/workspace/onboarding";
  }

  if (surface === "osgb-manager") {
    return "/osgb";
  }

  if (context.accountType === "enterprise") {
    return "/enterprise";
  }

  if (context.accountType === "individual") {
    return "/workspace/onboarding";
  }

  return "/companies";
}
