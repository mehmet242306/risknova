"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadCompanyDirectory, saveCompanyDirectory, type CompanyRecord } from "@/lib/company-directory";
import { getGuidedTasks, getOverallRiskState, getReminderItems } from "@/lib/workplace-status";
import { CompanyManagementActions } from "@/components/companies/CompanyManagementActions";
import { PersonnelManagementPanel } from "@/components/companies/PersonnelManagementPanel";
import { fetchCompaniesFromSupabase, saveCompanyToSupabase, archiveCompanyInSupabase, deleteCompanyInSupabase, uploadCompanyLogo } from "@/lib/supabase/company-api";
import { type WTab, OverviewTab, StructureTab, RiskTab, TrackingTab, DocumentsTab, HistoryTab, DigitalTwinTab } from "@/components/companies/WorkspaceTabs";
import { CompanyPlannerTab } from "@/components/companies/CompanyPlannerTab";
import { TeamManagementTab } from "@/components/companies/TeamManagementTab";
import { OrganizationPanel } from "@/components/companies/OrganizationPanel";

const AK = "risknova_archived_companies";
const DK = "risknova_deleted_companies";
function ldAr(): CompanyRecord[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(AK) || "[]"); } catch { return []; } }
function svAr(l: CompanyRecord[]) { localStorage.setItem(AK, JSON.stringify(l)); }
function ldDl(): CompanyRecord[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(DK) || "[]"); } catch { return []; } }
function svDl(l: CompanyRecord[]) { localStorage.setItem(DK, JSON.stringify(l)); }

const TABS: { k: WTab; l: string }[] = [
  { k: "overview", l: "Genel Durum" }, { k: "structure", l: "Yerle\u015Fke" }, { k: "risk", l: "Risk ve Saha" },
  { k: "people", l: "Ekip" }, { k: "personnel", l: "Personel" }, { k: "planner", l: "Planlama" }, { k: "tracking", l: "Takip" },
  { k: "documents", l: "D\u00F6k\u00FCmanlar" }, { k: "organization", l: "Organizasyon" },
  { k: "history", l: "Ge\u00E7mi\u015F" }, { k: "digital_twin", l: "Dijital \u0130kiz" },
];

function rbv(l: string): "success" | "warning" | "danger" | "neutral" { if (l === "Kritik") return "danger"; if (l === "Y\u00FCksek" || l === "Orta") return "warning"; if (l === "Kontroll\u00FC") return "success"; return "neutral"; }
function hbv(h: string): "danger" | "warning" | "success" | "neutral" { if (h === "\u00C7ok Tehlikeli") return "danger"; if (h === "Tehlikeli") return "warning"; if (h === "Az Tehlikeli") return "success"; return "neutral"; }

