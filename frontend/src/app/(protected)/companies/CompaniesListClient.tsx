"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  defaultCompanyDirectory,
  loadCompanyDirectory,
  saveCompanyDirectory,
  type CompanyRecord,
} from "@/lib/company-directory";
import { getOverallRiskState } from "@/lib/workplace-status";

function createEmptyCompany(): CompanyRecord {
  return {
    id: crypto.randomUUID(),
    name: "Yeni Firma / Kurum",
    shortName: "Yeni Kayıt",
    kind: "Özel Sektör",
    address: "",
    sector: "",
    naceCode: "",
    hazardClass: "",
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

export function CompaniesListClient() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyRecord[]>(() => loadCompanyDirectory());
  const [search, setSearch] = useState("");
  const [hazardFilter, setHazardFilter] = useState("");

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const haystack = [
        company.name,
        company.shortName,
        company.kind,
        company.sector,
        company.address,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(search.toLowerCase().trim());
      const matchesHazard = hazardFilter
        ? company.hazardClass === hazardFilter
        : true;

      return matchesSearch && matchesHazard;
    });
  }, [companies, search, hazardFilter]);

  const stats = useMemo(() => {
    const totalCompanies = companies.length;
    const totalEmployees = companies.reduce(
      (sum, company) => sum + company.employeeCount,
      0,
    );
    const criticalCount = companies.filter((company) => {
      const risk = getOverallRiskState(company);
      return risk.label === "Kritik";
    }).length;
    const avgMaturity =
      companies.length > 0
        ? Math.round(
            companies.reduce((sum, company) => sum + company.maturityScore, 0) /
              companies.length,
          )
        : 0;

    return {
      totalCompanies,
      totalEmployees,
      criticalCount,
      avgMaturity,
    };
  }, [companies]);

  function handleCreateCompany() {
    const next = createEmptyCompany();
    const nextDirectory = [...loadCompanyDirectory(), next];
    saveCompanyDirectory(nextDirectory);
    setCompanies(nextDirectory);
    router.push(`/companies/${next.id}`);
  }

  function handleResetDefaults() {
    saveCompanyDirectory(defaultCompanyDirectory);
    setCompanies(defaultCompanyDirectory);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="İşyeri Listesi"
        title="Firmalar / Kurumlar"
        description="Her firma için ayrı çalışma alanı açılır. Risk analizi, takip, dokümanlar ve ileride dijital ikiz aynı yapı içinde yönetilir."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={handleCreateCompany}>
              Yeni Firma / Kurum
            </Button>
            <Button type="button" variant="outline" onClick={handleResetDefaults}>
              Varsayılan Liste
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Toplam Firma
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {stats.totalCompanies}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Toplam Çalışan
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {stats.totalEmployees}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Kritik İşyeri
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {stats.criticalCount}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Ortalama İSG Olgunluğu
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            %{stats.avgMaturity}
          </p>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <Input
            label="Firma / kurum ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ad, sektör, tür veya adres ile ara"
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              Tehlike sınıfı
            </label>
            <select
              value={hazardFilter}
              onChange={(event) => setHazardFilter(event.target.value)}
              className="h-11 rounded-2xl border border-border bg-input px-4 text-sm text-foreground shadow-[var(--shadow-soft)]"
            >
              <option value="">Tümü</option>
              <option value="Az Tehlikeli">Az Tehlikeli</option>
              <option value="Tehlikeli">Tehlikeli</option>
              <option value="Çok Tehlikeli">Çok Tehlikeli</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredCompanies.map((company) => {
          const risk = getOverallRiskState(company);

          return (
            <div
              key={company.id}
              className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {company.name}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {company.kind} · {company.sector || "Sektör yok"} ·{" "}
                      {company.address || "Adres yok"}
                    </p>
                  </div>

                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${risk.className}`}
                  >
                    {risk.label}
                    {risk.score !== null ? ` · ${risk.score}/100` : ""}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-muted px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Tehlike
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {company.hazardClass || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Çalışan
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {company.employeeCount}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Açık Aksiyon
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {company.openActions}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Lokasyon
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {company.locations.filter(Boolean).length}
                    </p>
                  </div>
                </div>

                <p className="text-sm leading-7 text-muted-foreground">
                  {risk.description}
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/companies/${company.id}`}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
                  >
                    Çalışma Alanını Aç
                  </Link>

                  <Link
                    href="/risk-analysis"
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  >
                    Risk Analizi
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="rounded-[1.75rem] border border-border bg-card p-6 text-sm leading-7 text-muted-foreground shadow-[var(--shadow-card)]">
          Arama veya filtreye uygun firma / kurum bulunamadı.
        </div>
      ) : null}
    </div>
  );
}


