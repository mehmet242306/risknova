import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { OsgbEmpty, OsgbPanel, OsgbScopeBar, OsgbStatCard } from "@/components/osgb/OsgbPageChrome";
import { OsgbPersonnelInviteCard } from "./OsgbPersonnelInviteCard";
import {
  buildWorkspaceHref,
  isCompatError,
  requireOsgbManagerContext,
  resolveWorkspaceFilter,
} from "@/lib/osgb/server";
import { createServiceClient } from "@/lib/security/server";

type SearchParams = Promise<{
  workspaceId?: string;
}>;

type MembershipRole = "owner" | "admin" | "staff" | "viewer";

type PersonnelRow = {
  userId: string;
  fullName: string;
  email: string | null;
  title: string | null;
  membershipRole: MembershipRole;
  professionalRole: string | null;
  assignmentCount: number;
  companyCount: number;
  openTasks: number;
  overdueTasks: number;
  companies: Array<{ workspaceId: string; name: string }>;
};

function mapLegacyRoleCodeToMembershipRole(code: string): MembershipRole {
  if (["super_admin", "platform_admin", "organization_admin", "osgb_manager"].includes(code)) {
    return "admin";
  }

  if (code === "viewer") {
    return "viewer";
  }

  return "staff";
}

function mapMembershipRoleLabel(role: MembershipRole) {
  switch (role) {
    case "owner":
      return "Sahip";
    case "admin":
      return "Yonetici";
    case "viewer":
      return "Goruntuleyici";
    default:
      return "Personel";
  }
}

function mapProfessionalRoleLabel(role: string | null) {
  switch (role) {
    case "isg_uzmani":
      return "Is Guvenligi Uzmani";
    case "isyeri_hekimi":
      return "Isyeri Hekimi";
    case "diger_saglik_personeli":
      return "Diger Saglik Personeli";
    case "operasyon_sorumlusu":
      return "Operasyon Sorumlusu";
    case "viewer":
      return "Gozlemci";
    default:
      return "Atama bekliyor";
  }
}

function roleAccent(role: MembershipRole) {
  if (role === "owner" || role === "admin") return "text-primary";
  if (role === "viewer") return "text-muted-foreground";
  return "text-foreground";
}