export function CompanyWorkspaceClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<WTab>("overview");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFeedback, setLogoFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const sb = await fetchCompaniesFromSupabase();
    if (sb) { const f = sb.find((c) => c.id === companyId); if (f) { setCompany(f); setLoading(false); return; } }
    const loc = loadCompanyDirectory(); const f = loc.find((c) => c.id === companyId);
    if (f) setCompany(f); else if (loc.length > 0) setCompany(loc[0]);
    setLoading(false);
  }, [companyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const upd = useCallback((patch: Partial<CompanyRecord>) => { setCompany((p) => (p ? { ...p, ...patch } : p)); }, []);

  const save = useCallback(async () => {
    if (!company) return; setSaving(true);
    const ok = await saveCompanyToSupabase(company);
    if (!ok) { const d = loadCompanyDirectory(); const i = d.findIndex((c) => c.id === company.id); if (i >= 0) d[i] = company; else d.push(company); saveCompanyDirectory(d); }
    setSaving(false);
  }, [company]);

  const doArchive = useCallback(async () => {
    if (!company) return;
    if ((await archiveCompanyInSupabase(company.id)) === true) { router.push("/companies"); return; }
    saveCompanyDirectory(loadCompanyDirectory().filter((c) => c.id !== company.id)); svAr([...ldAr(), company]); router.push("/companies");
  }, [company, router]);

  const doDelete = useCallback(async () => {
    if (!company) return;
    if ((await deleteCompanyInSupabase(company.id)) === true) { router.push("/companies"); return; }
    saveCompanyDirectory(loadCompanyDirectory().filter((c) => c.id !== company.id)); svDl([...ldDl(), company]); router.push("/companies");
  }, [company, router]);


  const handleLogoUpload = useCallback(async (file: File) => {
    if (!company) return;
    setLogoUploading(true);
    setLogoFeedback(null);
    const url = await uploadCompanyLogo(company.id, file);
    if (url) {
      setCompany((prev) => prev ? { ...prev, logo_url: url } : prev);
      setLogoFeedback({ ok: true, msg: "Logo güncellendi." });
    } else {
      setLogoFeedback({ ok: false, msg: "Logo yüklenemedi. Dosya boyutu 2MB'ı geçmemeli." });
    }
    setLogoUploading(false);
    setTimeout(() => setLogoFeedback(null), 3000);
  }, [company]);

  const risk = useMemo(() => (company ? getOverallRiskState(company) : null), [company]);
  const tasks = useMemo(() => (company ? getGuidedTasks(company) : []), [company]);
  const reminders = useMemo(() => (company ? getReminderItems(company) : []), [company]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  if (!company) return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
      <p className="text-lg font-semibold text-foreground">{"Firma bulunamad\u0131"}</p>
      <p className="mt-2 text-sm text-muted-foreground">{"Bu ID ile e\u015Fle\u015Fen firma kayd\u0131 yok."}</p>
      <Link href="/companies" className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors">{"Firmalara D\u00F6n"}</Link>
    </div>
  );

  const lc = company.locations.filter(Boolean).length;
  const dc = company.departments.filter(Boolean).length;

  return (
    <div className="space-y-0">
      {/* ── Compact Hero ── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        {/* Logo feedback toast */}
        {logoFeedback && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${logoFeedback.ok ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
            {logoFeedback.msg}
          </div>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Logo / Initials */}
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary text-sm font-bold text-muted-foreground shadow-sm">
                {company.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logo_url} alt={company.name} className="h-full w-full object-contain p-1" />
                ) : (
                  <span>{(company.shortName || company.name).slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              {/* Upload button */}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                title="Logo yükle"
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-card bg-primary text-white shadow transition hover:brightness-110 disabled:opacity-60"
              >
                {logoUploading ? (
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white/40 border-t-white" />
                ) : (
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                )}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
            {/* Name / meta */}
            <div className="min-w-0 flex-1">
              <Link href="/companies" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">← Firmalar</Link>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{company.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {company.kind}{company.sector ? ` · ${company.sector}` : ""}{company.address ? ` · ${company.address}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {risk && <Badge variant={rbv(risk.label)}>{risk.label}{risk.score !== null ? ` ${risk.score}` : ""}</Badge>}
            {company.hazardClass && <Badge variant={hbv(company.hazardClass)}>{company.hazardClass}</Badge>}
            <Button size="sm" onClick={() => void save()} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
            <Button variant="outline" size="sm" onClick={() => setTab("organization")}>Davet Et</Button>
          </div>
        </div>
        {/* Mini stat cards — 48px height */}
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            { l: "\u00C7al\u0131\u015Fan", v: company.employeeCount, warn: false },
            { l: "Lokasyon", v: lc, warn: false },
            { l: "B\u00F6l\u00FCm", v: dc, warn: false },
            { l: "A\u00E7\u0131k Aksiyon", v: company.openActions, warn: false },
            { l: "Geciken", v: company.overdueActions, warn: company.overdueActions > 0 },
            { l: "Olgunluk", v: `%${company.maturityScore}`, warn: false },
          ].map((s) => (
            <div key={s.l} className="flex h-12 flex-col justify-center rounded-lg border border-border bg-secondary/50 px-2.5 text-center">
              <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
              <p className={`text-sm font-semibold tabular-nums ${s.warn ? "text-danger" : "text-foreground"}`}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sticky Underline Tabs ── */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-border bg-card px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="overflow-x-auto">
          <nav className="flex min-w-max">
            {TABS.map((t) => (
              <button key={t.k} type="button" onClick={() => setTab(t.k)}
                className={`relative inline-flex items-center whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${tab === t.k ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {t.l}
                {tab === t.k && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Content + Sidebar ── */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_300px]">
        <main className="min-w-0 space-y-5">
          {tab === "overview" && <OverviewTab company={company} upd={upd} risk={risk} tasks={tasks} setTab={setTab} />}
          {tab === "structure" && <StructureTab company={company} upd={upd} />}
          {tab === "risk" && <RiskTab company={company} />}
          {tab === "people" && <TeamManagementTab companyId={companyId} companyName={company.name} />}
          {tab === "personnel" && <PersonnelManagementPanel companyId={companyId} companyName={company.name} departments={company.departments.filter(Boolean)} locations={company.locations.filter(Boolean)} />}
          {tab === "planner" && <CompanyPlannerTab companyId={companyId} companyName={company.name} />}
          {tab === "tracking" && <TrackingTab company={company} />}
          {tab === "documents" && <DocumentsTab company={company} />}
          {tab === "organization" && <OrganizationPanel companyId={companyId} />}
          {tab === "history" && <HistoryTab />}
          {tab === "digital_twin" && <DigitalTwinTab />}
        </main>

        {/* Sidebar */}
        <aside className="hidden space-y-4 lg:block">
          {risk && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <h3 className="section-title text-sm">Risk Durumu</h3>
              <div className={`mt-3 rounded-lg p-3 ${risk.className}`}>
                <p className="text-sm font-semibold">{risk.label}{risk.score !== null ? ` \u2014 ${risk.score}/100` : ""}</p>
                <p className="mt-1 text-xs leading-5">{risk.description}</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <h3 className="section-title text-sm">{"Hat\u0131rlatmalar"}</h3>
            <ul className="mt-3 space-y-2">
              {reminders.map((r, i) => (<li key={i} className="text-xs text-muted-foreground leading-5">{"\u2022"} {r}</li>))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <h3 className="section-title text-sm">Son Aktivite</h3>
            <div className="mt-3 space-y-2.5">
              {[
                { a: "Mehmet Y.", r: "\u0130SG Uzman\u0131", d: "Risk analizi g\u00FCncellendi", t: "2 saat \u00F6nce" },
                { a: "Ay\u015Fe K.", r: "\u0130\u015Fveren Vekili", d: "Acil durum plan\u0131 onayland\u0131", t: "D\u00FCn" },
                { a: "Sistem", r: "Otomatik", d: "Periyodik kontrol hat\u0131rlatmas\u0131", t: "2 g\u00FCn \u00F6nce" },
              ].map((act, i) => (
                <div key={i} className="rounded-lg border border-border bg-secondary/30 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{act.a}</p>
                    <span className="text-[10px] text-muted-foreground">{act.t}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{act.r}</p>
                  <p className="mt-0.5 text-xs text-foreground">{act.d}</p>
                </div>
              ))}
            </div>
          </div>

          <CompanyManagementActions companyName={company.name} onArchiveConfirm={() => void doArchive()} onDeleteConfirm={() => void doDelete()} />
        </aside>
      </div>

    </div>
  );
}
