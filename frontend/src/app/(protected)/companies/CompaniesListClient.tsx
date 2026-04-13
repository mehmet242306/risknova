"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import { PremiumIconBadge } from "@/components/ui/premium-icon-badge";
import type { PremiumIconTone } from "@/components/ui/premium-icon-badge";
import { defaultCompanyDirectory, loadCompanyDirectory, saveCompanyDirectory, type CompanyRecord } from "@/lib/company-directory";
import { getOverallRiskState } from "@/lib/workplace-status";
import { fetchCompaniesFromSupabase, fetchArchivedFromSupabase, fetchDeletedFromSupabase, createCompanyInSupabase, archiveCompanyInSupabase, restoreCompanyInSupabase, deleteCompanyInSupabase, permanentDeleteFromSupabase } from "@/lib/supabase/company-api";

/* ── localStorage helpers (fallback) ── */
const AK = "risknova_archived_companies";
const DK = "risknova_deleted_companies";
function ldA(): CompanyRecord[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(AK) || "[]") as CompanyRecord[]; } catch { return []; } }
function svA(l: CompanyRecord[]) { localStorage.setItem(AK, JSON.stringify(l)); }
function ldD(): CompanyRecord[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(DK) || "[]") as CompanyRecord[]; } catch { return []; } }
function svD(l: CompanyRecord[]) { localStorage.setItem(DK, JSON.stringify(l)); }

function mkEmpty(): CompanyRecord {
  return { id: crypto.randomUUID(), name: "Yeni Firma / Kurum", shortName: "Yeni Kayıt", kind: "Özel Sektör", companyType: "bagimsiz", address: "", city: "", district: "", sector: "", naceCode: "", hazardClass: "", taxNumber: "", taxOffice: "", sgkWorkplaceNumber: "", fax: "", employerTitle: "", employeeCount: 0, shiftModel: "", phone: "", email: "", contactPerson: "", employerName: "", employerRepresentative: "", notes: "", activeProfessionals: 0, employeeRepresentativeCount: 0, supportStaffCount: 0, openActions: 0, overdueActions: 0, openRiskAssessments: 0, documentCount: 0, completionRate: 0, maturityScore: 0, openRiskScore: 0, last30DayImprovement: 0, completedTrainingCount: 0, expiringTrainingCount: 0, periodicControlCount: 0, overduePeriodicControlCount: 0, lastAnalysisDate: "", lastInspectionDate: "", lastDrillDate: "", locations: [""], departments: [""] };
}

function rBV(l: string): "success" | "warning" | "danger" | "neutral" { if (l === "Kritik") return "danger"; if (l === "Yüksek" || l === "Orta") return "warning"; if (l === "Kontrollü") return "success"; return "neutral"; }
function hBV(h: string): "danger" | "warning" | "success" | "neutral" { if (h === "Çok Tehlikeli") return "danger"; if (h === "Tehlikeli") return "warning"; if (h === "Az Tehlikeli") return "success"; return "neutral"; }

type VM = "active" | "archived" | "deleted";
type SK = "name" | "employees" | "risk" | "overdue";

