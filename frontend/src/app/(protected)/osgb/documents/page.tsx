import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { OhsFileTab } from "@/components/companies/OhsFileTab";
import { OsgbEmpty, OsgbPanel, OsgbScopeBar, OsgbStatCard } from "@/components/osgb/OsgbPageChrome";
import { getGroupByKey } from "@/lib/document-groups";
import { OSGB_ARCHIVE_POLICY_RULES } from "@/lib/osgb/document-archive-policy";
import {
  OSGB_ARCHIVE_GUARANTEES,
  OSGB_AUDIT_PACKAGE_SECTIONS,
  OSGB_DOCUMENT_INTEGRATION_LANES,
} from "@/lib/osgb/document-system-blueprint";
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

type DocumentRow = {
  id: string;
  title: string;
  group_key: string;
  status: string;
  version: number;
  updated_at: string;
  company_workspace_id: string | null;
  updated_by: string | null;
  created_by: string | null;
  prepared_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  is_shared: boolean | null;
};

type ArchiveJobRow = {
  id: string;
  company_workspace_id: string;
  year: number;
  status: string;
  progress: number;
  file_size_bytes: number | null;
  download_count: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  scope: { categories?: unknown[] } | null;
};

type ProfileRow = {
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  title: string | null;
};

function statusLabel(status: string) {
  if (status === "hazir") return "Hazir";
  if (status === "onay_bekliyor") return "Onay bekliyor";
  if (status === "revizyon") return "Revizyon";
  if (status === "arsiv") return "Arsivde";
  return "Taslak";
}

function archiveStatusLabel(status: string) {
  if (status === "completed") return "Hazir";
  if (status === "processing") return "Hazirlaniyor";
  if (status === "pending") return "Kuyrukta";
  if (status === "failed") return "Hatali";
  if (status === "cancelled") return "Iptal edildi";
  if (status === "expired") return "Suresi doldu";
  return "Beklemede";
}

