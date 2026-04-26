"use client";
import NextImage from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistedState } from "@/lib/use-persisted-state";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadCompanyDirectory, saveCompanyDirectory, type CompanyRecord } from "@/lib/company-directory";
import { getOverallRiskState } from "@/lib/workplace-status";
import { CompanyManagementActions } from "@/components/companies/CompanyManagementActions";
import { PersonnelManagementPanel } from "@/components/companies/PersonnelManagementPanel";
import { fetchCompaniesFromSupabase, saveCompanyToSupabase, archiveCompanyInSupabase, deleteCompanyInSupabase, uploadCompanyLogo } from "@/lib/supabase/company-api";
import { computeCompanyRiskScores } from "@/lib/supabase/risk-assessment-api";
import { fetchWorkspacePersonnelStats } from "@/lib/supabase/personnel-api";
import { type WTab, StructureTab, RiskTab, TrackingTab, HistoryTab } from "@/components/companies/WorkspaceTabs";
import { TeamManagementTab } from "@/components/companies/TeamManagementTab";
import { OrganizationPanel } from "@/components/companies/OrganizationPanel";
import { OhsFileTab } from "@/components/companies/OhsFileTab";

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
  { k: "structure", l: "Yerleşke" },
  { k: "risk", l: "Risk ve Saha" },
  { k: "people", l: "Ekip" },
  { k: "personnel", l: "Personel" },
  { k: "tracking", l: "Takip" },
  { k: "ohs_file", l: "İSG Dosyası" },
  { k: "organization", l: "Organizasyon" },
  { k: "history", l: "Geçmiş" },
];

function rbv(l: string): "success" | "warning" | "danger" | "neutral" { if (l === "Kritik") return "danger"; if (l === "Y\u00FCksek" || l === "Orta") return "warning"; if (l === "Kontroll\u00FC") return "success"; return "neutral"; }
function hbv(h: string): "danger" | "warning" | "success" | "neutral" { if (h === "\u00C7ok Tehlikeli") return "danger"; if (h === "Tehlikeli") return "warning"; if (h === "Az Tehlikeli") return "success"; return "neutral"; }