export function CompaniesListClient() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [cos, setCos] = useState<CompanyRecord[]>([]);
  const [arCos, setArCos] = useState<CompanyRecord[]>([]);
  const [dlCos, setDlCos] = useState<CompanyRecord[]>([]);
  const [ds, setDs] = useState<"supabase" | "local">("local");

  const loadAll = useCallback(async () => {
    const [a, b, c] = await Promise.all([fetchCompaniesFromSupabase(), fetchArchivedFromSupabase(), fetchDeletedFromSupabase()]);
    if (a !== null) { setCos(a); setArCos(b ?? []); setDlCos(c ?? []); setDs("supabase"); saveCompanyDirectory(a); svA(b ?? []); svD(c ?? []); }
    else { setCos(loadCompanyDirectory()); setArCos(ldA()); setDlCos(ldD()); setDs("local"); }
  }, []);
  const rl = useCallback(() => { setCos(loadCompanyDirectory()); setArCos(ldA()); setDlCos(ldD()); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadAll().then(() => setMounted(true)); }, [loadAll]);

  const [vm, setVm] = useState<VM>("active");
  const [q, setQ] = useState("");
  const [hf, setHf] = useState("");
  const [sf, setSf] = useState("");
  const [kf, setKf] = useState("");
  const [sk, setSk] = useState<SK>("name");
  const [caId, setCaId] = useState<string | null>(null);
  const [cdId, setCdId] = useState<string | null>(null);
  const [dct, setDct] = useState("");

  const sectors = useMemo(() => Array.from(new Set(cos.map(c => c.sector).filter(Boolean))).sort(), [cos]);
  const kinds = useMemo(() => Array.from(new Set(cos.map(c => c.kind).filter(Boolean))).sort(), [cos]);
  const src = vm === "active" ? cos : vm === "archived" ? arCos : dlCos;

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const f = src.filter(c => { const h = [c.name, c.shortName, c.kind, c.sector, c.address, c.naceCode].join(" ").toLowerCase(); return (!s || h.includes(s)) && (!hf || c.hazardClass === hf) && (!sf || c.sector === sf) && (!kf || c.kind === kf); });
    return [...f].sort((a, b) => { if (sk === "employees") return b.employeeCount - a.employeeCount; if (sk === "risk") return (getOverallRiskState(b).score ?? 0) - (getOverallRiskState(a).score ?? 0); if (sk === "overdue") return b.overdueActions - a.overdueActions; return a.name.localeCompare(b.name, "tr"); });
  }, [src, q, hf, sf, kf, sk]);

  const stats = useMemo(() => {
    const te = cos.reduce((s, c) => s + c.employeeCount, 0);
    const cr = cos.filter(c => getOverallRiskState(c).label === "Kritik").length;
    const am = cos.length > 0 ? Math.round(cos.reduce((s, c) => s + c.maturityScore, 0) / cos.length) : 0;
    return { total: cos.length, emp: te, crit: cr, mat: am, oa: cos.reduce((s, c) => s + c.openActions, 0), od: cos.reduce((s, c) => s + c.overdueActions, 0) };
  }, [cos]);

  async function onCreate() { const n = mkEmpty(); const sid = await createCompanyInSupabase(n); if (sid) { await loadAll(); router.push(`/companies/${sid}`); return; } saveCompanyDirectory([...loadCompanyDirectory(), n]); rl(); router.push(`/companies/${n.id}`); }
  function onReset() { saveCompanyDirectory(defaultCompanyDirectory); rl(); }
  function clr() { setQ(""); setHf(""); setSf(""); setKf(""); }
  async function doArchive(id: string) { if ((await archiveCompanyInSupabase(id)) === true) { await loadAll(); setCaId(null); return; } const t = cos.find(c => c.id === id); if (!t) return; saveCompanyDirectory(cos.filter(c => c.id !== id)); svA([...arCos, t]); rl(); setCaId(null); }
  async function doDelete(id: string) { if ((await deleteCompanyInSupabase(id)) === true) { await loadAll(); setCdId(null); setDct(""); return; } const t = cos.find(c => c.id === id); if (!t) return; saveCompanyDirectory(cos.filter(c => c.id !== id)); svD([...dlCos, t]); rl(); setCdId(null); setDct(""); }
  async function doRestore(id: string) { if ((await restoreCompanyInSupabase(id)) === true) { await loadAll(); return; } const t = arCos.find(c => c.id === id); if (!t) return; svA(arCos.filter(c => c.id !== id)); saveCompanyDirectory([...cos, t]); rl(); }
  async function doPerm(id: string) { if ((await permanentDeleteFromSupabase(id)) === true) { await loadAll(); return; } svD(dlCos.filter(c => c.id !== id)); rl(); }

  const hasF = !!(q || hf || sf || kf);
  const selC = "h-9 rounded-lg border border-border bg-card px-2.5 text-sm text-foreground";

  if (!mounted) return (
    <div className="space-y-6">
      <PageHeader eyebrow={"İşyeri Yönetimi"} title="Firmalar" description={"Sorumlu olduğunuz firmaları yönetin."} />
      <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
    </div>
  );

  if (cos.length === 0 && arCos.length === 0 && dlCos.length === 0) return (
    <div className="space-y-6">
      <PageHeader eyebrow={"İşyeri Yönetimi"} title="Firmalar" description={"Sorumlu olduğunuz firmaları yönetin."} />
      <EmptyState title={"Henüz kayıtlı firma bulunmuyor"} description={"İlk firmanızı oluşturarak başlayın."} action={<div className="flex flex-wrap justify-center gap-3"><Button onClick={() => void onCreate()}>Yeni Firma</Button><Button variant="outline" onClick={onReset}>Demo Verileri</Button></div>} />
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={"İşyeri Yönetimi"} title="Firmalar" description={"Sorumlu olduğunuz firmaları yönetin, çalışma alanlarına erişin."}
        actions={<div className="flex flex-wrap items-center gap-2"><Button size="sm" onClick={() => void onCreate()}>Yeni Firma</Button><Button variant="outline" size="sm" onClick={onReset}>Demo Verileri</Button><Badge variant={ds === "supabase" ? "success" : "neutral"} className="text-[10px]">{ds === "supabase" ? "Supabase" : "Yerel"}</Badge></div>} />

      <div className="border-b border-border">
        <div className="flex gap-0">
          {([{ k: "active" as VM, l: "Aktif", n: cos.length }, { k: "archived" as VM, l: "Arşiv", n: arCos.length }, { k: "deleted" as VM, l: "Silinen", n: dlCos.length }]).map(t => (
            <button key={t.k} type="button" onClick={() => setVm(t.k)}
              className={`relative inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${vm === t.k ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t.l}
              {t.n > 0 && <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${vm === t.k ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{t.n}</span>}
              {vm === t.k && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </div>

      {vm === "active" && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          {[{ l: "Toplam Firma", v: stats.total, a: false }, { l: "Toplam Çalışan", v: stats.emp, a: false }, { l: "Kritik İşyeri", v: stats.crit, a: stats.crit > 0 }, { l: "Açık Aksiyon", v: stats.oa, a: false }, { l: "Geciken İş", v: stats.od, a: stats.od > 0 }, { l: "Ort. Olgunluk", v: `%${stats.mat}`, a: false }].map(s => (
            <div key={s.l} className="rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-soft)]">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${s.a ? "text-danger" : "text-foreground"}`}>{s.v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_140px_140px_140px_130px]">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ara</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={"Ad, sektör, tür, NACE..."} className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/60" />
          </div>
          <div className="flex flex-col gap-1"><label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{"Tehlike Sınıfı"}</label><select value={hf} onChange={e => setHf(e.target.value)} className={selC}><option value="">{"Tümü"}</option><option value="Az Tehlikeli">Az Tehlikeli</option><option value="Tehlikeli">Tehlikeli</option><option value={"Çok Tehlikeli"}>{"Çok Tehlikeli"}</option></select></div>
          <div className="flex flex-col gap-1"><label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{"Sektör"}</label><select value={sf} onChange={e => setSf(e.target.value)} className={selC}><option value="">{"Tümü"}</option>{sectors.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="flex flex-col gap-1"><label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{"Tür"}</label><select value={kf} onChange={e => setKf(e.target.value)} className={selC}><option value="">{"Tümü"}</option>{kinds.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
          <div className="flex flex-col gap-1"><label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{"Sıralama"}</label><select value={sk} onChange={e => setSk(e.target.value as SK)} className={selC}><option value="name">{"Ada Göre"}</option><option value="employees">{"Çalışan"}</option><option value="risk">Risk</option><option value="overdue">Geciken</option></select></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">{filtered.length} / {src.length} firma</p>
          {hasF && <button type="button" onClick={clr} className="text-xs font-medium text-primary hover:underline">Filtreleri temizle</button>}
        </div>
      </div>

      {vm === "active" ? (
        filtered.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">{filtered.map(co => {
            const risk = getOverallRiskState(co), lc = co.locations.filter(Boolean).length, dc = co.departments.filter(Boolean).length;
            return (
              <div key={co.id} className="overflow-hidden rounded-[1.7rem] border border-border/80 bg-card shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/30 hover:shadow-[var(--shadow-elevated)]">
                {/* ── Premium Header ── */}
                <div className={`relative overflow-hidden p-5 pb-4 ${co.hazardClass === "Çok Tehlikeli" ? "bg-gradient-to-br from-orange-500/8 via-transparent to-transparent dark:from-orange-500/12" : co.hazardClass === "Tehlikeli" ? "bg-gradient-to-br from-amber-500/8 via-transparent to-transparent dark:from-amber-500/12" : co.hazardClass === "Az Tehlikeli" ? "bg-gradient-to-br from-emerald-500/8 via-transparent to-transparent dark:from-emerald-500/12" : "bg-gradient-to-br from-blue-500/6 via-transparent to-transparent dark:from-blue-500/10"}`}>
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/20 blur-2xl dark:bg-white/5" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      {/* Logo / initials — premium */}
                      {co.logo_url ? (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm dark:bg-white/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={co.logo_url} alt={co.name} className="h-full w-full object-contain p-1.5" />
                        </div>
                      ) : (
                        <PremiumIconBadge icon={Building2} tone={(co.hazardClass === "Çok Tehlikeli" ? "orange" : co.hazardClass === "Tehlikeli" ? "amber" : co.hazardClass === "Az Tehlikeli" ? "emerald" : "cobalt") as PremiumIconTone} size="lg" />
                      )}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <Link href={`/companies/${co.id}`} className="block truncate text-lg font-semibold text-foreground transition-colors hover:text-primary">{co.name}</Link>
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{co.kind}{co.sector ? ` · ${co.sector}` : ""}{co.address ? ` · ${co.address}` : ""}</p>
                      </div>
                    </div>
                    <Badge variant={rBV(risk.label)} className="mt-1 shrink-0 text-[10px]">{risk.label}{risk.score !== null ? ` ${risk.score}` : ""}</Badge>
                  </div>
                </div>
                {/* ── Metrics Grid ── */}
                <div className="grid grid-cols-3 gap-px border-y border-border/60 bg-border/60 sm:grid-cols-6">
                  {[{ l: "Tehlike", badge: true, h: co.hazardClass }, { l: "Çalışan", v: co.employeeCount }, { l: "Aksiyon", v: co.openActions }, { l: "Geciken", v: co.overdueActions, warn: co.overdueActions > 0 }, { l: "Lokasyon", v: lc }, { l: "Bölüm", v: dc }].map((m) => (
                    <div key={m.l} className="bg-card px-3.5 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{m.l}</p>
                      {"badge" in m && m.badge ? (
                        <div className="mt-1">{m.h ? <Badge variant={hBV(m.h)} className="text-[10px]">{m.h}</Badge> : <span className="text-sm text-muted-foreground">{"—"}</span>}</div>
                      ) : (
                        <p className={`mt-1 text-base font-bold tabular-nums ${"warn" in m && m.warn ? "text-danger" : "text-foreground"}`}>{m.v}</p>
                      )}
                    </div>
                  ))}
                </div>
                {/* ── Progress & NACE ── */}
                <div className="px-5 pt-3.5">
                  <div className="flex flex-wrap items-center gap-5 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">Kapsam <span className="inline-block h-2 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(co.completionRate, 100)}%` }} /></span> <span className="font-bold text-foreground">%{co.completionRate}</span></span>
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">Olgunluk <span className="inline-block h-2 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(co.maturityScore, 100)}%` }} /></span> <span className="font-bold text-foreground">%{co.maturityScore}</span></span>
                    {co.naceCode && <span className="min-w-0 truncate text-muted-foreground">NACE: <span className="font-bold text-foreground">{co.naceCode}</span></span>}
                  </div>
                </div>
                {/* ── Actions ── */}
                <div className="flex flex-wrap items-center gap-2.5 px-5 pb-4 pt-3.5">
                  <Link href={`/companies/${co.id}`} className="inline-flex h-9 shrink-0 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover">{"Çalışma Alanı"}</Link>
                  <Link href="/risk-analysis" className="inline-flex h-9 shrink-0 items-center rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary">Risk Analizi</Link>
                  <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
                    <button type="button" onClick={() => { setCaId(co.id); setCdId(null); setDct(""); }} className="inline-flex h-8 items-center rounded-xl border border-warning/30 bg-warning/10 px-3 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/20">{"Arşivle"}</button>
                    <button type="button" onClick={() => { setCdId(co.id); setCaId(null); setDct(""); }} className="inline-flex h-8 items-center rounded-xl border border-danger/30 bg-danger/10 px-3 text-[11px] font-semibold text-danger transition-colors hover:bg-danger/20">Sil</button>
                  </div>
                </div>
                {caId === co.id && <div className="mx-4 mb-3.5 rounded-lg border border-warning/30 bg-warning/5 p-3.5"><p className="text-sm font-semibold text-foreground">{`“${co.name}” arşive alınsın mı?`}</p><p className="mt-1 text-sm text-muted-foreground">{"Firma aktif listeden ayrılacak."}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => void doArchive(co.id)}>Onayla</Button><Button variant="outline" size="sm" onClick={() => setCaId(null)}>{"Vazgeç"}</Button></div></div>}
                {cdId === co.id && <div className="mx-4 mb-3.5 rounded-lg border border-danger/30 bg-danger/5 p-3.5"><p className="text-sm font-semibold text-foreground">{`“${co.name}” silinsin mi?`}</p><p className="mt-1 text-sm text-muted-foreground">{"Onay için"} <span className="font-bold">{"SİL"}</span> {"yazın:"}</p><input value={dct} onChange={e => setDct(e.target.value)} placeholder={'"SİL" yazın'} className="mt-2 h-9 w-full max-w-xs rounded-lg border border-danger/30 bg-card px-3 text-sm" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={dct.trim() !== "SİL"} onClick={() => void doDelete(co.id)} className={`inline-flex h-8 items-center rounded-lg px-4 text-sm font-medium text-white transition-colors ${dct.trim() === "SİL" ? "bg-danger hover:bg-red-700" : "cursor-not-allowed bg-danger/40"}`}>Sil</button><Button variant="outline" size="sm" onClick={() => { setCdId(null); setDct(""); }}>{"Vazgeç"}</Button></div></div>}
              </div>
            );
          })}</div>
        ) : (<EmptyState title={"Eşleşen firma bulunamadı"} description={"Arama kriterlerinize uygun firma yok."} action={<Button variant="outline" onClick={clr}>Filtreleri Temizle</Button>} />)
      ) : null}

      {vm === "archived" ? (
        filtered.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3"><p className="text-sm font-medium text-foreground">{"Arşivlenen firmalar. Geri yükleme yapabilirsiniz."}</p></div>
            <div className="grid gap-4 xl:grid-cols-2">{filtered.map(c => (
              <div key={c.id} className="rounded-xl border border-warning/30 bg-card p-4 shadow-[var(--shadow-soft)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1"><h3 className="text-base font-semibold text-foreground">{c.name}</h3><p className="mt-0.5 text-sm text-muted-foreground">{c.kind}{c.sector ? ` · ${c.sector}` : ""}</p><p className="mt-0.5 text-xs text-muted-foreground">{c.employeeCount} {"çalışan"}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><Button size="sm" onClick={() => void doRestore(c.id)}>{"Geri Yükle"}</Button><Badge variant="warning">{"Arşivde"}</Badge></div>
                </div>
              </div>
            ))}</div>
          </div>
        ) : (<EmptyState title={"Arşivde firma bulunmuyor"} description={"Henüz arşivlenmiş firma yok."} />)
      ) : null}

      {vm === "deleted" ? (
        filtered.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3"><p className="text-sm font-medium text-foreground">{"Silinen firmalar. Kalıcı silme geri alınamaz."}</p></div>
            <div className="grid gap-4 xl:grid-cols-2">{filtered.map(c => (
              <div key={c.id} className="rounded-xl border border-danger/30 bg-card p-4 shadow-[var(--shadow-soft)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1"><h3 className="text-base font-semibold text-foreground">{c.name}</h3><p className="mt-0.5 text-sm text-muted-foreground">{c.kind}{c.sector ? ` · ${c.sector}` : ""}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => void doPerm(c.id)} className="inline-flex h-8 items-center rounded-lg border border-danger/30 bg-danger/10 px-3 text-xs font-medium text-danger hover:bg-danger/20 transition-colors">{"Kalıcı Sil"}</button><Badge variant="danger">Silindi</Badge></div>
                </div>
              </div>
            ))}</div>
          </div>
        ) : (<EmptyState title={"Silinen firma bulunmuyor"} description={"Henüz silinmiş firma yok."} />)
      ) : null}
    </div>
  );
}