function groupTitle(groupKey: string) {
  return getGroupByKey(groupKey)?.title ?? groupKey;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR");
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function actorLabel(input: {
  fullName: string | null;
  email: string | null;
  title: string | null;
}) {
  const name = input.fullName || input.email || "Bilinmeyen profesyonel";
  return input.title ? `${name} - ${input.title}` : name;
}

function buildDocumentsHref(input: {
  companyId?: string | null;
  groupKey?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.companyId) params.set("companyId", input.companyId);
  if (input.groupKey) params.set("group", input.groupKey);
  const query = params.toString();
  return query ? `/documents?${query}` : "/documents";
}

function buildNewDocumentHref(input: {
  groupKey: string;
  title?: string | null;
  companyId?: string | null;
}) {
  const params = new URLSearchParams({
    group: input.groupKey,
  });
  if (input.title) params.set("title", input.title);
  if (input.companyId) params.set("companyId", input.companyId);
  return `/documents/new?${params.toString()}`;
}

function buildArchiveDownloadHref(jobId: string) {
  return `/api/ohs-archive/${jobId}/download`;
}

const DOCUMENT_STREAMS = [
  {
    key: "risk-stream",
    title: "Risk ve DOF akisi",
    description: "Risk degerlendirmesi, kaza, ramak kala ve DÖF zinciri.",
    groups: ["risk-degerlendirme", "kaza-olay"],
  },
  {
    key: "training-stream",
    title: "Egitim ve yetkinlik akisi",
    description: "Egitim kayitlari, oryantasyon, sertifika ve yetkinlik matrisi.",
    groups: ["egitim-dosyasi", "is-giris-oryantasyon", "personel-ozluk"],
  },
  {
    key: "health-stream",
    title: "Saglik ve hekim akisi",
    description: "Isyeri hekimi, saglik gozetimi ve latent maruziyet belgeleri.",
    groups: ["isyeri-hekimi"],
  },
  {
    key: "inspection-stream",
    title: "Olcum ve periyodik kontrol akisi",
    description: "Periyodik kontroller, ortam olcumleri ve ekipman raporlari.",
    groups: ["periyodik-kontrol", "diger-kayitlar", "arac-makine"],
  },
  {
    key: "emergency-stream",
    title: "Acil durum ve denetim paketi",
    description: "Acil durum plani, tatbikat, kurul ve denetim ciktilari.",
    groups: ["acil-durum", "kurul-kayitlari", "denetim-kontrol"],
  },
  {
    key: "contract-stream",
    title: "Sozlesme ve yayin akisi",
    description: "Personel ozluk, sozlesme, imza ve yayinlanmis portal ciktilari.",
    groups: ["personel-ozluk", "iletisim-yazisma", "prosedurler"],
  },
];

export default async function OsgbDocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const manager = await requireOsgbManagerContext();
  const service = createServiceClient();
  const selectedCompany = resolveWorkspaceFilter(manager.companies, params.workspaceId);

  const documentQuery = service
    .from("editor_documents")
    .select(
      "id, title, group_key, status, version, updated_at, company_workspace_id, updated_by, created_by, prepared_by, approved_by, approved_at, is_shared",
    )
    .eq("organization_id", manager.organizationId)
    .order("updated_at", { ascending: false });

  const archiveQuery = service
    .from("ohs_archive_jobs")
    .select(
      "id, company_workspace_id, year, status, progress, file_size_bytes, download_count, created_at, completed_at, error_message, scope",
    )
    .eq("organization_id", manager.organizationId)
    .order("created_at", { ascending: false })
    .limit(selectedCompany ? 24 : 40);

  if (selectedCompany) {
    documentQuery.eq("company_workspace_id", selectedCompany.workspaceId);
    archiveQuery.eq("company_workspace_id", selectedCompany.workspaceId);
  }

  const [
    { data: documentRows, error: documentError },
    { data: archiveRows, error: archiveError },
  ] = await Promise.all([documentQuery, archiveQuery]);

  if (documentError && !isCompatError(documentError.message)) {
    throw new Error(documentError.message);
  }

  if (archiveError && !isCompatError(archiveError.message)) {
    throw new Error(archiveError.message);
  }

  const rawDocuments = (documentRows ?? []) as DocumentRow[];
  const rawArchiveJobs = (archiveRows ?? []) as ArchiveJobRow[];
  const relevantDocumentIds = rawDocuments.map((document) => document.id);

  const relevantUserIds = Array.from(
    new Set(
      rawDocuments.flatMap((document) =>
        [document.updated_by, document.created_by].filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        ),
      ),
    ),
  );

  let profileRows: ProfileRow[] = [];
  let signatureRows: Array<{ document_id: string }> = [];
  if (relevantUserIds.length > 0) {
    const { data: profiles, error: profileError } = await service
      .from("user_profiles")
      .select("auth_user_id, full_name, email, title")
      .in("auth_user_id", relevantUserIds);

    if (profileError && !isCompatError(profileError.message)) {
      throw new Error(profileError.message);
    }

    profileRows = ((profiles ?? []) as ProfileRow[]).filter(
      (profile): profile is ProfileRow => typeof profile.auth_user_id === "string",
    );
  }

  if (relevantDocumentIds.length > 0) {
    const { data: signatures, error: signaturesError } = await service
      .from("document_signatures")
      .select("document_id")
      .in("document_id", relevantDocumentIds);

    if (signaturesError && !isCompatError(signaturesError.message)) {
      throw new Error(signaturesError.message);
    }

    signatureRows = (signatures ?? []) as Array<{ document_id: string }>;
  }

  const companyMap = new Map(manager.companies.map((company) => [company.workspaceId, company]));
  const profileMap = new Map(
    profileRows
      .filter((profile): profile is ProfileRow & { auth_user_id: string } => !!profile.auth_user_id)
      .map((profile) => [profile.auth_user_id, profile]),
  );

  const documents = rawDocuments.map((document) => {
    const company =
      document.company_workspace_id === null
        ? null
        : companyMap.get(document.company_workspace_id) ?? null;
    const actorProfile = profileMap.get(document.updated_by || document.created_by || "");

    return {
      ...document,
      company,
      actorLabel: actorLabel({
        fullName: actorProfile?.full_name ?? null,
        email: actorProfile?.email ?? null,
        title: actorProfile?.title ?? null,
      }),
    };
  });

  const activeDocuments = documents.filter((document) => document.status !== "arsiv");
  const archivedDocuments = documents.filter((document) => document.status === "arsiv");
  const sharedCount = activeDocuments.filter((document) => document.is_shared === true).length;
  const approvedCount = activeDocuments.filter((document) => !!document.approved_at).length;
  const preparedCount = activeDocuments.filter((document) => !!document.prepared_by).length;
  const signedDocumentIds = new Set(signatureRows.map((row) => row.document_id));
  const signedDocumentCount = signedDocumentIds.size;
  const approvedDocuments = activeDocuments.filter((document) => !!document.approved_at);
  const usedDocuments = activeDocuments.filter(
    (document) => document.is_shared === true || signedDocumentIds.has(document.id),
  );

  const archiveJobs = rawArchiveJobs.map((job) => ({
    ...job,
    company: companyMap.get(job.company_workspace_id) ?? null,
    categoryCount: Array.isArray(job.scope?.categories) ? job.scope?.categories.length ?? 0 : 0,
  }));

  const readyCount = activeDocuments.filter((document) => document.status === "hazir").length;
  const waitingApprovalCount = activeDocuments.filter(
    (document) => document.status === "onay_bekliyor",
  ).length;
  const completedArchiveCount = archiveJobs.filter((job) => job.status === "completed").length;
  const processingArchiveCount = archiveJobs.filter(
    (job) => job.status === "pending" || job.status === "processing",
  ).length;
  const failedArchiveCount = archiveJobs.filter((job) => job.status === "failed").length;

  const professionalActivity = Array.from(
    documents.reduce((acc, document) => {
      const key = document.actorLabel;
      const current = acc.get(key) ?? { count: 0, companies: new Set<string>() };
      current.count += 1;
      if (document.company?.displayName) {
        current.companies.add(document.company.displayName);
      }
      acc.set(key, current);
      return acc;
    }, new Map<string, { count: number; companies: Set<string> }>()),
  )
    .map(([name, info]) => ({
      name,
      count: info.count,
      companies: Array.from(info.companies).slice(0, 3),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);

  const streamSnapshots = DOCUMENT_STREAMS.map((stream) => {
    const rows = activeDocuments.filter((document) => stream.groups.includes(document.group_key));
    const readyRows = rows.filter((document) => document.status === "hazir");
    const approvedRows = rows.filter((document) => !!document.approved_at);

    let stateLabel = "Eksik";
    let stateClass = "text-danger";

    if (approvedRows.length > 0 || readyRows.length > 0) {
      stateLabel = "Yayina yakin";
      stateClass = "text-success";
    } else if (rows.length > 0) {
      stateLabel = "Calisiliyor";
      stateClass = "text-warning";
    }

    return {
      ...stream,
      primaryGroupKey: stream.groups[0] ?? "",
      totalCount: rows.length,
      readyCount: readyRows.length,
      approvedCount: approvedRows.length,
      stateLabel,
      stateClass,
    };
  });

  const auditPackageSections = OSGB_AUDIT_PACKAGE_SECTIONS.map((section) => {
    const rows = activeDocuments.filter((document) => section.groupKeys.includes(document.group_key));
    const approvedRows = rows.filter((document) => !!document.approved_at);
    const usedRows = rows.filter(
      (document) => document.is_shared === true || signedDocumentIds.has(document.id),
    );
    const matchedGroups = section.groupKeys.filter((groupKey) =>
      rows.some((document) => document.group_key === groupKey),
    );
    const missingGroups = section.groupKeys.filter((groupKey) => !matchedGroups.includes(groupKey));
    const coveragePercent =
      section.groupKeys.length === 0
        ? 0
        : Math.round((matchedGroups.length / section.groupKeys.length) * 100);

    let stateLabel = "Eksik";
    let stateClass = "text-danger";

    if (coveragePercent === 100 && (approvedRows.length > 0 || usedRows.length > 0)) {
      stateLabel = "Denetime hazir";
      stateClass = "text-success";
    } else if (coveragePercent >= 50 || rows.length > 0) {
      stateLabel = "Toplaniyor";
      stateClass = "text-warning";
    }

    return {
      ...section,
      primaryGroupKey: section.groupKeys[0] ?? "",
      rows,
      approvedRows,
      usedRows,
      matchedGroups,
      missingGroups,
      coveragePercent,
      stateLabel,
      stateClass,
    };
  });

  const readyAuditPackageCount = auditPackageSections.filter(
    (section) => section.coveragePercent === 100 && (section.approvedRows.length > 0 || section.usedRows.length > 0),
  ).length;
  const traceableDocumentCount = activeDocuments.filter(
    (document) =>
      !!document.prepared_by ||
      !!document.approved_at ||
      document.is_shared === true ||
      signedDocumentIds.has(document.id),
  ).length;
  const traceabilityPercent =
    activeDocuments.length === 0 ? 0 : Math.round((traceableDocumentCount / activeDocuments.length) * 100);
  const selectedScopeLabel = selectedCompany ? selectedCompany.displayName : "Tum portfoy";
  const selectedScopeDetail = selectedCompany
    ? `${selectedCompany.officialName}${selectedCompany.city ? ` · ${selectedCompany.city}` : ""}${selectedCompany.hazardClass ? ` · ${selectedCompany.hazardClass}` : ""}`
    : `${manager.companies.length} aktif firma portfoyu`;
  const workspaceDocumentsHref = selectedCompany
    ? `${buildWorkspaceHref(selectedCompany)}?tab=documents`
    : "/osgb/firms";
  const contractsHref = selectedCompany
    ? `/osgb/contracts?workspaceId=${selectedCompany.workspaceId}`
    : "/osgb/contracts";
  const selectedCompanyId = selectedCompany?.companyIdentityId ?? null;
  const assignmentsHref = selectedCompany
    ? `/osgb/assignments?workspaceId=${selectedCompany.workspaceId}`
    : "/osgb/assignments";
  const tasksHref = selectedCompany
    ? `/osgb/tasks?workspaceId=${selectedCompany.workspaceId}`
    : "/osgb/tasks";
  const personnelHref = selectedCompany
    ? `/osgb/personnel?workspaceId=${selectedCompany.workspaceId}`
    : "/osgb/personnel";
  const prioritySignals = [
    {
      key: "waiting-approval",
      title: "Onay kuyrugu",
      value: waitingApprovalCount,
      description: "Yonetici, sorumlu mudur veya isveren onayi bekleyen kayitlar.",
      accent: waitingApprovalCount > 0 ? "text-warning" : "text-success",
    },
    {
      key: "package-processing",
      title: "Hazirlanan paket",
      value: processingArchiveCount,
      description: "Su anda kuyrukta ya da islenmekte olan denetim ve ISG dosyasi paketleri.",
      accent: processingArchiveCount > 0 ? "text-primary" : "text-muted-foreground",
    },
    {
      key: "package-failed",
      title: "Mudahale gerekli",
      value: failedArchiveCount,
      description: "Hata veren paketler ya da yeniden ele alinmasi gereken arsiv denemeleri.",
      accent: failedArchiveCount > 0 ? "text-danger" : "text-success",
    },
  ];
  const professionalLoadSummary =
    professionalActivity.length === 0
      ? "Profesyonel uretim izi henuz olusmadi."
      : `${professionalActivity[0]?.name} su anda en fazla kayit ureten profesyonel.`;
  const lifecycleSummary =
    readyCount > 0
      ? `${readyCount} dokuman hazir durumda; paketleme ve yayin akisina alinabilir.`
      : "Henuz yayin veya arsiv akisi icin hazir dokuman bulunmuyor.";

  const documentsHref = selectedCompany
    ? `/documents?companyId=${selectedCompany.companyIdentityId}`
    : "/documents";
  const newDocumentHref = buildNewDocumentHref({
    groupKey: "diger-kayitlar",
    title: selectedCompany ? `${selectedCompany.displayName} dokuman calismasi` : "Yeni dokuman calismasi",
    companyId: selectedCompanyId,
  });

  const archiveAnchorHref = selectedCompany
    ? `/osgb/documents?workspaceId=${selectedCompany.workspaceId}#arsiv-paketi`
    : "/osgb/documents#arsiv-paketi";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OSGB Dokuman Sistemi"
        title="Rapor, kanit ve arsiv yonetimi"
        description="Firma bazli dokuman omurgasini, profesyonel uretimini ve denetim paketlerini tek ekranda yonetin."
        meta={
          <>
            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">
              Kapsam · {selectedScopeLabel}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">
              Izlenebilirlik · %{traceabilityPercent}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">
              Denetime hazir · {readyAuditPackageCount}/{OSGB_AUDIT_PACKAGE_SECTIONS.length}
            </span>
          </>
        }
        actions={
          <>
            <Link
              href={workspaceDocumentsHref}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Firma dokuman omurgasi
            </Link>
            <Link
              href={archiveAnchorHref}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Arsiv paketini ac
            </Link>
            <Link
              href={documentsHref}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Dokuman uretimine git
            </Link>
          </>
        }
      />

      <OsgbScopeBar
        companies={manager.companies}
        selectedWorkspaceId={selectedCompany?.workspaceId}
        basePath="/osgb/documents"
      />

      <OsgbPanel
        title="Gunluk operasyon masasi"
        description="OSGB yoneticisi bu yuzeyden firma kapsamini, profesyonel dokuman uretimini, denetim paketi hazirligini ve arsiv aksiyonlarini ayni anda yonetir."
        actions={
          <>
            <Link
              href={contractsHref}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Sozlesmeleri ac
            </Link>
            <Link
              href={documentsHref}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Yeni dokuman calismasi
            </Link>
          </>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Secili operasyon kapsami
            </p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">{selectedScopeLabel}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedScopeDetail}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Paket hazirligi
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {readyAuditPackageCount}/{OSGB_AUDIT_PACKAGE_SECTIONS.length}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Denetime hazir belge ailesi
                </p>
              </div>
              <div className="rounded-2xl border border-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Arsiv ve yayin izi
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">%{traceabilityPercent}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Hazirlayan, onay, imza veya paylasim izi
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
              {lifecycleSummary}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Oncelikli takip
            </p>
            <div className="mt-4 space-y-3">
              {prioritySignals.map((signal) => (
                <div key={signal.key} className="rounded-2xl border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{signal.title}</p>
                    <span className={`text-xl font-semibold ${signal.accent}`}>{signal.value}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Profesyonel ritim
            </p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{professionalLoadSummary}</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Onayli belgeler firma bazli izlenir ve yeniden kullanima hazir tutulur.</li>
              <li>Kullanimda olan belgeler paylasim ya da imza iziyle ayrisir.</li>
              <li>Arsive giden belge silinmez; firma gecmisi ve denetim izi korunur.</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={documentsHref}
                className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Aktif kayitlari ac
              </Link>
              <Link
                href={archiveAnchorHref}
                className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Paket durumunu gor
              </Link>
            </div>
          </div>
        </div>
      </OsgbPanel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OsgbStatCard
          title="Toplam dokuman"
          value={activeDocuments.length}
          description="Secili firma kapsamina ait aktif dokuman kartlari ve saha ciktilari."
        />
        <OsgbStatCard
          title="Hazir"
          value={readyCount}
          description="Imza, yayin veya denetim paketine eklenmeye hazir kayitlar."
          accent="text-success"
        />
        <OsgbStatCard
          title="Arsiv kaydi"
          value={archivedDocuments.length}
          description="Silinmeyen, gecmisi korunmus ve firma bazli soguk arsive alinmis kayitlar."
        />
        <OsgbStatCard
          title="Arsiv paketi"
          value={completedArchiveCount}
          description={
            processingArchiveCount > 0
              ? `${processingArchiveCount} paket su anda hazirlaniyor.`
              : "Indirilebilir durumda olan denetim ve isyeri ISG dosyasi paketleri."
          }
          accent={failedArchiveCount > 0 ? "text-warning" : "text-primary"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <OsgbPanel
          title="Firma bazli arsiv kurgusu"
          description="Tum dokuman, rapor ve kanit akisi firma workspace baglaminda tutulur. Gorevlendirilen profesyoneller kendi urettikleri kayitlari bu omurgaya ekler; OSGB yonetimi ise ayni omurgadan denetim paketi ve arsiv uretir."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Secili kapsam</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedCompany
                  ? `${selectedCompany.displayName} icin aktif dokuman, arsiv kaydi ve paketler ayrik gorunur. Bu firma icin profesyonel calismasi dogrudan bu ekrana yansir.`
                  : "Secili firma yok. Portfoy ozeti gorunuyor; yeni arsiv paketi hazirlamak icin asagidan firma secmelisin."}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Arsiv kurali</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>Ham dokuman, yayin ciktisi ve metadata ayri saklanir.</li>
                <li>Arsive alinan kayit silinmez; firma gecmisi ve surec izi korunur.</li>
                <li>Hazirlanan paketler isyeri ISG dosyasi mantigiyla indirilebilir olur.</li>
              </ul>
            </div>
          </div>
        </OsgbPanel>

        <OsgbPanel
          title="Profesyonel uretim izi"
          description="OSGB yonetimi, firma bazli dokuman uretimini ilgili uzman ve hekimler uzerinden izler."
        >
          {professionalActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henuz profesyonel baglantili dokuman hareketi yok.
            </p>
          ) : (
            <div className="space-y-3">
              {professionalActivity.map((item) => (
                <div
                  key={item.name}
                  className="rounded-2xl border border-border bg-background px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary">
                      {item.count} kayit
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.companies.length > 0
                      ? `Calistigi firmalar: ${item.companies.join(", ")}`
                      : "Firma bagli uretim bilgisi bekleniyor."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </OsgbPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OsgbStatCard
          title="Paylasilan belge"
          value={sharedCount}
          description="Portal, paylasim linki veya denetim cikisi icin yayinlanmis dokumanlar."
        />
        <OsgbStatCard
          title="Hazirlayan izi"
          value={preparedCount}
          description="Hazirlayan profesyonel bilgisi kayda alinmis aktif dokumanlar."
        />
        <OsgbStatCard
          title="Onaylanmis"
          value={approvedCount}
          description="Onay zamani yazilmis, yonetim zincirinden gecmis aktif kayitlar."
          accent="text-success"
        />
        <OsgbStatCard
          title="Imzali belge"
          value={signedDocumentCount}
          description="Dokuman imza kaydi olan ve audit zincirine giren kayitlar."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OsgbStatCard
          title="Denetime hazir paket"
          value={readyAuditPackageCount}
          description="Zorunlu grup kapsami dolmus ve onay veya kullanim izi tasiyan paket aileleri."
          accent="text-success"
        />
        <OsgbStatCard
          title="Izlenebilirlik"
          value={`${traceabilityPercent}%`}
          description="Hazirlayan, onay, imza veya yayin izi tasiyan aktif dokuman orani."
        />
        <OsgbStatCard
          title="Onay kuyrugu"
          value={waitingApprovalCount}
          description="Arsiv ve yayin oncesi yonetsel kontrol bekleyen aktif kayitlar."
          accent={waitingApprovalCount > 0 ? "text-warning" : "text-success"}
        />
        <OsgbStatCard
          title="Hata veren paket"
          value={failedArchiveCount}
          description="Yeniden ele alinmasi gereken arsiv veya paketleme denemeleri."
          accent={failedArchiveCount > 0 ? "text-danger" : "text-primary"}
        />
      </div>

      <OsgbPanel
        title="Belge akis hatlari"
        description="OSGB dokuman sistemi tek kutu degil; mevzuat ve operasyon dogasina gore farkli belge akislari ayni firma omurgasinda toplanir."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {streamSnapshots.map((stream) => (
            <article
              key={stream.key}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{stream.title}</h3>
                <span className={`rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold ${stream.stateClass}`}>
                  {stream.stateLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{stream.description}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-border px-2 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Kayit</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{stream.totalCount}</p>
                </div>
                <div className="rounded-xl border border-border px-2 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Hazir</p>
                  <p className="mt-1 text-lg font-semibold text-success">{stream.readyCount}</p>
                </div>
                <div className="rounded-xl border border-border px-2 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Onay</p>
                  <p className="mt-1 text-lg font-semibold text-primary">{stream.approvedCount}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={buildDocumentsHref({
                    companyId: selectedCompanyId,
                    groupKey: stream.primaryGroupKey,
                  })}
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Kayitlari gor
                </Link>
                <Link
                  href={buildNewDocumentHref({
                    groupKey: stream.primaryGroupKey,
                    title: groupTitle(stream.primaryGroupKey),
                    companyId: selectedCompanyId,
                  })}
                  className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Yeni kayit
                </Link>
              </div>
            </article>
          ))}
        </div>
      </OsgbPanel>

      <OsgbPanel
        title="Denetim paketi hazirlik seviyesi"
        description="Paylastigin akisa uygun olarak her firma icin denetim paketi tek PDF degil; farkli belge ailelerinden olusan bir audit omurgasi olarak izlenir."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {auditPackageSections.map((section) => (
            <article
              key={section.key}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                <span className={`rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold ${section.stateClass}`}>
                  {section.stateLabel}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
              <div className="mt-4 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${section.coveragePercent}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border px-2.5 py-1">
                  Kapsam %{section.coveragePercent}
                </span>
                <span className="rounded-full border border-border px-2.5 py-1">
                  {section.rows.length} kayit
                </span>
                <span className="rounded-full border border-border px-2.5 py-1">
                  {section.approvedRows.length} onayli
                </span>
                <span className="rounded-full border border-border px-2.5 py-1">
                  {section.usedRows.length} kullanimda
                </span>
              </div>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {section.missingGroups.length === 0
                  ? "Zorunlu grup kapsami tamam. Arsiv paketi ve denetim dosyasi icin hazirlik seviyesi yuksek."
                  : `Eksik aileler: ${section.missingGroups.map((groupKey) => groupTitle(groupKey)).join(", ")}`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={buildDocumentsHref({
                    companyId: selectedCompanyId,
                    groupKey: section.primaryGroupKey,
                  })}
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Dokuman merkezini ac
                </Link>
                {section.missingGroups.length > 0 ? (
                  <Link
                    href={buildNewDocumentHref({
                      groupKey: section.missingGroups[0],
                      title: groupTitle(section.missingGroups[0]),
                      companyId: selectedCompanyId,
                    })}
                    className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Eksigi olustur
                  </Link>
                ) : null}
                {selectedCompany ? (
                  <Link
                    href={archiveAnchorHref}
                    className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Arsiv paketine bagla
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </OsgbPanel>

      <OsgbPanel
        title="Dis kaynak belge toplama katmani"
        description="Notundaki uc desenli entegrasyon mimarisini ekrana tasidim. Belgeler tek kanaldan degil, web servis, operator destekli portal ve standart dosya import katmanlarindan beslenir."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {OSGB_DOCUMENT_INTEGRATION_LANES.map((lane) => (
            <article
              key={lane.key}
              className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <h3 className="text-base font-semibold text-foreground">{lane.title}</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Desen:</span> {lane.pattern}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Ornekler:</span> {lane.examples}
                </p>
                <p>
                  <span className="font-semibold text-foreground">RiskNova aksiyonu:</span> {lane.productAction}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Veri formu:</span> {lane.dataShape}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={
                    lane.key === "web-service-adapter"
                      ? buildDocumentsHref({
                          companyId: selectedCompanyId,
                          groupKey: "isyeri-hekimi",
                        })
                      : lane.key === "operator-assisted-portal"
                        ? contractsHref
                        : buildDocumentsHref({
                            companyId: selectedCompanyId,
                            groupKey: "diger-kayitlar",
                          })
                  }
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {lane.key === "web-service-adapter"
                    ? "Servis kayitlarini gor"
                    : lane.key === "operator-assisted-portal"
                      ? "Portal akisina git"
                      : "Import kayitlarini gor"}
                </Link>
                {selectedCompany ? (
                  <Link
                    href={`${buildWorkspaceHref(selectedCompany)}?tab=documents`}
                    className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Firma omurgasini ac
                  </Link>
                ) : null}
                <Link
                  href={
                    lane.key === "standard-file-import"
                      ? buildNewDocumentHref({
                          groupKey: "diger-kayitlar",
                          title: "Dis kaynak belge kaydi",
                          companyId: selectedCompanyId,
                        })
                      : newDocumentHref
                  }
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Kayit baslat
                </Link>
              </div>
            </article>
          ))}
        </div>
      </OsgbPanel>

      <div id="arsiv-paketi">
        {selectedCompany ? (
          <OhsFileTab
            companyWorkspaceId={selectedCompany.workspaceId}
            companyName={selectedCompany.displayName}
          />
        ) : (
          <OsgbPanel
            title="Firma sec ve arsiv paketi hazirla"
            description="Arsiv paketi her zaman tek bir firma workspace'i icin hazirlanir. Portfoy seviyesinde son paketleri gorebilir, yeni paket icin ilgili firmayi secebilirsin."
          >
            {manager.companies.length === 0 ? (
              <OsgbEmpty
                title="Firma bulunamadi"
                description="Once firma olusturup workspace baglamini hazirlamalisin. Firma olmadan profesyonel uretimi ve arsiv paketi acilmaz."
                action={
                  <Link
                    href="/osgb/firms"
                    className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Firmalara git
                  </Link>
                }
              />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {manager.companies.slice(0, 10).map((company) => (
                    <Link
                      key={company.workspaceId}
                      href={`/osgb/documents?workspaceId=${company.workspaceId}#arsiv-paketi`}
                      className="inline-flex items-center rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {company.displayName}
                    </Link>
                  ))}
                </div>

                {archiveJobs.length === 0 ? (
                  <OsgbEmpty
                    title="Hazir arsiv paketi yok"
                    description="Henuz hicbir firma icin ISG dosyasi paketi olusturulmamis. Yukaridan firma secerek ilk paketi hazirlayabilirsin."
                  />
                ) : (
                  <div className="space-y-3">
                    {archiveJobs.slice(0, 8).map((job) => (
                      <article
                        key={job.id}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-foreground">
                                {job.company?.displayName || "Firma paketi"}
                              </h3>
                              <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary">
                                {archiveStatusLabel(job.status)}
                              </span>
                              <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                {job.year}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              Kapsam {job.categoryCount} kategori · Boyut {formatBytes(job.file_size_bytes)} · Olusturulma {formatDateTime(job.created_at)}
                            </p>
                            {job.error_message ? (
                              <p className="mt-2 text-sm text-danger">{job.error_message}</p>
                            ) : null}
                          </div>

                          {job.company ? (
                            <div className="flex flex-wrap gap-2">
                              {job.status === "completed" ? (
                                <a
                                  href={buildArchiveDownloadHref(job.id)}
                                  className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                                >
                                  Paketi indir
                                </a>
                              ) : null}
                              <Link
                                href={`/osgb/documents?workspaceId=${job.company.workspaceId}#arsiv-paketi`}
                                className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                              >
                                Firma paketine git
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </OsgbPanel>
        )}
      </div>

      <OsgbPanel
        title="Saklama ve arsivleme matrisi"
        description="Firma bazli gelen profesyonel kayitlar, tek bir saklama suresine degil belge turune gore farkli arsiv kurallarina tabidir."
        actions={
          <>
            <Link
              href={archiveAnchorHref}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Arsiv paketini ac
            </Link>
            <Link
              href={newDocumentHref}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Yeni kayit baslat
            </Link>
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-3 py-3 font-semibold">Belge turu</th>
                <th className="px-3 py-3 font-semibold">Yasal asgari</th>
                <th className="px-3 py-3 font-semibold">Baslangic</th>
                <th className="px-3 py-3 font-semibold">RiskNova varsayimi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {OSGB_ARCHIVE_POLICY_RULES.map((rule) => (
                <tr key={rule.key} className="align-top">
                  <td className="px-3 py-4 text-sm font-semibold text-foreground">{rule.title}</td>
                  <td className="px-3 py-4 text-sm text-muted-foreground">{rule.legalMinimum}</td>
                  <td className="px-3 py-4 text-sm text-muted-foreground">{rule.startPoint}</td>
                  <td className="px-3 py-4 text-sm leading-6 text-muted-foreground">{rule.defaultPolicy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OsgbPanel>

      <OsgbPanel
        title="Arsiv guvenceleri"
        description="Notundaki arsiv katmani gereksinimlerini UI diline tasidim. Bu ekran sadece dosya listesi degil, izlenebilirlik ve hukuk guvencesi odakli bir belge omurgasi olarak calisir."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {OSGB_ARCHIVE_GUARANTEES.map((item) => (
            <article
              key={item.key}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
            >
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={
                    item.key === "version-lock"
                      ? archiveAnchorHref
                      : item.key === "hash-and-metadata"
                        ? documentsHref
                        : item.key === "role-based-visibility"
                          ? assignmentsHref
                          : contractsHref
                  }
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {item.key === "version-lock"
                    ? "Arsiv zincirini ac"
                    : item.key === "hash-and-metadata"
                      ? "Dokuman izini gor"
                      : item.key === "role-based-visibility"
                        ? "Yetkileri ac"
                        : "Bekletme kuralini ac"}
                </Link>
                <Link
                  href={
                    item.key === "role-based-visibility"
                      ? personnelHref
                      : item.key === "legal-hold"
                        ? tasksHref
                        : workspaceDocumentsHref
                  }
                  className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  {item.key === "role-based-visibility"
                    ? "Personel akisini gor"
                    : item.key === "legal-hold"
                      ? "Takip listesine git"
                      : "Firma omurgasini ac"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </OsgbPanel>

      <OsgbPanel
        title="Son profesyonel dokuman hareketleri"
        description={
          selectedCompany
            ? `${selectedCompany.displayName} firmasi icin profesyonellerin son urettigi veya guncelledigi aktif kayitlar.`
            : "Tum firmalardaki profesyonel kaynakli son aktif dokuman hareketleri."
        }
      >
        {activeDocuments.length === 0 ? (
          <OsgbEmpty
            title="Aktif dokuman kaydi bulunamadi"
            description="Secili kapsama ait aktif dokuman yok. Dokuman merkezinden ilk kaydi olusturabilir veya firma secerek profesyonel uretimini izleyebilirsin."
            action={
              <Link
                href={documentsHref}
                className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Dokuman merkezini ac
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {activeDocuments.slice(0, 14).map((document) => (
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
                        {groupTitle(document.group_key)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {document.company?.displayName || "Firma baglam kaydi yok"} · Surum v
                      {document.version} · Son hareket {formatDateTime(document.updated_at)}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Sorumlu profesyonel: {document.actorLabel}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link
                      href={`/documents/${document.id}${document.company ? `?companyId=${document.company.companyIdentityId}` : ""}`}
                      className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      Editoru ac
                    </Link>
                    {document.company ? (
                      <Link
                        href={`${buildWorkspaceHref(document.company)}?tab=documents`}
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Firma workspace
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </OsgbPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <OsgbPanel
          title="Onaylanmis dokumanlar"
          description={
            selectedCompany
              ? `${selectedCompany.displayName} firmasi icin onay kaydi dusulmus dokumanlar.`
              : "Tum firmalarda onay zincirinden gecmis dokumanlar."
          }
        >
          {approvedDocuments.length === 0 ? (
            <OsgbEmpty
              title="Onayli dokuman bulunamadi"
              description="Secili firma kapsaminda approved_at kaydi bulunan dokuman yok."
            />
          ) : (
            <div className="space-y-4">
              {approvedDocuments.slice(0, 10).map((document) => (
                <article
                  key={document.id}
                  className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{document.title}</h3>
                        <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                          Onaylandi
                        </span>
                        <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {groupTitle(document.group_key)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {document.company?.displayName || "Firma baglam kaydi yok"} · Onay tarihi {formatDateTime(document.approved_at)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Hazirlayan profesyonel: {document.actorLabel}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Link
                        href={`/documents/${document.id}${document.company ? `?companyId=${document.company.companyIdentityId}` : ""}`}
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Dokumani ac
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </OsgbPanel>

        <OsgbPanel
          title="Kullanimda olan dokumanlar"
          description={
            selectedCompany
              ? `${selectedCompany.displayName} firmasi icin paylasilmis veya imzalanmis dokumanlar.`
              : "Tum firmalardaki kullanimda olan, paylasim ya da imza izi tasiyan dokumanlar."
          }
        >
          {usedDocuments.length === 0 ? (
            <OsgbEmpty
              title="Kullanimda dokuman bulunamadi"
              description="Secili firma kapsaminda paylasim veya imza izi bulunan dokuman yok."
            />
          ) : (
            <div className="space-y-4">
              {usedDocuments.slice(0, 10).map((document) => (
                <article
                  key={document.id}
                  className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">{document.title}</h3>
                        {document.is_shared ? (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            Paylasildi
                          </span>
                        ) : null}
                        {signedDocumentIds.has(document.id) ? (
                          <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                            Imzali
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {document.company?.displayName || "Firma baglam kaydi yok"} · Son hareket {formatDateTime(document.updated_at)}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Ureten profesyonel: {document.actorLabel}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Link
                        href={`/documents/${document.id}${document.company ? `?companyId=${document.company.companyIdentityId}` : ""}`}
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Dokumani ac
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </OsgbPanel>
      </div>

      <OsgbPanel
        title="Arsive alinan kayitlar"
        description={
          selectedCompany
            ? `${selectedCompany.displayName} firmasinda soguk arsive alinmis kayitlar. Bu kayitlar aktif sayaçlara dahil edilmez ama denetim izi korunur.`
            : "Tum firmalardaki arsive alinmis dokumanlar. Firma bazli filtre kullanarak daraltabilirsin."
        }
      >
        {archivedDocuments.length === 0 ? (
          <OsgbEmpty
            title="Arsiv kaydi bulunamadi"
            description="Secili kapsama ait arsivlenmis dokuman yok. Kayitlar editor ya da firma workspace icinden arsive alindiginda burada gorunur."
          />
        ) : (
          <div className="space-y-4">
            {archivedDocuments.slice(0, 12).map((document) => (
              <article
                key={document.id}
                className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{document.title}</h3>
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        Arsivde
                      </span>
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        {groupTitle(document.group_key)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {document.company?.displayName || "Firma baglam kaydi yok"} · Son hareket {formatDateTime(document.updated_at)}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Arsive giden son profesyonel izi: {document.actorLabel}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link
                      href={`/documents/${document.id}${document.company ? `?companyId=${document.company.companyIdentityId}` : ""}`}
                      className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      Kaydi incele
                    </Link>
                    {document.company ? (
                      <Link
                        href={`${buildWorkspaceHref(document.company)}?tab=documents`}
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Firma arsivi
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </OsgbPanel>

      {waitingApprovalCount > 0 ? (
        <OsgbPanel
          title="Onay ve yayin kuyrugu"
          description="Arsiv paketine girmeden once yonetici, sorumlu mudur veya isveren onayi bekleyen dokumanlar burada toplanir."
          actions={
            <Link
              href={documentsHref}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Onay kayitlarini ac
            </Link>
          }
        >
          <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-4 text-sm text-foreground">
            Secili kapsamda {waitingApprovalCount} dokuman halen onay bekliyor. Hazir paket sayacini etkilemeden once bu kayitlari tamamlaman iyi olur.
          </div>
        </OsgbPanel>
      ) : null}
    </div>
  );
}
