import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { defaultLocale, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/security/server";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
  type AccountType,
} from "@/lib/account/account-routing";
import { getDemoAccessState } from "@/lib/platform-admin/demo-access";
import { DemoBuilderClient } from "./DemoBuilderClient";
import { DemoGroupsClient, type DemoAccountCard, type DemoGroups } from "./DemoGroupsClient";

type DemoOrganizationRow = {
  id: string;
  name: string;
  account_type: AccountType | null;
};

type DemoOrganizationKindRow = {
  id: string;
  organization_type: AccountType | null;
};

type DemoWorkspaceRow = {
  organization_id: string;
};

type DemoProfileRow = {
  auth_user_id: string | null;
  organization_id: string | null;
  full_name: string | null;
  email: string | null;
  created_at: string | null;
};

type UserPreferenceRow = {
  user_id: string;
  language: string | null;
};

const EMPTY_DEMO_GROUPS: DemoGroups = {
  individual: [],
  osgb: [],
  enterprise: [],
};

function isCompatDataError(message: string | null | undefined) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("column") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  try {
    const { data, error } = await query;
    if (error) {
      if (isCompatDataError(error.message)) return [];
      return [];
    }

    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

function normalizeAccountType(value: unknown): AccountType {
  if (value === "osgb" || value === "enterprise") return value;
  return "individual";
}

function inferDemoAccountType(input: {
  organizationAccountType?: unknown;
  organizationType?: unknown;
  demoAccountType?: unknown;
  organizationName?: string | null;
  fullName?: string | null;
  email?: string | null;
}): AccountType {
  if (input.demoAccountType === "osgb" || input.demoAccountType === "enterprise") {
    return input.demoAccountType;
  }

  const haystack = [input.organizationName, input.fullName, input.email]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  if (haystack.includes("osgb")) return "osgb";
  if (
    haystack.includes("kurumsal") ||
    haystack.includes("enterprise") ||
    haystack.includes("corporate")
  ) {
    return "enterprise";
  }

  if (input.organizationType === "osgb" || input.organizationType === "enterprise") {
    return input.organizationType;
  }

  return normalizeAccountType(input.organizationAccountType);
}

async function fetchDemoGroups(): Promise<DemoGroups> {
  const service = createServiceClient();
  const demoUsers: Array<{
    id: string;
    email?: string | null;
    created_at?: string | null;
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
  }> = [];

  try {
    let page = 1;
    const perPage = 200;

    while (page <= 10) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage });
      if (error) break;

      const currentUsers = data?.users ?? [];
      if (currentUsers.length === 0) break;

      demoUsers.push(
        ...currentUsers.filter(
          (user) =>
            user.app_metadata?.demo_mode === true || user.user_metadata?.demo_mode === true,
        ),
      );

      if (currentUsers.length < perPage) break;
      page += 1;
    }
  } catch {
    return EMPTY_DEMO_GROUPS;
  }

  const heuristicProfiles = await safeRows<DemoProfileRow>(
    service
      .from("user_profiles")
      .select("auth_user_id, organization_id, full_name, email, created_at")
      .or("email.ilike.%demo%,full_name.ilike.%demo%"),
  );

  const organizationIds = Array.from(
    new Set(
      [
        ...demoUsers.map((user) =>
          String(user.app_metadata?.organization_id ?? user.user_metadata?.organization_id ?? ""),
        ),
        ...heuristicProfiles.map((profile) => String(profile.organization_id ?? "")),
      ].filter(Boolean),
    ),
  );

  if (demoUsers.length === 0 && organizationIds.length === 0) {
    return EMPTY_DEMO_GROUPS;
  }

  const [organizationRows, organizationKindRows, workspaceRows, preferenceRows] = await Promise.all([
    organizationIds.length
      ? safeRows<DemoOrganizationRow>(
          service
            .from("organizations")
            .select("id, name, account_type")
            .in("id", organizationIds),
        )
      : Promise.resolve([]),
    organizationIds.length
      ? safeRows<DemoOrganizationKindRow>(
          service
            .from("organizations")
            .select("id, organization_type")
            .in("id", organizationIds),
        )
      : Promise.resolve([]),
    organizationIds.length
      ? safeRows<DemoWorkspaceRow>(
          service
            .from("company_workspaces")
            .select("organization_id")
            .in("organization_id", organizationIds)
            .eq("status", "active"),
        )
      : Promise.resolve([]),
    demoUsers.length > 0
      ? safeRows<UserPreferenceRow>(
          service
            .from("user_preferences")
            .select("user_id, language")
            .in(
              "user_id",
              demoUsers.map((user) => user.id),
            ),
        )
      : Promise.resolve([]),
  ]);

  const organizationsById = new Map(organizationRows.map((row) => [row.id, row]));
  const organizationTypesById = new Map(organizationKindRows.map((row) => [row.id, row.organization_type]));
  const preferencesByUserId = new Map(preferenceRows.map((row) => [row.user_id, row.language]));
  const workspaceCounts = new Map<string, number>();
  for (const row of workspaceRows) {
    workspaceCounts.set(
      row.organization_id,
      (workspaceCounts.get(row.organization_id) ?? 0) + 1,
    );
  }

  const groups: DemoGroups = {
    individual: [],
    osgb: [],
    enterprise: [],
  };
  const seenUserIds = new Set<string>();

  for (const user of demoUsers) {
    const organizationId = String(
      user.app_metadata?.organization_id ?? user.user_metadata?.organization_id ?? "",
    );
    const organization = organizationId ? organizationsById.get(organizationId) : null;
    const accountType = inferDemoAccountType({
      organizationAccountType: organization?.account_type,
      organizationType: organizationId ? organizationTypesById.get(organizationId) : null,
      demoAccountType:
        user.app_metadata?.demo_account_type ?? user.user_metadata?.demo_account_type,
      organizationName: organization?.name,
      fullName: String(user.user_metadata?.full_name ?? ""),
      email: user.email ?? "",
    });
    const demoAccess = getDemoAccessState({
      userMetadata: user.user_metadata,
      appMetadata: user.app_metadata,
    });
    const locale = (
      preferencesByUserId.get(user.id) ??
      user.app_metadata?.preferred_locale ??
      user.user_metadata?.preferred_locale ??
      defaultLocale
    ) as Locale;

    seenUserIds.add(user.id);
    groups[accountType].push({
      userId: user.id,
      organizationId: organizationId || null,
      organizationName:
        organization?.name ||
        String(user.user_metadata?.organization_name ?? user.user_metadata?.full_name ?? "Demo hesap"),
      fullName: String(user.user_metadata?.full_name ?? user.email ?? "Demo kullanici"),
      email: user.email ?? "-",
      locale,
      accountType,
      createdAt: user.created_at || new Date().toISOString(),
      activeWorkspaceCount: organizationId ? workspaceCounts.get(organizationId) ?? 0 : 0,
      accessExpiresAt: demoAccess.accessExpiresAt,
      accessDisabledAt: demoAccess.accessDisabledAt,
      accessStatus: demoAccess.status === "not_demo" ? "active" : demoAccess.status,
    });
  }

  for (const profile of heuristicProfiles) {
    const userId = String(profile.auth_user_id ?? "");
    if (!userId || seenUserIds.has(userId)) continue;

    const organizationId = String(profile.organization_id ?? "");
    const organization = organizationId ? organizationsById.get(organizationId) : null;
    const nameLooksDemo = organization?.name?.toLowerCase().includes("demo") ?? false;
    const emailLooksDemo = String(profile.email ?? "").toLowerCase().includes("demo");
    const fullNameLooksDemo = String(profile.full_name ?? "").toLowerCase().includes("demo");

    if (!nameLooksDemo && !emailLooksDemo && !fullNameLooksDemo) {
      continue;
    }

    const accountType = inferDemoAccountType({
      organizationAccountType: organization?.account_type,
      organizationType: organizationId ? organizationTypesById.get(organizationId) : null,
      organizationName: organization?.name,
      fullName: profile.full_name,
      email: profile.email,
    });

    groups[accountType].push({
      userId,
      organizationId: organizationId || null,
      organizationName: organization?.name || profile.full_name || "Demo hesap",
      fullName: profile.full_name || profile.email || "Demo kullanici",
      email: profile.email || "-",
      locale: defaultLocale,
      accountType,
      createdAt: profile.created_at || new Date().toISOString(),
      activeWorkspaceCount: organizationId ? workspaceCounts.get(organizationId) ?? 0 : 0,
      accessExpiresAt: null,
      accessDisabledAt: null,
      accessStatus: "active",
    });
  }

  for (const groupKey of Object.keys(groups) as AccountType[]) {
    groups[groupKey].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
  }

  return groups;
}

export default async function PlatformAdminDemoBuilderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getAccountContextForUser(user.id);
  if (!context.isPlatformAdmin) {
    redirect(resolvePostLoginPath(context));
  }
  const demoGroups = await fetchDemoGroups();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Admin"
        title="Demo Olusturucu"
        description="Admin panelinden tek akista demo hesap, demo firma/workspace ve paylasilabilir giris bilgisi olustur."
        meta={
          <>
            <Badge variant="accent">Admin only</Badge>
            <Badge variant="neutral">Bireysel, OSGB, Kurumsal</Badge>
            <Badge variant="neutral">Mail varsa otomatik, yoksa onizleme</Badge>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7">
          <DemoBuilderClient />
        </div>

        <aside className="space-y-4">
          <InfoCard
            title="Ne olusturur?"
            description="Demo kullanici, hesap kapsami, varsayilan plan ve istenirse ilk firma/workspace ile ornek gorev ve dokuman."
          />
          <InfoCard
            title="Giris guvenligi"
            description="Her demo hesap icin gecici sifre uretilir. Ilk giriste sifre yenilemesi zorunludur."
          />
          <InfoCard
            title="Mail akisı"
            description="Resend tanimliysa giris bilgileri dogrudan e-posta ile gider. Tanimli degilse admin panelinde onizleme olarak gosterilir."
          />
        </aside>
      </section>

      <section className="space-y-4">
        <DemoGroupsClient demoGroups={demoGroups} />
      </section>
    </div>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}
