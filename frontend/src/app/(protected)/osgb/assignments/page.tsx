import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { OsgbEmpty, OsgbPanel, OsgbScopeBar, OsgbStatCard } from "@/components/osgb/OsgbPageChrome";
import { OsgbAssignmentsBoardClient } from "./OsgbAssignmentsBoardClient";
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

export default async function OsgbAssignmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const manager = await requireOsgbManagerContext();
  const service = createServiceClient();
  const selectedCompany = resolveWorkspaceFilter(manager.companies, params.workspaceId);

  const { data: assignmentRows, error: assignmentError } = await service
    .from("workspace_assignments")
    .select(
      "id, user_id, company_workspace_id, professional_role, assignment_status, can_view, can_create_risk, can_edit_risk, can_approve, can_sign, starts_on, ends_on, created_at",
    )
    .eq("organization_id", manager.organizationId)
    .order("created_at", { ascending: false });

  if (assignmentError && !isCompatError(assignmentError.message)) {
    throw new Error(assignmentError.message);
  }

  const authUserIds = Array.from(
    new Set(
      ((assignmentRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
    ),
  );

  const { data: profileRows, error: profileError } =
    authUserIds.length === 0
      ? { data: [], error: null }
      : await service
          .from("user_profiles")
          .select("auth_user_id, full_name, email, title")
          .in("auth_user_id", authUserIds);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileMap = new Map(
    ((profileRows ?? []) as Array<{
      auth_user_id: string;
      full_name: string | null;
      email: string | null;
      title: string | null;
    }>).map((row) => [row.auth_user_id, row]),
  );

  const companyMap = new Map(
    manager.companies.map((company) => [company.workspaceId, company]),
  );

  const visibleAssignments = ((assignmentRows ?? []) as Array<{
    id: string;
    user_id: string;
    company_workspace_id: string;
    professional_role: string;
    assignment_status: string;
    can_view: boolean;
    can_create_risk: boolean;
    can_edit_risk: boolean;
    can_approve: boolean;
    can_sign: boolean;
    starts_on: string | null;
    ends_on: string | null;
  }>)
    .filter((row) =>
      selectedCompany ? row.company_workspace_id === selectedCompany.workspaceId : true,
    )
    .map((row) => ({
      ...row,
      profile: profileMap.get(row.user_id) ?? null,
      company: companyMap.get(row.company_workspace_id) ?? null,
    }));

  const activeAssignments = visibleAssignments.filter(
    (row) => row.assignment_status === "active",
  ).length;
  const criticalAssignments = visibleAssignments.filter(
    (row) => !row.can_edit_risk || !row.can_create_risk,
  ).length;
  const signCapableAssignments = visibleAssignments.filter((row) => row.can_sign).length;
  const approvalCapableAssignments = visibleAssignments.filter((row) => row.can_approve).length;
  const suspendedAssignments = visibleAssignments.filter(
    (row) => row.assignment_status === "suspended",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OSGB Gorevlendirmeler"
        title="Firma bazli personel atamalari"
        description="Her profesyonelin hangi firmada, hangi rol ve hangi izinle calistigini merkezi olarak yonetin."
        actions={
          <>
            <Link
              href={
                selectedCompany
                  ? `${buildWorkspaceHref(selectedCompany)}?tab=organization`
                  : "/osgb/firms"
              }
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Firma organizasyonu
            </Link>
            <Link
              href={
                selectedCompany
                  ? `/osgb/personnel?workspaceId=${selectedCompany.workspaceId}`
                  : "/osgb/personnel"
              }
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Personel havuzuna don
            </Link>
          </>
        }
      />

      <OsgbScopeBar
        companies={manager.companies}
        selectedWorkspaceId={selectedCompany?.workspaceId}
        basePath="/osgb/assignments"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OsgbStatCard
          title="Aktif atama"
          value={activeAssignments}
          description="Firma bazli aktif uzman, hekim ve DSP atamalarinin toplam sayisi."
        />
        <OsgbStatCard
          title="Imza yetkisi"
          value={signCapableAssignments}
          description="Sozlesme, rapor veya onay akisi icin imza yetkisi tanimli kayitlar."
        />
        <OsgbStatCard
          title="Onay yetkisi"
          value={approvalCapableAssignments}
          description="Risk ya da operasyon akisinda onay verebilen aktif personel atamalari."
        />
        <OsgbStatCard
          title="Askida / kritik"
          value={`${suspendedAssignments} / ${criticalAssignments}`}
          description="Askiya alinmis ve yetki seti eksik oldugu icin yonetici kontrolu gereken atamalar."
          accent={
            suspendedAssignments > 0 || criticalAssignments > 0
              ? "text-danger"
              : "text-success"
          }
        />
      </div>

      <OsgbPanel
        title="Yetki matrisi"
        description="Ayni firma icin birden fazla uzman calisabilir. Erisim haklari personelin kendi hesabi uzerinden yalnizca atandigi workspace verilerine acilir."
      >
        {visibleAssignments.length === 0 ? (
          <OsgbEmpty
            title="Aktif gorevlendirme bulunamadi"
            description="Secili kapsama ait aktif atama yok. Personel havuzu ve firma organizasyonu uzerinden yeni gorevlendirme acabilirsin."
            action={
              <Link
                href={
                  selectedCompany
                    ? `/osgb/personnel?workspaceId=${selectedCompany.workspaceId}`
                    : "/osgb/personnel"
                }
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Personel havuzunu ac
              </Link>
            }
          />
        ) : (
          <OsgbAssignmentsBoardClient
            assignments={visibleAssignments.map((assignment) => ({
              id: assignment.id,
              userId: assignment.user_id,
              professionalRole: assignment.professional_role,
              assignmentStatus: assignment.assignment_status,
              canView: assignment.can_view,
              canCreateRisk: assignment.can_create_risk,
              canEditRisk: assignment.can_edit_risk,
              canApprove: assignment.can_approve,
              canSign: assignment.can_sign,
              startsOn: assignment.starts_on,
              endsOn: assignment.ends_on,
              profile: assignment.profile
                ? {
                    fullName: assignment.profile.full_name,
                    email: assignment.profile.email,
                    title: assignment.profile.title,
                  }
                : null,
              company: assignment.company
                ? {
                    workspaceId: assignment.company.workspaceId,
                    displayName: assignment.company.displayName,
                    workspaceHref: buildWorkspaceHref(assignment.company),
                  }
                : null,
            }))}
          />
        )}
      </OsgbPanel>
    </div>
  );
}