export function CompanyWorkspaceClient({ companyId }: { companyId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = usePersistedState<WTab>("company:tab", "structure");

  // Migration: Eski "overview" (Genel Durum) sekmesi kaldırıldı. localStorage'da
  // kalıntısı varsa veya geçersiz bir key varsa "structure"a sıfırla.
  useEffect(() => {
    if (!TABS.some((t) => t.k === tab)) {
      setTab("structure");
    }
  }, [tab, setTab]);

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
    let found: CompanyRecord | undefined;
    const sb = await fetchCompaniesFromSupabase();
    if (sb) { found = sb.find((c) => c.id === companyId); }
    if (!found) {
      const loc = loadCompanyDirectory();
      found = loc.find((c) => c.id === companyId) ?? loc[0];
    }
    if (found) {
      // Dinamik skor hesaplama — DB'deki gerçek verilerden
      try {
        const scores = await computeCompanyRiskScores(found.id);
        found = { ...found, ...scores };
      } catch { /* skor hesaplanamazsa mevcut değerlerle devam */ }
      setCompany(found);
    }
    setLoading(false);
  }, [companyId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Document title — firma adı görünsün, UUID görünmesin
  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.title;
    document.title = company?.name ? `${company.name} — Workspace · RiskNova` : "Workspace · RiskNova";
    return () => { document.title = original; };
  }, [company?.name]);

  // URL slug normalization — UUID ile geldiyse slug'a yönlendir
  useEffect(() => {
    if (!company?.slug) return;
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path.startsWith("/companies/") && !path.includes(company.slug)) {
      window.history.replaceState({}, "", `/workspace/${company.slug}${window.location.search}`);
    }
  }, [company?.slug]);

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

  // Hero üst şeridindeki risk rozetinde kullanılıyor.
  const risk = useMemo(() => (company ? getOverallRiskState(company) : null), [company]);

  // Hero stat kartları — canlı DB'den (cached metadata.employeeCount yerine).
  const [liveStats, setLiveStats] = useState<{
    active: number;
    distinctDepartments: number;
    distinctLocations: number;
  } | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    let cancelled = false;
    (async () => {
      const stats = await fetchWorkspacePersonnelStats(company.id);
      if (!cancelled && stats) setLiveStats(stats);
    })();
    return () => { cancelled = true; };
  }, [company?.id]);

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

  // Lokasyon/Bölüm sayısı: önce Yerleşke tabında yapılandırılmış liste, yoksa
  // personel kayıtlarından türetilen distinct değerler (daha büyük olanı al).
  const lc = Math.max(
    company.locations.filter(Boolean).length,
    liveStats?.distinctLocations ?? 0,
  );
  const dc = Math.max(
    company.departments.filter(Boolean).length,
    liveStats?.distinctDepartments ?? 0,
  );
  // Çalışan sayısı: canlı personel tablosundan (cached metadata.employeeCount
  // senkron olmayabiliyor — özellikle toplu içe aktarım sonrası).
  const employeeCount = liveStats?.active ?? company.employeeCount;

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
                  <NextImage
                    src={company.logo_url}
                    alt={company.name}
                    width={56}
                    height={56}
                    className="h-full w-full object-contain p-1"
                  />
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
              <Link href="/companies" className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Çalışma Alanları
              </Link>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{company.name}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {company.kind}{company.sector ? ` · ${company.sector}` : ""}{company.address ? ` · ${company.address}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {risk && <Badge variant={rbv(risk.label)} className="px-3 py-1 text-xs">{risk.label}{risk.score !== null ? ` ${risk.score}` : ""}</Badge>}
            {company.hazardClass && <Badge variant={hbv(company.hazardClass)} className="px-3 py-1 text-xs">{company.hazardClass}</Badge>}
            <Button onClick={() => void save()} disabled={saving} className="h-10 rounded-xl px-6 text-sm font-bold shadow-md">{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
            <Button variant="outline" onClick={() => setTab("organization")} className="h-10 rounded-xl px-5 text-sm font-semibold">Davet Et</Button>
          </div>
        </div>
        {/* Mini stat cards — premium */}
        <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {[
            { l: "\u00C7al\u0131\u015Fan", v: employeeCount, warn: false },
            { l: "Lokasyon", v: lc, warn: false },
            { l: "B\u00F6l\u00FCm", v: dc, warn: false },
            { l: "A\u00E7\u0131k Aksiyon", v: company.openActions, warn: false },
            { l: "Geciken", v: company.overdueActions, warn: company.overdueActions > 0 },
            { l: "Olgunluk", v: `%${company.maturityScore}`, warn: false },
          ].map((s) => (
            <div key={s.l} className="flex h-14 flex-col justify-center rounded-[1.1rem] border border-border/60 bg-card px-3 text-center shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.l}</p>
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${s.warn ? "text-danger" : "text-foreground"}`}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-[152px] lg:self-start">
          <div className="rounded-[1.6rem] border border-border/80 bg-card p-3 shadow-[var(--shadow-card)]">
            <div className="px-2 pb-3 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Çalışma Alanı Bölümleri
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Sol menüden bir alan seç, içeriği sağ tarafta yönet.
              </p>
            </div>

            <nav className="flex flex-col gap-1.5">
              {TABS.map((t, index) => {
                const isActive = tab === t.k;
                return (
                  <button
                    key={t.k}
                    type="button"
                    onClick={() => setTab(t.k)}
                    className={`group flex w-full items-center gap-3 rounded-[1.1rem] border px-3 py-3 text-left transition-all duration-200 ${
                      isActive
                        ? "border-[var(--gold)]/40 bg-[var(--gold-glow)] text-[var(--gold-deep)] shadow-[0_10px_28px_rgba(184,134,11,0.15)]"
                        : "border-transparent bg-secondary/20 text-foreground hover:border-border/70 hover:bg-secondary/40"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isActive
                          ? "bg-white/70 text-[var(--gold-deep)]"
                          : "bg-card text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${isActive ? "text-[var(--gold-deep)]" : "text-foreground"}`}>
                        {t.l}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {tab === "structure" && <StructureTab company={company} upd={upd} />}
          {tab === "risk" && <RiskTab company={company} />}
          {tab === "people" && <TeamManagementTab companyId={companyId} companyName={company.name} />}
          {tab === "personnel" && <PersonnelManagementPanel companyId={companyId} companyName={company.name} departments={company.departments.filter(Boolean)} locations={company.locations.filter(Boolean)} />}
          {tab === "tracking" && <TrackingTab company={company} />}
          {tab === "ohs_file" && <OhsFileTab companyWorkspaceId={companyId} companyName={company.name} />}
          {tab === "organization" && (
            <div className="space-y-5">
              <OrganizationPanel companyId={companyId} />
              {/* Arşivle/Sil aksiyonları — eski Genel Durum sekmesinden buraya taşındı. */}
              <CompanyManagementActions
                companyName={company.name}
                onArchiveConfirm={() => void doArchive()}
                onDeleteConfirm={() => void doDelete()}
              />
            </div>
          )}
          {tab === "history" && <HistoryTab companyWorkspaceId={companyId} />}
        </main>
      </div>

    </div>
  );
}
