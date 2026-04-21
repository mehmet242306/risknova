"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  FileText,
  FolderOpen,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserPlus2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumIconBadge } from "@/components/ui/premium-icon-badge";
import type { PremiumIconTone } from "@/components/ui/premium-icon-badge";
import type { CompanyRecord } from "@/lib/company-directory";
import { fetchAccountContext, type AccountContextResponse } from "@/lib/account/account-api";
import {
  archiveCompanyInSupabase,
  createCompanyInSupabase,
  fetchArchivedFromSupabase,
  fetchCompaniesFromSupabase,
  restoreCompanyInSupabase,
} from "@/lib/supabase/company-api";
import { getOverallRiskState } from "@/lib/workplace-status";

function createEmptyCompany(): CompanyRecord {
  return {
    id: crypto.randomUUID(),
    name: "Yeni OSGB firmasi",
    shortName: "Yeni firma",
    kind: "Ozel Sektor",
    companyType: "osgb_musteri",
    address: "",
    city: "",
    district: "",
    sector: "",
    naceCode: "",
    hazardClass: "",
    taxNumber: "",
    taxOffice: "",
    sgkWorkplaceNumber: "",
    fax: "",
    employerTitle: "",
    employeeCount: 0,
    shiftModel: "",
    phone: "",
    email: "",
    contactPerson: "",
    employerName: "",
    employerRepresentative: "",
    notes: "",
    activeProfessionals: 0,
    employeeRepresentativeCount: 0,
    supportStaffCount: 0,
    openActions: 0,
    overdueActions: 0,
    openRiskAssessments: 0,
    documentCount: 0,
    completionRate: 0,
    maturityScore: 0,
    openRiskScore: 0,
    last30DayImprovement: 0,
    completedTrainingCount: 0,
    expiringTrainingCount: 0,
    periodicControlCount: 0,
    overduePeriodicControlCount: 0,
    lastAnalysisDate: "",
    lastInspectionDate: "",
    lastDrillDate: "",
    locations: [""],
    departments: [""],
  };
}

function mapRiskTone(label: string): "success" | "warning" | "danger" | "neutral" {
  if (label === "Kritik") return "danger";
  if (label === "Yuksek" || label === "Orta") return "warning";
  if (label === "Kontrollu") return "success";
  return "neutral";
}

function mapHazardTone(
  hazardClass: string,
): PremiumIconTone {
  if (hazardClass === "Cok Tehlikeli") return "orange";
  if (hazardClass === "Tehlikeli") return "amber";
  if (hazardClass === "Az Tehlikeli") return "emerald";
  return "cobalt";
}

const topActionClassName =
  "inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]";

const topSecondaryActionClassName = `${topActionClassName} border border-border bg-card text-foreground hover:border-primary/35 hover:bg-primary/5`;
const topAccentActionClassName = `${topActionClassName} border border-primary/20 bg-primary/10 text-foreground hover:bg-primary/15`;

const quickActionClassName =
  "inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]";

const quickActionPrimaryClassName = `${quickActionClassName} bg-primary text-primary-foreground hover:bg-primary/90`;
const quickActionSecondaryClassName = `${quickActionClassName} border border-border bg-card text-foreground hover:border-primary/35 hover:bg-primary/5`;
const quickActionAccentClassName = `${quickActionClassName} border border-primary/20 bg-primary/10 text-foreground hover:bg-primary/15`;

