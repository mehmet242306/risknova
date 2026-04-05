"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistedState } from "@/lib/use-persisted-state";
import { useRouter, useSearchParams } from "next/navigation";
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

/** Büyük resmi max boyuta küçült, JPEG olarak döndür */
function resizeImageFile(file: File, maxPx: number, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        const ratio = Math.min(maxPx / w, maxPx / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("blob")); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const AK = "risknova_archived_companies";
const DK = "risknova_deleted_companies";
function ldAr(): CompanyRecord[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(AK) || "[]"); } catch { return []; } }
function svAr(l: CompanyRecord[]) { localStorage.setItem(AK, JSON.stringify(l)); }
function ldDl(): CompanyRecord[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(DK) || "[]"); } catch { return []; } }
function svDl(l: CompanyRecord[]) { localStorage.setItem(DK, JSON.stringify(l)); }

const TABS: { k: WTab; l: string }[] = [
  { k: "overview", l: "Genel Durum" },
  { k: "structure", l: "Yerleşke" },
  { k: "risk", l: "Risk ve Saha" },
  { k: "people", l: "Ekip" },
  { k: "personnel", l: "Personel" },
  { k: "planner", l: "Planlama" },
  { k: "tracking", l: "Takip" },
  { k: "documents", l: "Dökümanlar" },
  { k: "organization", l: "Organizasyon" },
  { k: "history", l: "Geçmiş" },
  { k: "digital_twin", l: "Dijital İkiz" },
];

function rbv(l: string): "success" | "warning" | "danger" | "neutral" { if (l === "Kritik") return "danger"; if (l === "Y\u00FCksek" || l === "Orta") return "warning"; if (l === "Kontroll\u00FC") return "success"; return "neutral"; }
function hbv(h: string): "danger" | "warning" | "success" | "neutral" { if (h === "\u00C7ok Tehlikeli") return "danger"; if (h === "Tehlikeli") return "warning"; if (h === "Az Tehlikeli") return "success"; return "neutral"; }

export function CompanyWorkspaceClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = usePersistedState<WTab>("company:tab", "overview");

  // URL query param'dan tab oku (örn: ?tab=people)
  useEffect(() => {
    const urlTab = searchParams.get("tab") as WTab | null;
    if (urlTab && TABS.some((t) => t.k === urlTab)) {
      setTab(urlTab);
    }
  }, [searchParams, setTab]);
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

    // Client-side validation
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      setLogoFeedback({ ok: false, msg: `Dosya boyutu çok büyük (${(file.size / 1024 / 1024).toFixed(1)}MB). Maksimum 5MB olmalı.` });
      setTimeout(() => setLogoFeedback(null), 4000);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setLogoFeedback({ ok: false, msg: "Sadece resim dosyaları yüklenebilir (PNG, JPEG, WebP, SVG)." });
      setTimeout(() => setLogoFeedback(null), 4000);
      return;
    }

    setLogoUploading(true);
    setLogoFeedback(null);

    // Büyük resimleri otomatik küçült (max 800px, JPEG %85)
    let uploadFile = file;
    if (file.type !== "image/svg+xml" && file.size > 512 * 1024) {
      try {
        uploadFile = await resizeImageFile(file, 800, 0.85);
      } catch { /* küçültme başarısızsa orijinali kullan */ }
    }

    const url = await uploadCompanyLogo(company.id, uploadFile);
    if (url) {
      setCompany((prev) => prev ? { ...prev, logo_url: url } : prev);
      setLogoFeedback({ ok: true, msg: "Logo/görsel güncellendi." });
    } else {
      setLogoFeedback({ ok: false, msg: "Yükleme başarısız. Lütfen farklı bir dosya deneyin." });
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
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary text-sm font-bold text-muted-foreground shadow-sm">
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
                accept="image/*"
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
              <Link href="/companies" className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Firmalar
              </Link>
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

      {/* ── Sticky Tab Bar (Satır 3 — firma tabları) ── */}
      <div
        className="sticky top-[138px] z-30 -mx-4 bg-white px-4 dark:bg-[#0A0E18] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        style={{
          borderTop: "2px solid var(--tab-bar-border-top)",
          borderBottom: "2px solid var(--tab-bar-border-bottom)",
        }}
      >
        <div className="overflow-x-auto">
          <nav className="flex min-w-max justify-center gap-0.5 py-1">
            {TABS.map((t) => {
              const isActive = tab === t.k;
              return (
                <button
                  key={t.k}
                  type="button"
                  onClick={() => setTab(t.k)}
                  className="relative inline-flex items-center whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200"
                  style={{
                    color: isActive ? "var(--tab-bar-active)" : "var(--tab-bar-text)",
                    background: isActive ? "var(--tab-bar-hover-bg)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--tab-bar-hover-text)"; e.currentTarget.style.background = "var(--tab-bar-hover-bg)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = "var(--tab-bar-text)"; e.currentTarget.style.background = "transparent"; } }}
                >
                  {t.l}
                  {isActive && (
                    <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full" style={{ background: "var(--tab-bar-active)" }} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Content + Sidebar ── */}
      <div className={`mt-5 ${tab === "overview" ? "grid gap-6 lg:grid-cols-[1fr_300px]" : ""}`}>
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

        {/* Sidebar — sadece Genel Durum sekmesinde */}
        <aside className={`space-y-4 ${tab === "overview" ? "hidden lg:block" : "hidden"}`}>
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
