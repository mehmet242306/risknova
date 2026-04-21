export type AccountContextResponse = {
  ok: boolean;
  context: {
    userId: string;
    isPlatformAdmin: boolean;
    organizationId: string | null;
    organizationName: string | null;
    accountType: "individual" | "osgb" | "enterprise" | null;
    membershipRole: "owner" | "admin" | "staff" | "viewer" | null;
    currentPlanCode: string | null;
  };
  surface?: "platform-admin" | "osgb-manager" | "standard";
  redirectPath: string;
  usage: {
    maxActiveWorkspaces: number | null;
    maxActiveStaffSeats: number | null;
    hasPersonnelModule: boolean;
    hasTaskTracking: boolean;
    hasAnnouncements: boolean;
    contactRequired: boolean;
    activeWorkspaceCount: number;
    activeStaffCount: number;
  } | null;
};

export type AccountContextPayload = AccountContextResponse["context"];

export function resolveClientAccountSurface(
  context:
    | Pick<AccountContextPayload, "accountType" | "membershipRole" | "isPlatformAdmin">
    | null
    | undefined,
): NonNullable<AccountContextResponse["surface"]> {
  if (!context) {
    return "standard";
  }

  if (context.isPlatformAdmin) {
    return "platform-admin";
  }

  if (context.accountType === "osgb" && (context.membershipRole === "owner" || context.membershipRole === "admin")) {
    return "osgb-manager";
  }

  return "standard";
}

export function hasManagedOsgbAccount(
  context:
    | Pick<AccountContextPayload, "accountType" | "membershipRole" | "isPlatformAdmin">
    | null
    | undefined,
): boolean {
  return resolveClientAccountSurface(context) === "osgb-manager";
}

export async function fetchAccountContext(): Promise<AccountContextResponse | null> {
  try {
    const response = await fetch("/api/account/context", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) return null;
    return (await response.json()) as AccountContextResponse;
  } catch {
    return null;
  }
}