export function OsgbFirmsClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<AccountContextResponse | null>(null);
  const [activeCompanies, setActiveCompanies] = useState<CompanyRecord[]>([]);
  const [archivedCompanies, setArchivedCompanies] = useState<CompanyRecord[]>([]);
  const [search, setSearch] = useState("");
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [accountContext, activeRows, archivedRows] = await Promise.all([
      fetchAccountContext(),
      fetchCompaniesFromSupabase(),
      fetchArchivedFromSupabase(),
    ]);

    setAccount(accountContext);
    setActiveCompanies(activeRows ?? []);
    setArchivedCompanies(archivedRows ?? []);
    setMounted(true);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const usage = account?.usage ?? null;
  const activeLimitReached = Boolean(
    usage &&
      usage.maxActiveWorkspaces !== null &&
      usage.activeWorkspaceCount >= usage.maxActiveWorkspaces,
  );

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeCompanies;

    return activeCompanies.filter((company) =>
      [
        company.name,
        company.shortName,
        company.sector,
        company.address,
        company.city,
        company.hazardClass,
        company.naceCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [activeCompanies, search]);

  const stats = useMemo(() => {
    return {
      firmCount: activeCompanies.length,
      employeeCount: activeCompanies.reduce((sum, company) => sum + company.employeeCount, 0),
      assignedProfessionalCount: activeCompanies.reduce(
        (sum, company) => sum + company.activeProfessionals,
        0,
      ),
      overdueCount: activeCompanies.reduce((sum, company) => sum + company.overdueActions, 0),
    };
  }, [activeCompanies]);

  async function handleCreateCompany() {
    if (activeLimitReached) return;

    const company = createEmptyCompany();
    const workspaceId = await createCompanyInSupabase(company);

    await loadData();

    if (workspaceId) {
      router.push(`/workspace/${workspaceId}`);
    }
  }

  async function handleArchiveCompany(companyId: string) {
    setArchivingId(companyId);
    try {
      await archiveCompanyInSupabase(companyId);
      await loadData();
    } finally {
      setArchivingId(null);
    }
  }

  async function handleRestoreCompany(companyId: string) {
    if (activeLimitReached) return;
    setRestoringId(companyId);
    try {
      await restoreCompanyInSupabase(companyId);
      await loadData();
    } finally {
      setRestoringId(null);
    }
  }

  if (!mounted) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="OSGB Firmalari"
          title="Firma portfoyu hazirlaniyor"
          description="Musteri firmalar, gorevlendirmeler ve dokuman akislarini yapi yuklenirken hazirliyoruz."
        />
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OSGB Firma Yonetimi"
        title="Firmalar ve calisma alanlari"
        description="Musteri firmalarinizi, firma bazli workspace yapilarini ve bu firmalara atanan personel akislarini buradan yonetin."
        meta={
          <>
            <Badge variant="neutral">
              {!usage || usage.maxActiveWorkspaces === null
                ? `${usage?.activeWorkspaceCount ?? activeCompanies.length} aktif firma`
                : `${usage?.activeWorkspaceCount ?? activeCompanies.length} / ${usage.maxActiveWorkspaces} aktif firma`}
            </Badge>
            <Badge variant="neutral">
              {!usage || usage.maxActiveStaffSeats === null
                ? `${usage?.activeStaffCount ?? 0} aktif personel`
                : `${usage?.activeStaffCount ?? 0} / ${usage.maxActiveStaffSeats} aktif personel`}
            </Badge>
          </>
        }
        actions={
          <>
            <Link
              href="/osgb/personnel"
              className={topAccentActionClassName}
            >
              <UserPlus2 className="h-4 w-4" />
              Personel ve davet
            </Link>
            <Link
              href="/osgb/assignments"
              className={topSecondaryActionClassName}
            >
              <ShieldCheck className="h-4 w-4" />
              Gorevlendirmeleri ac
            </Link>
            <Button onClick={() => void handleCreateCompany()} disabled={activeLimitReached}>
              <ArrowRight className="h-4 w-4" />
              Yeni firma ekle
            </Button>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Aktif firma
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{stats.firmCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            OSGB panelinde takip edilen aktif musteri firma sayisi.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Atanan profesyonel
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {stats.assignedProfessionalCount}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Firmalara dagitilan uzman, hekim ve DSP toplam atama sayisi.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Toplam calisan
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{stats.employeeCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Firma kayitlarindaki toplam calisan hacmi ve planlama girdisi.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Geciken is
          </p>
          <p className="mt-2 text-3xl font-semibold text-danger">{stats.overdueCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Gorevlendirme ve DÖF akislarinda dikkate alinmasi gereken acik isler.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">OSGB odakli kurgu</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Bu yuzey yalnizca OSGB owner ve admin kullanicilari icindir. Firmalar, gorevlendirmeler,
                sozlesmeler ve dokuman takibi tek yerden yonetilir.
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Gorevlendirilen personel bu paneli degil, kendi profesyonel akislarini kullanir.
                Personel sadece atandigi firma workspace verilerine kendi hesabi uzerinden erisir.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground lg:min-w-[15rem]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Yonetim odağı
              </p>
              <p className="mt-2 text-2xl font-semibold">{stats.firmCount}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                aktif firma, {stats.assignedProfessionalCount} atanmis profesyonel ve {stats.overdueCount} dikkat isteyen is
                bu merkezden yonetiliyor.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/osgb/personnel" className={quickActionPrimaryClassName}>
              <UserPlus2 className="h-4 w-4" />
              Personel davet et
            </Link>
            <Link href="/osgb/assignments" className={quickActionAccentClassName}>
              <ShieldCheck className="h-4 w-4" />
              Gorevlendirmeleri yonet
            </Link>
            <Link href="/osgb/contracts" className={quickActionSecondaryClassName}>
              <Building2 className="h-4 w-4" />
              Sozlesmeleri ac
            </Link>
            <Link href="/osgb/documents" className={quickActionSecondaryClassName}>
              <FileText className="h-4 w-4" />
              Dokuman merkezine git
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <PremiumIconBadge icon={ShieldAlert} tone="gold" size="md" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Nova OSGB Manager</h2>
              <p className="text-sm text-muted-foreground">
                Yonetim yardimcisi; personel ve firma performansini izler.
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Firma bazli yuk dagilimini gor.</li>
            <li>Geciken gorev ve dokumanlari ayikla.</li>
            <li>Personel gorevlendirme bosluklarini tespit et.</li>
            <li>Sozlesme ve rapor yenileme risklerini onceliklendir.</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/solution-center?surface=osgb-manager" className={quickActionPrimaryClassName}>
              <ShieldAlert className="h-4 w-4" />
              Nova OSGB'yi ac
            </Link>
            <Link href="/osgb/tasks" className={quickActionAccentClassName}>
              <ArrowRight className="h-4 w-4" />
              Geciken isleri incele
            </Link>
            <Link href="/osgb/assignments" className={quickActionSecondaryClassName}>
              <ShieldCheck className="h-4 w-4" />
              Atama bosluklarini gor
            </Link>
          </div>
        </div>
      </section>

      {activeLimitReached ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-foreground">
          Aktif firma limitine ulasildi. Yeni firma eklemek icin bir firmayi arsive al ya da paketi yukselt.
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Aktif firmalar</h2>
            <p className="text-sm text-muted-foreground">
              Firma, gorevlendirme, dokuman ve risk akislarinizi firma workspace bazinda yonetin.
            </p>
          </div>
          <div className="w-full md:max-w-sm">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Firma ara
            </label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Firma, sektor, adres veya NACE ara"
              className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {filteredCompanies.length === 0 ? (
            <EmptyState
              title="Aktif firma bulunamadi"
              description="OSGB paneline bagli musteri firmalari burada listelenecek."
              action={
                <Button onClick={() => void handleCreateCompany()} disabled={activeLimitReached}>
                  Ilk firmayi ekle
                </Button>
              }
            />
          ) : (
            filteredCompanies.map((company) => {
              const riskState = getOverallRiskState(company);
              return (
                <article
                  key={company.id}
                  className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-4">
                      <PremiumIconBadge
                        icon={Building2}
                        tone={mapHazardTone(company.hazardClass)}
                        size="lg"
                      />
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/workspace/${company.slug || company.id}`}
                            className="text-xl font-semibold text-foreground transition-colors hover:text-primary"
                          >
                            {company.name}
                          </Link>
                          <Badge variant={mapRiskTone(riskState.label)}>
                            {riskState.label}
                            {riskState.score !== null ? ` ${riskState.score}` : ""}
                          </Badge>
                          {company.hazardClass ? (
                            <Badge variant="neutral">{company.hazardClass}</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {company.sector || "Sektor tanimsiz"}
                          {company.address ? ` · ${company.address}` : ""}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                            <Users className="h-3.5 w-3.5" />
                            {company.activeProfessionals} atanmis profesyonel
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                            <FileText className="h-3.5 w-3.5" />
                            {company.documentCount} dokuman
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                            {company.employeeCount} calisan
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                            {company.overdueActions} geciken is
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 xl:max-w-[34rem] xl:justify-end">
                      <Link
                        href={`/workspace/${company.slug || company.id}`}
                        className={quickActionSecondaryClassName}
                      >
                        <FolderOpen className="h-4 w-4" />
                        Firma workspace
                      </Link>
                      <Link
                        href={`/osgb/personnel?workspaceId=${company.id}`}
                        className={quickActionPrimaryClassName}
                      >
                        <UserPlus2 className="h-4 w-4" />
                        Personel ve davet
                      </Link>
                      <Link
                        href={`/osgb/assignments?workspaceId=${company.id}`}
                        className={quickActionAccentClassName}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Gorevlendirme
                      </Link>
                      <Link
                        href={`/osgb/tasks?workspaceId=${company.id}`}
                        className={quickActionSecondaryClassName}
                      >
                        <ArrowRight className="h-4 w-4" />
                        Is takibi
                      </Link>
                      <Link
                        href={`/osgb/documents?workspaceId=${company.id}`}
                        className={quickActionSecondaryClassName}
                      >
                        <FileText className="h-4 w-4" />
                        Dokumanlar
                      </Link>
                      <Link
                        href={`/osgb/contracts?workspaceId=${company.id}`}
                        className={quickActionSecondaryClassName}
                      >
                        <Building2 className="h-4 w-4" />
                        Sozlesmeler
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => void handleArchiveCompany(company.id)}
                        disabled={archivingId === company.id}
                        className="h-11 rounded-2xl border-border px-4 text-sm font-semibold shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-warning/35 hover:bg-warning/5 hover:shadow-[var(--shadow-card)]"
                      >
                        {archivingId === company.id ? "Arsivleniyor..." : "Arsive al"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Arsivlenen firmalar</h2>
            <p className="text-sm text-muted-foreground">
              Arsivlenen firmalar aktif limit hesabina dahil edilmez; risk ve dokuman gecmisi korunur.
            </p>
          </div>
          <Badge variant="neutral">{archivedCompanies.length} arsiv kaydi</Badge>
        </div>

        <div className="mt-5 space-y-3">
          {archivedCompanies.length === 0 ? (
            <EmptyState
              title="Arsivde firma yok"
              description="Bir firmayi arsive aldiginda burada goreceksin."
            />
          ) : (
            archivedCompanies.map((company) => (
              <div
                key={company.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-foreground">{company.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {company.sector || "Sektor tanimsiz"} · {company.employeeCount} calisan
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void handleRestoreCompany(company.id)}
                  disabled={activeLimitReached || restoringId === company.id}
                >
                  {restoringId === company.id ? "Geri yukleniyor..." : "Geri yukle"}
                </Button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