export default async function OsgbPersonnelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const manager = await requireOsgbManagerContext();
  const service = createServiceClient();
  const selectedCompany = resolveWorkspaceFilter(manager.companies, params.workspaceId);

  const { data: profileRows, error: profileError } = await service
    .from("user_profiles")
    .select("id, auth_user_id, full_name, email, title")
    .eq("organization_id", manager.organizationId)
    .order("full_name", { ascending: true });

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileIds = (profileRows ?? []).map((row) => row.id);
  const authUserIds = (profileRows ?? []).map((row) => row.auth_user_id).filter(Boolean);

  const [
    { data: membershipRows, error: membershipError },
    { data: legacyRoleRows, error: legacyRoleError },
    { data: assignmentRows, error: assignmentError },
    { data: taskRows, error: taskError },
  ] = await Promise.all([
    service
      .from("organization_memberships")
      .select("user_id, role, status")
      .eq("organization_id", manager.organizationId)
      .eq("status", "active"),
    profileIds.length > 0
      ? service
          .from("user_roles")
          .select("user_profile_id, roles(code)")
          .in("user_profile_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    service
      .from("workspace_assignments")
      .select(
        "user_id, company_workspace_id, professional_role, assignment_status, starts_on, ends_on, can_create_risk, can_edit_risk, can_approve, can_sign",
      )
      .eq("organization_id", manager.organizationId)
      .eq("assignment_status", "active")
      .order("starts_on", { ascending: true }),
    service
      .from("workspace_tasks")
      .select("id, title, status, due_date, company_workspace_id")
      .eq("organization_id", manager.organizationId)
      .order("due_date", { ascending: true }),
  ]);

  for (const error of [membershipError, legacyRoleError, assignmentError, taskError]) {
    if (error && !isCompatError(error.message)) {
      throw new Error(error.message);
    }
  }

  const taskIds = ((taskRows ?? []) as Array<{ id: string }>).map((task) => task.id);
  const { data: taskAssignmentRows, error: taskAssignmentError } =
    taskIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("workspace_task_assignments")
          .select("task_id, user_id")
          .in("task_id", taskIds);

  if (taskAssignmentError && !isCompatError(taskAssignmentError.message)) {
    throw new Error(taskAssignmentError.message);
  }

  const membershipRoleByUser = new Map<string, MembershipRole>();
  for (const row of (membershipRows ?? []) as Array<{ user_id: string; role: MembershipRole }>) {
    membershipRoleByUser.set(row.user_id, row.role);
  }

  const legacyRoleCodeByProfile = new Map<string, string[]>();
  for (const row of (legacyRoleRows ?? []) as Array<{
    user_profile_id: string;
    roles?: { code?: string } | Array<{ code?: string }> | null;
  }>) {
    const flattened = Array.isArray(row.roles)
      ? row.roles
          .map((item) => String(item?.code ?? "").trim().toLowerCase())
          .filter(Boolean)
      : [String(row.roles?.code ?? "").trim().toLowerCase()].filter(Boolean);
    legacyRoleCodeByProfile.set(row.user_profile_id, flattened);
  }

  const companyMap = new Map(
    manager.companies.map((company) => [company.workspaceId, company]),
  );

  const assignmentsByUser = new Map<
    string,
    Array<{
      companyWorkspaceId: string;
      professionalRole: string;
      canApprove: boolean;
      canSign: boolean;
    }>
  >();

  for (const row of (assignmentRows ?? []) as Array<{
    user_id: string;
    company_workspace_id: string;
    professional_role: string;
    can_approve: boolean;
    can_sign: boolean;
  }>) {
    if (selectedCompany && row.company_workspace_id !== selectedCompany.workspaceId) {
      continue;
    }

    const next = assignmentsByUser.get(row.user_id) ?? [];
    next.push({
      companyWorkspaceId: row.company_workspace_id,
      professionalRole: row.professional_role,
      canApprove: row.can_approve,
      canSign: row.can_sign,
    });
    assignmentsByUser.set(row.user_id, next);
  }

  const taskMap = new Map(
    ((taskRows ?? []) as Array<{
      id: string;
      status: string;
      due_date: string | null;
      company_workspace_id: string | null;
    }>)
      .filter((task) =>
        selectedCompany ? task.company_workspace_id === selectedCompany.workspaceId : true,
      )
      .map((task) => [task.id, task]),
  );

  const taskSummaryByUser = new Map<string, { open: number; overdue: number }>();
  for (const row of (taskAssignmentRows ?? []) as Array<{ task_id: string; user_id: string }>) {
    const task = taskMap.get(row.task_id);
    if (!task) continue;

    const next = taskSummaryByUser.get(row.user_id) ?? { open: 0, overdue: 0 };
    if (task.status === "open" || task.status === "in_progress") {
      next.open += 1;
      if (task.due_date && task.due_date < new Date().toISOString().slice(0, 10)) {
        next.overdue += 1;
      }
    }
    taskSummaryByUser.set(row.user_id, next);
  }

  const personnelRows: PersonnelRow[] = ((profileRows ?? []) as Array<{
    id: string;
    auth_user_id: string | null;
    full_name: string | null;
    email: string | null;
    title: string | null;
  }>)
    .map((profile) => {
      const userId = profile.auth_user_id;
      if (!userId) {
        return null;
      }

      const legacyCodes = legacyRoleCodeByProfile.get(profile.id) ?? [];
      const assignments = assignmentsByUser.get(userId) ?? [];
      const taskSummary = taskSummaryByUser.get(userId) ?? { open: 0, overdue: 0 };
      const firstProfessionalRole = assignments[0]?.professionalRole ?? null;
      const companyNames = assignments
        .map((assignment) => companyMap.get(assignment.companyWorkspaceId))
        .filter(Boolean)
        .map((company) => ({
          workspaceId: company!.workspaceId,
          name: company!.displayName,
        }));

      const membershipRole =
        membershipRoleByUser.get(userId) ??
        (legacyCodes[0] ? mapLegacyRoleCodeToMembershipRole(legacyCodes[0]) : "staff");

      return {
        userId,
        fullName: profile.full_name || profile.email || "Isimsiz personel",
        email: profile.email,
        title: profile.title,
        membershipRole,
        professionalRole: firstProfessionalRole,
        assignmentCount: assignments.length,
        companyCount: new Set(companyNames.map((company) => company.workspaceId)).size,
        openTasks: taskSummary.open,
        overdueTasks: taskSummary.overdue,
        companies: companyNames.slice(0, 3),
      } satisfies PersonnelRow;
    })
    .filter(Boolean)
    .filter((row) => (selectedCompany ? row!.assignmentCount > 0 : true))
    .sort((left, right) => right!.assignmentCount - left!.assignmentCount) as PersonnelRow[];

  const seatLimitReached = Boolean(
    manager.usage?.maxActiveStaffSeats !== null &&
      manager.usage?.maxActiveStaffSeats !== undefined &&
      manager.usage.activeStaffCount >= manager.usage.maxActiveStaffSeats,
  );

  const selectedCompanyWorkspaceHref = selectedCompany
    ? `${buildWorkspaceHref(selectedCompany)}?tab=organization`
    : "/osgb/firms";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OSGB Personel Yonetimi"
        title="Personeller ve profesyonel havuzu"
        description="OSGB personellerini, atandiklari firmalari, acik is yuklerini ve ilk giris akislarini tek merkezden yonetin."
        actions={
          <>
            <Link
              href={selectedCompanyWorkspaceHref}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Firma organizasyonu ac
            </Link>
            <Link
              href={selectedCompany ? `/osgb/assignments?workspaceId=${selectedCompany.workspaceId}` : "/osgb/assignments"}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Gorevlendirmeleri yonet
            </Link>
          </>
        }
      />

      <OsgbScopeBar
        companies={manager.companies}
        selectedWorkspaceId={selectedCompany?.workspaceId}
        basePath="/osgb/personnel"
      />

      <OsgbPersonnelInviteCard
        companies={manager.companies.map((company) => ({
          workspaceId: company.workspaceId,
          displayName: company.displayName,
        }))}
        selectedWorkspaceId={selectedCompany?.workspaceId}
        usage={
          manager.usage
            ? {
                maxActiveStaffSeats: manager.usage.maxActiveStaffSeats,
                activeStaffCount: manager.usage.activeStaffCount,
              }
            : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OsgbStatCard
          title="Aktif personel"
          value={
            manager.usage?.maxActiveStaffSeats
              ? `${manager.usage.activeStaffCount} / ${manager.usage.maxActiveStaffSeats}`
              : manager.usage?.activeStaffCount ?? personnelRows.length
          }
          description="OSGB hesabina bagli aktif oturum sahibi personel sayisi ve paket limiti."
          accent={seatLimitReached ? "text-danger" : "text-foreground"}
        />
        <OsgbStatCard
          title="Atama alan personel"
          value={personnelRows.filter((row) => row.assignmentCount > 0).length}
          description="En az bir firmaya aktif olarak atanmis uzman, hekim veya DSP kayitlari."
        />
        <OsgbStatCard
          title="Acik gorev"
          value={personnelRows.reduce((sum, row) => sum + row.openTasks, 0)}
          description="Personellere atanmis acik ve islemde gorevlerin toplam gorunumu."
        />
        <OsgbStatCard
          title="Geciken gorev"
          value={personnelRows.reduce((sum, row) => sum + row.overdueTasks, 0)}
          description="Takip tarihi gecmis gorevler. Nova OSGB Manager bu alanlari one cikarir."
          accent="text-danger"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <OsgbPanel
          title="Davet ve ilk giris akisi"
          description="Yeni personel once OSGB oturum koltuguna dahil edilir, sonra ilgili firmalara atanir. Davet maili firma/rol bilgisiyle gider; kullaniciya gecici giris bilgisi veya sifre yenileme talimati iletilir ve ilk giriste sifresini degistirmesi beklenir."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">1. Oturum / seat kontrolu</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Personel eklemeden once aktif seat limiti kontrol edilir. Limit doldugunda yeni oturum acmak yerine mevcut personeli pasife almak ya da paketi buyutmek gerekir.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">2. Mail ile gorevlendirme</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Davet edilen kisiye kullanici adi, gecici sifre veya sifre yenileme yonlendirmesi e-posta ile gider. Ilk giristen sonra sifresini yenilemesi ve sonra firma atamalarini kabul etmesi gerekir.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">3. Firma bazli atama</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Personel merkezi OSGB kadrosunda tutulur, erisim ise yalnizca atandigi firma workspace uzerinden acilir. Ayni uzman birden fazla firmaya, ayni firma da birden fazla uzmana baglanabilir.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-foreground">4. Ilk adim</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Daveti bu sayfadan baslat, daha detayli ekip ve paylasim ayarlari icin secili firmanin organizasyon sekmesine gec. Sonrasinda bu yuzey personelin firma yukunu, gorev durumunu ve gecikmelerini merkezi olarak izleyecek.
              </p>
              <Link
                href={selectedCompanyWorkspaceHref}
                className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Organizasyon sekmesine git
              </Link>
            </div>
          </div>
        </OsgbPanel>

        <OsgbPanel
          title="Nova OSGB Manager odagi"
          description="Nova bu yuzeyde profesyonel asistandan farkli davranir; personel yukunu, firma atamalarini ve gecikmeleri analiz eder."
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Hangi uzmanın gorev yuku arttigini gor.</li>
            <li>Atanmis ama gorev almayan personeli ayikla.</li>
            <li>Seat limiti dolmadan once yeni davet ihtiyacini planla.</li>
            <li>Firma bazli uzman, hekim ve DSP bosluklarini raporla.</li>
          </ul>
        </OsgbPanel>
      </div>

      <OsgbPanel
        title="OSGB personel listesi"
        description={
          selectedCompany
            ? `${selectedCompany.displayName} firmasina atanan personeller ve ilgili gorev yukleri.`
            : "OSGB hesabina bagli personeller, firma sayilari ve gorev durumlari."
        }
      >
        {personnelRows.length === 0 ? (
          <OsgbEmpty
            title="Personel kaydi bulunamadi"
            description="OSGB personel havuzu bos. Firma organizasyon sekmesinden ilk daveti gondererek uzman, hekim veya DSP ekleyebilirsin."
            action={
              <Link
                href={selectedCompanyWorkspaceHref}
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Firma organizasyonuna git
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {personnelRows.map((row) => (
              <article
                key={row.userId}
                className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{row.fullName}</h3>
                      <span
                        className={`rounded-full border border-border px-2.5 py-1 text-xs font-semibold ${roleAccent(
                          row.membershipRole,
                        )}`}
                      >
                        {mapMembershipRoleLabel(row.membershipRole)}
                      </span>
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        {mapProfessionalRoleLabel(row.professionalRole)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {row.title || "Unvan tanimsiz"}
                      {row.email ? ` · ${row.email}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border px-3 py-1">
                        {row.companyCount} firma
                      </span>
                      <span className="rounded-full border border-border px-3 py-1">
                        {row.assignmentCount} aktif atama
                      </span>
                      <span className="rounded-full border border-border px-3 py-1">
                        {row.openTasks} acik gorev
                      </span>
                      <span className="rounded-full border border-border px-3 py-1 text-danger">
                        {row.overdueTasks} geciken gorev
                      </span>
                    </div>
                    {row.companies.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {row.companies.map((company) => (
                          <Link
                            key={`${row.userId}-${company.workspaceId}`}
                            href={`/osgb/assignments?workspaceId=${company.workspaceId}`}
                            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
                          >
                            {company.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link
                      href={selectedCompany ? `/osgb/assignments?workspaceId=${selectedCompany.workspaceId}` : "/osgb/assignments"}
                      className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      Atamalari gor
                    </Link>
                    <Link
                      href={selectedCompany ? `/osgb/tasks?workspaceId=${selectedCompany.workspaceId}` : "/osgb/tasks"}
                      className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      Gorevleri gor
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </OsgbPanel>
    </div>
  );
}
