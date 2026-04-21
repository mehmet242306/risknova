import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { OsgbEmpty, OsgbPanel, OsgbScopeBar, OsgbStatCard } from "@/components/osgb/OsgbPageChrome";
import { getGroupByKey } from "@/lib/document-groups";
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

type ContractDocumentRow = {
  id: string;
  title: string;
  group_key: string;
  status: string;
  version: number;
  updated_at: string;
  company_workspace_id: string | null;
};

function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

function statusLabel(status: string) {
  if (status === "hazir") return "Hazir";
  if (status === "onay_bekliyor") return "Onay bekliyor";
  if (status === "revizyon") return "Revizyon";
  return "Taslak";
}

function buildNewContractDocumentHref(input: {
  title: string;
  companyId?: string | null;
}) {
  const params = new URLSearchParams({
    group: "personel-ozluk",
    title: input.title,
  });

  if (input.companyId) {
    params.set("companyId", input.companyId);
  }

  return `/documents/new?${params.toString()}`;
}

export default async function OsgbContractsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const manager = await requireOsgbManagerContext();
  const service = createServiceClient();
  const selectedCompany = resolveWorkspaceFilter(manager.companies, params.workspaceId);
  const personnelGroup = getGroupByKey("personel-ozluk");

  const [
    { data: documentRows, error: documentError },
    { data: assignmentRows, error: assignmentError },
  ] = await Promise.all([
    service
      .from("editor_documents")
      .select("id, title, group_key, status, version, updated_at, company_workspace_id")
      .eq("organization_id", manager.organizationId)
      .neq("status", "arsiv")
      .order("updated_at", { ascending: false }),
    service
      .from("workspace_assignments")
      .select("id, user_id, company_workspace_id, assignment_status, can_sign, can_approve")
      .eq("organization_id", manager.organizationId)
      .eq("assignment_status", "active"),
  ]);

  for (const error of [documentError, assignmentError]) {
    if (error && !isCompatError(error.message)) {
      throw new Error(error.message);
    }
  }

  const contractDocuments = ((documentRows ?? []) as ContractDocumentRow[])
    .filter((document) =>
      selectedCompany ? document.company_workspace_id === selectedCompany.workspaceId : true,
    )
    .filter((document) => {
      const normalized = normalizeTitle(document.title);
      return (
        document.group_key === "personel-ozluk" ||
        normalized.includes("sozlesme") ||
        normalized.includes("taahhut") ||
        normalized.includes("gorev tanim") ||
        normalized.includes("yetki")
      );
    });

  const expectedDocuments = (personnelGroup?.items ?? []).map((item) => item.title);
  const existingTitles = new Set(contractDocuments.map((document) => normalizeTitle(document.title)));
  const missingTemplates = expectedDocuments.filter(
    (title) => !existingTitles.has(normalizeTitle(title)),
  );

  const readyCount = contractDocuments.filter((document) => document.status === "hazir").length;
  const pendingCount = contractDocuments.filter(
    (document) => document.status === "onay_bekliyor",
  ).length;
  const revisionCount = contractDocuments.filter((document) => document.status === "revizyon").length;
  const relevantAssignments = ((assignmentRows ?? []) as Array<{
    id: string;
    user_id: string;
    company_workspace_id: string;
    can_sign: boolean;
    can_approve: boolean;
  }>).filter((row) =>
    selectedCompany ? row.company_workspace_id === selectedCompany.workspaceId : true,
  );
  const assignedPersonnelCount = new Set(relevantAssignments.map((row) => row.user_id)).size;
  const signCapableCount = relevantAssignments.filter((row) => row.can_sign).length;
  const approvalCapableCount = relevantAssignments.filter((row) => row.can_approve).length;
  const checklistRows = expectedDocuments.map((title) => {
    const document = contractDocuments.find(
      (item) => normalizeTitle(item.title) === normalizeTitle(title),
    );
    return {
      title,
      document: document ?? null,
      href: document
        ? `/documents/${document.id}${selectedCompany ? `?companyId=${selectedCompany.companyIdentityId}` : ""}`
        : buildNewContractDocumentHref({
            title,
            companyId: selectedCompany?.companyIdentityId ?? null,
          }),
    };
  });

  const documentsHref = selectedCompany
    ? `/documents?companyId=${selectedCompany.companyIdentityId}&group=personel-ozluk`
    : "/documents?group=personel-ozluk";
  const personnelHref = selectedCompany
    ? `/osgb/personnel?workspaceId=${selectedCompany.workspaceId}`
    : "/osgb/personnel";
  const assignmentsHref = selectedCompany
    ? `/osgb/assignments?workspaceId=${selectedCompany.workspaceId}`
    : "/osgb/assignments";
  const organizationHref = selectedCompany
    ? `${buildWorkspaceHref(selectedCompany)}?tab=organization`
    : "/osgb/firms";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OSGB Sozlesmeler"
        title="Sozlesme ve yetki belgeleri"
        description="Musteri hizmet sozlesmeleri, personel gorevlendirme belgeleri ve sureli yetki evraklarini ayni yasam dongusunde izle."
        actions={
          <>
            <Link
              href={documentsHref}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Sozlesme dokumanlari
            </Link>
            <Link
              href={organizationHref}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Firma organizasyonu
            </Link>
          </>
        }
      />

      <OsgbScopeBar
        companies={manager.companies}
        selectedWorkspaceId={selectedCompany?.workspaceId}
        basePath="/osgb/contracts"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OsgbStatCard
          title="Sozlesme kaydi"
          value={contractDocuments.length}
          description="Secili kapsamdaki personel ozluk ve kontrat odakli dokuman kayitlari."
        />
        <OsgbStatCard
          title="Hazir"
          value={readyCount}
          description="Imzaya veya musteri portalina yayinlamaya hazir belgeler."
          accent="text-success"
        />
        <OsgbStatCard
          title="Onay bekleyen"
          value={pendingCount}
          description="Sorumlu mudur ya da isveren onayi gerektiren kontrat ve ekler."
          accent="text-warning"
        />
        <OsgbStatCard
          title="Eksik sablon"
          value={missingTemplates.length}
          description="OSGB personel ve hizmet akislarinda tavsiye edilen ama henuz olusturulmamis sablonlar."
          accent="text-danger"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <OsgbPanel
          title="Davet ve sozlesme baglantisi"
          description="Personel firma bazli atanirken mail ile davet edilir, oturum koltugu ayrilir ve ilgili sozlesme belgeleri bu akisla birlikte takip edilir."
          actions={
            <>
              <Link
                href={personnelHref}
                className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Personel davet et
              </Link>
              <Link
                href={assignmentsHref}
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Gorevlendirmeleri yonet
              </Link>
            </>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Oturum ve ilk sifre</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Davet edilen personelin aktif seat kullanimi burada izlenir. Kisiye kullanici adi, gecici sifre veya sifre yenileme talimati mail ile gider; ilk giristen sonra sifresini gunceller.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-3 py-1">
                  Aktif seat {manager.usage?.activeStaffCount ?? assignedPersonnelCount}
                </span>
                {manager.usage?.maxActiveStaffSeats ? (
                  <span className="rounded-full border border-border px-3 py-1">
                    Limit {manager.usage.maxActiveStaffSeats}
                  </span>
                ) : null}
                <span className="rounded-full border border-border px-3 py-1">
                  Atanan personel {assignedPersonnelCount}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={personnelHref}
                  className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Davet akisina git
                </Link>
                <Link
                  href={organizationHref}
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Organizasyonu ac
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Belge zinciri</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Gorevlendirme, ek sozlesme, gizlilik ve gorev tanim belgeleri ayni firma kaydina baglanir. Bitis tarihi yaklastiginda Nova OSGB Manager yenileme uyarisi uretir.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-3 py-1">
                  Hazir {readyCount}
                </span>
                <span className="rounded-full border border-border px-3 py-1">
                  Onay {pendingCount}
                </span>
                <span className="rounded-full border border-border px-3 py-1">
                  Revizyon {revisionCount}
                </span>
                <span className="rounded-full border border-border px-3 py-1">
                  Imza yetkisi {signCapableCount}
                </span>
                <span className="rounded-full border border-border px-3 py-1">
                  Onay yetkisi {approvalCapableCount}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={documentsHref}
                  className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Belge zincirini ac
                </Link>
                <Link
                  href={assignmentsHref}
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Atamalari kontrol et
                </Link>
              </div>
            </div>
          </div>
        </OsgbPanel>

        <OsgbPanel
          title="Eksik kontrol listesi"
          description="Personel ozluk grubundaki temel belgeler OSGB denetim paketinin omurgasini olusturur."
          actions={
            <Link
              href={documentsHref}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Tum sablonlari ac
            </Link>
          }
        >
          {checklistRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Personel ozluk grubunda beklenen temel sablonlarin tamami mevcut.
            </p>
          ) : (
            <div className="space-y-2">
              {checklistRows.slice(0, 8).map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.document
                        ? `Mevcut · ${statusLabel(item.document.status)} · Surum v${item.document.version}`
                        : "Eksik sablon · Bu belgeyi olusturman gerekiyor."}
                    </p>
                  </div>
                  <Link
                    href={item.href}
                    className={`inline-flex h-9 items-center rounded-xl px-3 text-xs font-medium transition-colors ${
                      item.document
                        ? "border border-border bg-card text-foreground hover:bg-secondary"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {item.document ? "Dokumani ac" : "Olustur"}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </OsgbPanel>
      </div>

      <OsgbPanel
        title="Aktif kontrat ve ozluk belgeleri"
        description={
          selectedCompany
            ? `${selectedCompany.displayName} firmasina bagli son sozlesme hareketleri.`
            : "Tum firmalardaki kontrat ve personel ozluk odakli belge kayitlari."
        }
      >
        {contractDocuments.length === 0 ? (
          <OsgbEmpty
            title="Sozlesme kaydi bulunamadi"
            description="Secili kapsama ait kontrat veya ozluk belgesi yok. Dokuman merkezinden personel ozluk grubunu acarak yeni belge olusturabilirsin."
            action={
              <Link
                href={documentsHref}
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Dokuman merkezine git
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {contractDocuments.slice(0, 18).map((document) => (
              <article
                key={document.id}
                className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{document.title}</h3>
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary">
                        {statusLabel(document.status)}
                      </span>
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        Surum v{document.version}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Son guncelleme {new Date(document.updated_at).toLocaleString("tr-TR")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link
                      href={`/documents/${document.id}${selectedCompany ? `?companyId=${selectedCompany.companyIdentityId}` : ""}`}
                      className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      Editoru ac
                    </Link>
                    {selectedCompany ? (
                      <Link
                        href={`${buildWorkspaceHref(selectedCompany)}?tab=organization`}
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Organizasyon sekmesi
                      </Link>
                    ) : null}
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
