import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/security/server";
import {
  getAccountContextForUser,
  hasOsgbManagementAccess,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";

export type OsgbUsageSnapshot = {
  maxActiveWorkspaces: number | null;
  maxActiveStaffSeats: number | null;
  activeWorkspaceCount: number;
  activeStaffCount: number;
  hasPersonnelModule: boolean;
  hasTaskTracking: boolean;
  hasAnnouncements: boolean;
};

export type OsgbCompanyOption = {
  workspaceId: string;
  companyIdentityId: string;
  displayName: string;
  officialName: string;
  slug: string | null;
  sector: string | null;
  hazardClass: string | null;
  city: string | null;
};

export type OsgbManagerContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  usage: OsgbUsageSnapshot | null;
  companies: OsgbCompanyOption[];
};

export function isCompatError(message: string | undefined | null): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

function normalizeUsageRow(row: Record<string, unknown> | null | undefined) {
  if (!row) return null;

  return {
    maxActiveWorkspaces:
      typeof row.max_active_workspaces === "number" ? row.max_active_workspaces : null,
    maxActiveStaffSeats:
      typeof row.max_active_staff_seats === "number" ? row.max_active_staff_seats : null,
    activeWorkspaceCount: 0,
    activeStaffCount: 0,
    hasPersonnelModule: row.has_personnel_module === true,
    hasTaskTracking: row.has_task_tracking === true,
    hasAnnouncements: row.has_announcements === true,
  } satisfies OsgbUsageSnapshot;
}

export async function requireOsgbManagerContext(): Promise<OsgbManagerContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accountContext = await getAccountContextForUser(user.id);

  if (accountContext.isPlatformAdmin) {
    redirect("/platform-admin");
  }

  if (accountContext.accountType !== "osgb" || !accountContext.organizationId) {
    redirect(resolvePostLoginPath(accountContext));
  }

  if (!hasOsgbManagementAccess(accountContext)) {
    redirect("/companies");
  }

  const service = createServiceClient();

  const [
    { data: usageRows, error: usageError },
    { data: workspaceCountRows, error: workspaceCountError },
    { data: staffCountRows, error: staffCountError },
    { data: companyRows, error: companyError },
  ] = await Promise.all([
    service.rpc("current_plan_limits", {
      p_organization_id: accountContext.organizationId,
    }),
    service.rpc("active_company_workspace_count", {
      p_organization_id: accountContext.organizationId,
    }),
    service.rpc("active_account_staff_count", {
      p_organization_id: accountContext.organizationId,
    }),
    service
      .from("company_workspaces")
      .select(
        `
        id,
        company_identity_id,
        display_name,
        slug,
        is_archived,
        company_identities!inner (
          official_name,
          sector,
          hazard_class,
          city,
          is_archived,
          deleted_at
        )
      `,
      )
      .eq("organization_id", accountContext.organizationId)
      .eq("is_archived", false)
      .eq("company_identities.is_archived", false)
      .is("company_identities.deleted_at", null)
      .order("display_name", { ascending: true }),
  ]);

  for (const error of [usageError, workspaceCountError, staffCountError, companyError]) {
    if (error && !isCompatError(error.message)) {
      throw new Error(error.message);
    }
  }

  const usageBase = normalizeUsageRow(
    Array.isArray(usageRows)
      ? ((usageRows[0] ?? null) as Record<string, unknown> | null)
      : ((usageRows ?? null) as Record<string, unknown> | null),
  );

  const activeWorkspaceCount = Number(
    Array.isArray(workspaceCountRows)
      ? workspaceCountRows[0] ?? 0
      : workspaceCountRows ?? 0,
  );
  const activeStaffCount = Number(
    Array.isArray(staffCountRows)
      ? staffCountRows[0] ?? 0
      : staffCountRows ?? 0,
  );

  const usage =
    usageBase === null
      ? null
      : {
          ...usageBase,
          activeWorkspaceCount,
          activeStaffCount,
        };

  const companies: OsgbCompanyOption[] = ((companyRows ?? []) as Array<{
    id: string;
    company_identity_id: string;
    display_name: string | null;
    slug: string | null;
    company_identities:
      | {
          official_name: string | null;
          sector: string | null;
          hazard_class: string | null;
          city: string | null;
        }
      | Array<{
          official_name: string | null;
          sector: string | null;
          hazard_class: string | null;
          city: string | null;
        }>;
  }>).map((row) => {
    const identity = Array.isArray(row.company_identities)
      ? row.company_identities[0]
      : row.company_identities;

    return {
      workspaceId: row.id,
      companyIdentityId: row.company_identity_id,
      displayName: row.display_name || identity?.official_name || "Yeni firma",
      officialName: identity?.official_name || row.display_name || "Yeni firma",
      slug: row.slug ?? null,
      sector: identity?.sector ?? null,
      hazardClass: identity?.hazard_class ?? null,
      city: identity?.city ?? null,
    };
  });

  return {
    userId: user.id,
    organizationId: accountContext.organizationId,
    organizationName: accountContext.organizationName || "OSGB hesabi",
    usage,
    companies,
  };
}

export function resolveWorkspaceFilter(
  companies: OsgbCompanyOption[],
  workspaceId?: string | null,
) {
  if (!workspaceId) {
    return null;
  }

  return companies.find((company) => company.workspaceId === workspaceId) ?? null;
}

export function buildWorkspaceHref(company: Pick<OsgbCompanyOption, "slug" | "workspaceId">) {
  return `/workspace/${company.slug || company.workspaceId}`;
}
