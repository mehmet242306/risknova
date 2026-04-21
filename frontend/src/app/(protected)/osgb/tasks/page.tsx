import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { OsgbPanel, OsgbScopeBar, OsgbStatCard } from "@/components/osgb/OsgbPageChrome";
import { OsgbTasksBoardClient } from "./OsgbTasksBoardClient";
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

type TaskProfile = {
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
};

export default async function OsgbTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const manager = await requireOsgbManagerContext();
  const service = createServiceClient();
  const selectedCompany = resolveWorkspaceFilter(manager.companies, params.workspaceId);

  const [
    { data: taskRows, error: taskError },
    { data: assignmentRows, error: assignmentError },
  ] = await Promise.all([
    service
      .from("workspace_tasks")
      .select("id, title, description, status, priority, due_date, company_workspace_id, created_at")
      .eq("organization_id", manager.organizationId)
      .order("due_date", { ascending: true }),
    service
      .from("workspace_assignments")
      .select("user_id, company_workspace_id, professional_role")
      .eq("organization_id", manager.organizationId)
      .eq("assignment_status", "active"),
  ]);

  for (const error of [taskError, assignmentError]) {
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

  const profileIds = Array.from(
    new Set(
      [
        ...((taskAssignmentRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
        ...((assignmentRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
      ].filter(Boolean),
    ),
  );

  const { data: profileRows, error: profileError } =
    profileIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("user_profiles")
          .select("auth_user_id, full_name, email")
          .in("auth_user_id", profileIds);

  if (profileError && !isCompatError(profileError.message)) {
    throw new Error(profileError.message);
  }

  const profileMap = new Map(
    ((profileRows ?? []) as TaskProfile[]).map((row) => [row.auth_user_id, row]),
  );

  const assigneesByTask = new Map<string, string[]>();
  for (const row of (taskAssignmentRows ?? []) as Array<{ task_id: string; user_id: string }>) {
    const next = assigneesByTask.get(row.task_id) ?? [];
    next.push(
      profileMap.get(row.user_id)?.full_name ||
        profileMap.get(row.user_id)?.email ||
        "Isimsiz personel",
    );
    assigneesByTask.set(row.task_id, next);
  }

  const companyMap = new Map(
    manager.companies.map((company) => [company.workspaceId, company]),
  );

  const visibleTasks = ((taskRows ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string | null;
    due_date: string | null;
    company_workspace_id: string | null;
    created_at: string;
  }>)
    .filter((task) =>
      selectedCompany ? task.company_workspace_id === selectedCompany.workspaceId : true,
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      company: task.company_workspace_id ? companyMap.get(task.company_workspace_id) ?? null : null,
      assignees: assigneesByTask.get(task.id) ?? [],
    }));

  const personnelByUser = new Map<
    string,
    {
      userId: string;
      label: string;
      professionalRole: string | null;
      workspaceIds: Set<string>;
    }
  >();

  for (const row of (assignmentRows ?? []) as Array<{
    user_id: string;
    company_workspace_id: string;
    professional_role: string | null;
  }>) {
    const company = companyMap.get(row.company_workspace_id);
    if (!company) continue;

    const profile = profileMap.get(row.user_id);
    const current = personnelByUser.get(row.user_id) ?? {
      userId: row.user_id,
      label: profile?.full_name || profile?.email || "Isimsiz personel",
      professionalRole: row.professional_role,
      workspaceIds: new Set<string>(),
    };

    current.workspaceIds.add(row.company_workspace_id);
    if (!current.professionalRole && row.professional_role) {
      current.professionalRole = row.professional_role;
    }
    personnelByUser.set(row.user_id, current);
  }

  const personnelOptions = Array.from(personnelByUser.values())
    .map((person) => ({
      userId: person.userId,
      label: person.label,
      professionalRole: person.professionalRole,
      workspaceIds: Array.from(person.workspaceIds),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "tr"));

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = visibleTasks.filter(
    (task) =>
      (task.status === "open" || task.status === "in_progress") &&
      task.dueDate &&
      task.dueDate < today,
  ).length;
  const openCount = visibleTasks.filter((task) => task.status === "open").length;
  const inProgressCount = visibleTasks.filter((task) => task.status === "in_progress").length;
  const doneCount = visibleTasks.filter((task) => task.status === "done").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OSGB Is Takibi"
        title="Operasyon ve gorev havuzu"
        description="Gorev, kanit, sorumlu, son tarih ve firma baglamini ayni ekranda toplayan OSGB operasyon gorunumu."
        actions={
          <>
            <Link
              href={
                selectedCompany
                  ? `/osgb/assignments?workspaceId=${selectedCompany.workspaceId}`
                  : "/osgb/assignments"
              }
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Gorevlendirmeleri ac
            </Link>
            <Link
              href={
                selectedCompany
                  ? `/solution-center?surface=osgb-manager&workspaceId=${selectedCompany.workspaceId}`
                  : "/solution-center?surface=osgb-manager"
              }
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Nova OSGB Manager
            </Link>
          </>
        }
      />

      <OsgbScopeBar
        companies={manager.companies}
        selectedWorkspaceId={selectedCompany?.workspaceId}
        basePath="/osgb/tasks"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OsgbStatCard
          title="Acik gorev"
          value={openCount}
          description="Heniz isleme alinmamis gorevler. Nova bunlari oncelik ve firma riskine gore siralar."
        />
        <OsgbStatCard
          title="Islemde"
          value={inProgressCount}
          description="Devam eden operasyon, DOF veya belge hazirlik gorevleri."
          accent="text-primary"
        />
        <OsgbStatCard
          title="Geciken is"
          value={overdueCount}
          description="Takip tarihi gecmis gorevler. Denetim ve hizmet SLA riski olusturur."
          accent="text-danger"
        />
        <OsgbStatCard
          title="Tamamlanan"
          value={doneCount}
          description="Kapatilan ve kanit zinciri tamamlanan isler."
          accent="text-success"
        />
      </div>

      <OsgbPanel
        title="Gorev merkezi"
        description={
          selectedCompany
            ? `${selectedCompany.displayName} firmasina ait gorevler, atanan personel ve son tarihler.`
            : "Tum firmalardaki gorevler. Firma, gorevlendirme ve dokuman akislarini birlikte izlemek icin filtreleyebilirsin."
        }
      >
        <OsgbTasksBoardClient
          companies={manager.companies.map((company) => ({
            workspaceId: company.workspaceId,
            displayName: company.displayName,
          }))}
          selectedWorkspaceId={selectedCompany?.workspaceId}
          personnelOptions={personnelOptions}
          tasks={visibleTasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            company: task.company
              ? {
                  workspaceId: task.company.workspaceId,
                  displayName: task.company.displayName,
                  workspaceHref: buildWorkspaceHref(task.company),
                }
              : null,
            assignees: task.assignees,
          }))}
        />
      </OsgbPanel>
    </div>
  );
}
