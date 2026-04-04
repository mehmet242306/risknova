"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyRecord } from "@/lib/company-directory";
import { getGuidedTasks, getOverallRiskState } from "@/lib/workplace-status";
import { listRiskAssessments, deleteRiskAssessment, type SavedAssessment } from "@/lib/supabase/risk-assessment-api";
import { createClient } from "@/lib/supabase/client";

export type WTab = "overview" | "structure" | "risk" | "people" | "personnel" | "planner" | "tracking" | "documents" | "organization" | "history" | "digital_twin";

function pbv(p: string): "danger" | "warning" | "neutral" {
  if (p === "high") return "danger";
  if (p === "medium") return "warning";
  return "neutral";
}

function Sec({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h2 className="section-title text-base">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const FC = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground";

/* ── OVERVIEW ── */
export function OverviewTab({ company, upd, risk, tasks, setTab }: {
  company: CompanyRecord;
  upd: (p: Partial<CompanyRecord>) => void;
  risk: ReturnType<typeof getOverallRiskState> | null;
  tasks: ReturnType<typeof getGuidedTasks>;
  setTab: (t: WTab) => void;
}) {
  return (
    <>
      <Sec title={"Bug\u00FCn Ne Yapmal\u0131y\u0131m?"} desc={"Firmaya \u00F6zel \u00F6ncelikli g\u00F6revler."}>
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map((t, i) => (
            <div key={i} className="rounded-lg border border-border bg-secondary/30 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{t.title}</p>
                <Badge variant={pbv(t.priority)} className="text-[9px]">
                  {t.priority === "high" ? "Y\u00FCksek" : t.priority === "medium" ? "Orta" : "D\u00FC\u015F\u00FCk"}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-5">{t.description}</p>
              <button type="button" onClick={() => setTab((t.href?.replace("#", "") || "overview") as WTab)} className="mt-2 text-xs font-medium text-primary hover:underline">{t.actionLabel}</button>
            </div>
          ))}
        </div>
      </Sec>

      {risk && (
        <Sec title={"Genel Risk Durumu"}>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { l: "Yap\u0131sal", v: risk.structural },
              { l: "Kapsam", v: risk.coverage },
              { l: "Olgunluk", v: risk.maturity },
              { l: "Risk Bask\u0131s\u0131", v: risk.openPressure },
            ].map((m) => (
              <div key={m.l} className="rounded-lg border border-border p-3 text-center">
                <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{m.l}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{m.v}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-6">{risk.description}</p>
        </Sec>
      )}

      <Sec title="Firma Bilgileri" desc={"Temel kimlik ve ileti\u015Fim."}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="text-xs font-medium text-muted-foreground">{"Firma Ad\u0131"}</label><Input value={company.name} onChange={(e) => upd({ name: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"K\u0131sa Ad"}</label><Input value={company.shortName} onChange={(e) => upd({ shortName: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"T\u00FCr"}</label><select value={company.kind} onChange={(e) => upd({ kind: e.target.value })} className={FC}><option>{"\u00D6zel Sekt\u00F6r"}</option><option>Kamu Kurumu</option><option>Belediye</option><option>{"STK / Vak\u0131f"}</option></select></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"Sekt\u00F6r"}</label><Input value={company.sector} onChange={(e) => upd({ sector: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">NACE Kodu</label><Input value={company.naceCode} onChange={(e) => upd({ naceCode: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"Tehlike S\u0131n\u0131f\u0131"}</label><select value={company.hazardClass} onChange={(e) => upd({ hazardClass: e.target.value })} className={FC}><option value="">{"Se\u00E7iniz"}</option><option>Az Tehlikeli</option><option>Tehlikeli</option><option>{"\u00C7ok Tehlikeli"}</option></select></div>
          <div><label className="text-xs font-medium text-muted-foreground">Adres</label><Input value={company.address} onChange={(e) => upd({ address: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"İl"}</label><Input value={company.city} onChange={(e) => upd({ city: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"İlçe"}</label><Input value={company.district} onChange={(e) => upd({ district: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Telefon</label><Input value={company.phone} onChange={(e) => upd({ phone: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Faks</label><Input value={company.fax} onChange={(e) => upd({ fax: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">E-posta</label><Input value={company.email} onChange={(e) => upd({ email: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"Yetkili Ki\u015Fi"}</label><Input value={company.contactPerson} onChange={(e) => upd({ contactPerson: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">{"İşveren Unvanı"}</label><Input value={company.employerTitle} onChange={(e) => upd({ employerTitle: e.target.value })} className="mt-1" /></div>
        </div>
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">SGK Bilgileri</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="text-xs font-medium text-muted-foreground">{"SGK İşyeri Sicil No"}</label><Input value={company.sgkWorkplaceNumber} onChange={(e) => upd({ sgkWorkplaceNumber: e.target.value })} className="mt-1" placeholder="000000.00.000" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Vergi No</label><Input value={company.taxNumber} onChange={(e) => upd({ taxNumber: e.target.value })} className="mt-1" /></div>
            <div><label className="text-xs font-medium text-muted-foreground">{"Vergi Dairesi Adı"}</label><Input value={company.taxOffice} onChange={(e) => upd({ taxOffice: e.target.value })} className="mt-1" /></div>
          </div>
        </div>
        <div className="mt-4"><label className="text-xs font-medium text-muted-foreground">Notlar</label><Textarea value={company.notes} onChange={(e) => upd({ notes: e.target.value })} rows={3} className="mt-1" /></div>
      </Sec>

      <Sec title={"Operasyonel Bilgiler"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="text-xs font-medium text-muted-foreground">{"\u00C7al\u0131\u015Fan Say\u0131s\u0131"}</label><Input type="number" value={company.employeeCount} onChange={(e) => upd({ employeeCount: Number(e.target.value) || 0 })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Vardiya Modeli</label><Input value={company.shiftModel} onChange={(e) => upd({ shiftModel: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Son Analiz</label><Input type="date" value={company.lastAnalysisDate} onChange={(e) => upd({ lastAnalysisDate: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Son Denetim</label><Input type="date" value={company.lastInspectionDate} onChange={(e) => upd({ lastInspectionDate: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Son Tatbikat</label><Input type="date" value={company.lastDrillDate} onChange={(e) => upd({ lastDrillDate: e.target.value })} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Aktif Profesyonel</label><Input type="number" value={company.activeProfessionals} onChange={(e) => upd({ activeProfessionals: Number(e.target.value) || 0 })} className="mt-1" /></div>
        </div>
      </Sec>
    </>
  );
}

/* ── STRUCTURE ── */
export function StructureTab({ company, upd }: { company: CompanyRecord; upd: (p: Partial<CompanyRecord>) => void }) {
  const locCount = company.locations.filter(Boolean).length;
  const depCount = company.departments.filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Üst özet kartları */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lokasyon</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{locCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Bölüm</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{depCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Çalışan</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{company.employeeCount}</p>
        </div>
      </div>

      {/* Lokasyonlar ve Bölümler — yan yana */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Lokasyonlar */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg dark:bg-amber-900/30">📍</div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Lokasyonlar</h3>
                <p className="text-[11px] text-muted-foreground">Firmanın fiziksel yerleşkeleri</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{locCount}</span>
          </div>
          <div className="space-y-2">
            {company.locations.map((loc, i) => (
              <div key={i} className="group flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-2 transition-colors hover:border-primary/20">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-[10px] font-bold text-amber-600 dark:text-amber-400">{i + 1}</span>
                <Input
                  value={loc}
                  onChange={(e) => { const n = [...company.locations]; n[i] = e.target.value; upd({ locations: n }); }}
                  className="flex-1 !border-0 !bg-transparent !shadow-none !ring-0 text-sm"
                  placeholder="Lokasyon adı girin"
                />
                <button
                  type="button"
                  onClick={() => upd({ locations: company.locations.filter((_, j) => j !== i) })}
                  className="shrink-0 rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => upd({ locations: [...company.locations, ""] })}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Lokasyon Ekle
          </button>
        </section>

        {/* Bölümler */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-lg dark:bg-blue-900/30">🏢</div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Bölümler</h3>
                <p className="text-[11px] text-muted-foreground">Organizasyonel birimler</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{depCount}</span>
          </div>
          <div className="space-y-2">
            {company.departments.map((dep, i) => (
              <div key={i} className="group flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-2 transition-colors hover:border-primary/20">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400">{i + 1}</span>
                <Input
                  value={dep}
                  onChange={(e) => { const n = [...company.departments]; n[i] = e.target.value; upd({ departments: n }); }}
                  className="flex-1 !border-0 !bg-transparent !shadow-none !ring-0 text-sm"
                  placeholder="Bölüm adı girin"
                />
                <button
                  type="button"
                  onClick={() => upd({ departments: company.departments.filter((_, j) => j !== i) })}
                  className="shrink-0 rounded-md p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => upd({ departments: [...company.departments, ""] })}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Bölüm Ekle
          </button>
        </section>
      </div>
    </div>
  );
}

/* ── RISK ── */
/* Risk kategori tanımları — süreç yönetimi kartları */
const RISK_CATEGORIES = [
  { key: "fiziksel", label: "Fiziksel", icon: "⚡", color: "#3B82F6", examples: "Gürültü, titreşim, aydınlatma, sıcaklık" },
  { key: "kimyasal", label: "Kimyasal", icon: "🧪", color: "#8B5CF6", examples: "Gaz, toz, buhar, kimyasal madde" },
  { key: "biyolojik", label: "Biyolojik", icon: "🦠", color: "#10B981", examples: "Bakteri, virüs, küf, biyolojik etkenler" },
  { key: "ergonomik", label: "Ergonomik", icon: "🧍", color: "#F59E0B", examples: "Duruş bozukluğu, ağır yük, tekrarlı hareket" },
  { key: "psikososyal", label: "Psikososyal", icon: "🧠", color: "#EC4899", examples: "Stres, mobbing, iş yükü, vardiya" },
  { key: "mekanik", label: "Mekanik", icon: "⚙️", color: "#F97316", examples: "Makine, ekipman, düşme, sıkışma" },
  { key: "elektrik", label: "Elektrik", icon: "🔌", color: "#EF4444", examples: "Çarpma, kısa devre, topraklama" },
  { key: "yangin", label: "Yangın / Patlama", icon: "🔥", color: "#DC2626", examples: "Yanıcı madde, patlayıcı ortam, LPG" },
  { key: "trafik", label: "Trafik", icon: "🚛", color: "#6366F1", examples: "Araç, forklift, yaya-araç çatışması" },
  { key: "cevre", label: "Çevresel", icon: "🌿", color: "#059669", examples: "Atık, emisyon, gürültü kirliliği" },
];

type CategoryStats = { key: string; total: number; critical: number; high: number; medium: number; low: number };

export function RiskTab({ company }: { company: CompanyRecord }) {
  const [analyses, setAnalyses] = useState<SavedAssessment[]>([]);
  const [catStats, setCatStats] = useState<CategoryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"overview" | "analyses">("overview");

  useEffect(() => {
    (async () => {
      const [list] = await Promise.all([listRiskAssessments(company.id)]);
      setAnalyses(list);

      // Tespitleri kategorilere göre say
      const supabase = createClient();
      if (supabase) {
        // Get all assessment IDs for this company
        const assessmentIds = list.map((a) => a.id);
        if (assessmentIds.length > 0) {
          const { data: findings } = await supabase
            .from("risk_assessment_findings")
            .select("category, severity")
            .in("assessment_id", assessmentIds);

          if (findings) {
            const stats: Record<string, CategoryStats> = {};
            for (const cat of RISK_CATEGORIES) stats[cat.key] = { key: cat.key, total: 0, critical: 0, high: 0, medium: 0, low: 0 };

            for (const f of findings) {
              const catKey = mapCategoryToKey(f.category);
              if (!stats[catKey]) stats[catKey] = { key: catKey, total: 0, critical: 0, high: 0, medium: 0, low: 0 };
              stats[catKey].total++;
              if (f.severity === "critical") stats[catKey].critical++;
              else if (f.severity === "high") stats[catKey].high++;
              else if (f.severity === "medium") stats[catKey].medium++;
              else stats[catKey].low++;
            }
            setCatStats(Object.values(stats));
          }
        }
      }
      setLoading(false);
    })();
  }, [company.id]);

  async function handleDelete(id: string) {
    const ok = await deleteRiskAssessment(id);
    if (ok) setAnalyses((prev) => prev.filter((a) => a.id !== id));
    setConfirmDeleteId(null);
  }

  function fmtDate(d: string) { try { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }); } catch { return d; } }
  function methodLabel(m: string) { return m === "r_skor" ? "R-SKOR 2D" : m === "fine_kinney" ? "Fine-Kinney" : m === "l_matrix" ? "L-Matris" : m; }
  function statusBadge(s: string) {
    if (s === "completed") return { label: "Tamamlandı", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
    if (s === "archived") return { label: "Arşivlendi", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" };
    return { label: "Taslak", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  }

  const totalFindings = catStats.reduce((s, c) => s + c.total, 0);
  const totalCritical = catStats.reduce((s, c) => s + c.critical, 0);
  const totalHigh = catStats.reduce((s, c) => s + c.high, 0);

  return (
    <div className="space-y-5">
      {/* Başlık + Sekme seçici + Buton */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title text-base">Risk ve Saha Yönetimi</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Risk sınıflandırması, analiz geçmişi ve süreç takibi.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border bg-secondary/30">
              <button type="button" onClick={() => setActiveSection("overview")}
                className={`px-3 py-1.5 text-xs font-medium rounded-l-lg transition-colors ${activeSection === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Risk Haritası
              </button>
              <button type="button" onClick={() => setActiveSection("analyses")}
                className={`px-3 py-1.5 text-xs font-medium rounded-r-lg transition-colors ${activeSection === "analyses" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Analizler ({analyses.length})
              </button>
            </div>
            <Link href={`/risk-analysis?companyId=${company.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Yeni Analiz
            </Link>
          </div>
        </div>

        {/* Üst metriler */}
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Toplam Tespit</p>
            <p className="mt-1 text-xl font-bold text-foreground">{totalFindings}</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Kritik</p>
            <p className={`mt-1 text-xl font-bold ${totalCritical > 0 ? "text-red-600" : "text-muted-foreground"}`}>{totalCritical}</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Yüksek</p>
            <p className={`mt-1 text-xl font-bold ${totalHigh > 0 ? "text-orange-500" : "text-muted-foreground"}`}>{totalHigh}</p>
          </div>
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Analiz Sayısı</p>
            <p className="mt-1 text-xl font-bold text-foreground">{analyses.length}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : activeSection === "overview" ? (
        /* ── Risk Haritası — Kategori kartları ── */
        <div className="grid gap-3 sm:grid-cols-2">
          {RISK_CATEGORIES.map((cat) => {
            const stat = catStats.find((s) => s.key === cat.key);
            const total = stat?.total ?? 0;
            const hasCritical = (stat?.critical ?? 0) > 0;
            const hasHigh = (stat?.high ?? 0) > 0;

            return (
              <div key={cat.key} className={`rounded-xl border p-4 transition-colors ${
                hasCritical ? "border-red-400/40 bg-red-50/5 dark:bg-red-950/10"
                : hasHigh ? "border-orange-400/30 bg-orange-50/5 dark:bg-orange-950/10"
                : total > 0 ? "border-border bg-card"
                : "border-border/50 bg-card/50"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: cat.color + "18" }}>
                      {cat.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{cat.label}</h4>
                      <p className="text-[10px] text-muted-foreground">{cat.examples}</p>
                    </div>
                  </div>
                  {total > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: cat.color + "20", color: cat.color }}>
                      {total}
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div className="mt-3 flex gap-2">
                    {(stat?.critical ?? 0) > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">Kritik: {stat!.critical}</span>}
                    {(stat?.high ?? 0) > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Yüksek: {stat!.high}</span>}
                    {(stat?.medium ?? 0) > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Orta: {stat!.medium}</span>}
                    {(stat?.low ?? 0) > 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">Düşük: {stat!.low}</span>}
                  </div>
                )}
                {total === 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground/60">Henüz tespit yok</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Analizler listesi ── */
        <div className="space-y-2">
          {analyses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm font-medium text-foreground">Henüz risk analizi yapılmamış</p>
              <p className="mt-1 text-xs text-muted-foreground">Risk Analizi sayfasından bu firma için ilk analizinizi başlatın.</p>
            </div>
          ) : analyses.map((a) => {
            const sb = statusBadge(a.status);
            return (
              <div key={a.id} className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/20">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground">{a.title}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sb.cls}`}>{sb.label}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{methodLabel(a.method)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{fmtDate(a.assessmentDate)}</span>
                    <span>{a.itemCount} tespit</span>
                    {a.locationText && <span>{a.locationText}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                  {confirmDeleteId === a.id ? (
                    <div className="flex items-center gap-1 rounded-lg border border-red-400 bg-red-50 px-2 py-1 dark:border-red-600 dark:bg-red-950">
                      <span className="text-[11px] text-red-600 dark:text-red-400">Emin misin?</span>
                      <button type="button" className="rounded px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-100 dark:text-red-400" onClick={() => handleDelete(a.id)}>Evet</button>
                      <button type="button" className="rounded px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-secondary" onClick={() => setConfirmDeleteId(null)}>Hayır</button>
                    </div>
                  ) : (
                    <button type="button" className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setConfirmDeleteId(a.id)}>Sil</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** AI kategori adını risk sınıfı key'ine dönüştür */
function mapCategoryToKey(category: string): string {
  const lower = (category || "").toLowerCase().trim();
  if (lower.includes("elektrik")) return "elektrik";
  if (lower.includes("yangın") || lower.includes("patlama") || lower.includes("yangin")) return "yangin";
  if (lower.includes("kimyasal") || lower.includes("kimya")) return "kimyasal";
  if (lower.includes("makine") || lower.includes("mekanik")) return "mekanik";
  if (lower.includes("ergonomi")) return "ergonomik";
  if (lower.includes("trafik") || lower.includes("araç")) return "trafik";
  if (lower.includes("çevre") || lower.includes("cevre")) return "cevre";
  if (lower.includes("biyolojik")) return "biyolojik";
  if (lower.includes("psikososyal") || lower.includes("stres")) return "psikososyal";
  // Fiziksel: KKD, düşme, düzen, depolama, yüksekte çalışma, iskele, acil durum
  return "fiziksel";
}

/* ── PEOPLE ── */
export function PeopleTab({ company, upd }: { company: CompanyRecord; upd: (p: Partial<CompanyRecord>) => void }) {
  return (
    <Sec title={"Ekip ve Temsil Yap\u0131s\u0131"} desc={"\u0130SG profesyonelleri, \u00E7al\u0131\u015Fan temsilcileri ve destek personeli."}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label className="text-xs font-medium text-muted-foreground">Aktif Profesyonel</label><Input type="number" value={company.activeProfessionals} onChange={(e) => upd({ activeProfessionals: Number(e.target.value) || 0 })} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">{"\u00C7al\u0131\u015Fan Temsilcisi"}</label><Input type="number" value={company.employeeRepresentativeCount} onChange={(e) => upd({ employeeRepresentativeCount: Number(e.target.value) || 0 })} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Destek Personeli</label><Input type="number" value={company.supportStaffCount} onChange={(e) => upd({ supportStaffCount: Number(e.target.value) || 0 })} className="mt-1" /></div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label className="text-xs font-medium text-muted-foreground">{"\u0130\u015Fveren Ad\u0131"}</label><Input value={company.employerName} onChange={(e) => upd({ employerName: e.target.value })} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">{"\u0130\u015Fveren Vekili"}</label><Input value={company.employerRepresentative} onChange={(e) => upd({ employerRepresentative: e.target.value })} className="mt-1" /></div>
      </div>
    </Sec>
  );
}

/* ── TRACKING ── */
export function TrackingTab({ company }: { company: CompanyRecord }) {
  return (
    <Sec title={"Takip ve Metrikler"} desc={"E\u011Fitim, periyodik kontrol ve iyile\u015Ftirme takibi."}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { l: "Tamamlanan E\u011Fitim", v: company.completedTrainingCount },
          { l: "S\u00FCresi Dolan E\u011Fitim", v: company.expiringTrainingCount },
          { l: "Periyodik Kontrol", v: company.periodicControlCount },
          { l: "Geciken Kontrol", v: company.overduePeriodicControlCount },
          { l: "Kapsam Oran\u0131", v: `%${company.completionRate}` },
          { l: "Son 30 G\u00FCn \u0130yile\u015Fme", v: `%${company.last30DayImprovement}` },
        ].map((m) => (
          <div key={m.l} className="rounded-lg border border-border p-3.5 text-center">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{m.l}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{m.v}</p>
          </div>
        ))}
      </div>
    </Sec>
  );
}

/* ── DOCUMENTS ── */
export function DocumentsTab({ company }: { company: CompanyRecord }) {
  return (
    <Sec title={"D\u00F6k\u00FCman Y\u00F6netimi"} desc={"Firma d\u00F6k\u00FCmanlar\u0131 ve belge durumu."}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3.5 text-center">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{"Toplam D\u00F6k\u00FCman"}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{company.documentCount}</p>
        </div>
        <div className="rounded-lg border border-border p-3.5 text-center">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{"Risk De\u011Ferlendirme"}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{company.openRiskAssessments}</p>
        </div>
        <div className="rounded-lg border border-border p-3.5 text-center">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Kapsam</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">%{company.completionRate}</p>
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-info/30 bg-info/5 p-4">
        <p className="text-sm text-foreground">{"D\u00F6k\u00FCman y\u00F6netimi mod\u00FCl\u00FC geli\u015Ftirme a\u015Famas\u0131ndad\u0131r."}</p>
      </div>
    </Sec>
  );
}

/* ── ORGANIZATION (members/permissions/invitations/requests) ── */
export function OrganizationTab({ company, setInviteOpen }: { company: CompanyRecord; setInviteOpen: (v: boolean) => void }) {
  return (
    <div className="space-y-6">
      <Sec title="Organizasyon" desc={"Firma organizasyon yap\u0131s\u0131, \u00FCyelik ve eri\u015Fim y\u00F6netimi."}>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { title: "\u00DCyeler", desc: "Firmaya eri\u015Fimi olan kullan\u0131c\u0131lar ve rolleri.", icon: "\u{1F465}", action: "Yak\u0131nda" },
            { title: "\u0130zinler", desc: "Mod\u00FCl bazl\u0131 eri\u015Fim ve yetki kontrol\u00FC.", icon: "\u{1F512}", action: "Yak\u0131nda" },
            { title: "Davetler", desc: "G\u00F6nderilen ve bekleyen profesyonel davetleri.", icon: "\u{1F4E8}", action: "Davet G\u00F6nder" },
            { title: "Talepler", desc: "Firmaya kat\u0131lma talepleri ve onay s\u00FCreci.", icon: "\u{1F4CB}", action: "Yak\u0131nda" },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-secondary/20 p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">{item.icon}</span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-5">{item.desc}</p>
                  <button
                    type="button"
                    onClick={item.title === "Davetler" ? () => setInviteOpen(true) : undefined}
                    disabled={item.title !== "Davetler"}
                    className="mt-2 text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                  >
                    {item.action}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Sec>
      <Sec title={"Payla\u015F\u0131m ve Eri\u015Fim"} desc={"Firma verileri \u00FCzerindeki payla\u015F\u0131m ve eri\u015Fim kontrolleri."}>
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-muted-foreground leading-6">{"Payla\u015F\u0131m ve eri\u015Fim y\u00F6netimi mod\u00FCl\u00FC geli\u015Ftirme a\u015Famas\u0131ndad\u0131r. Firma verileri \u00FCzerinde granular eri\u015Fim kontrol\u00FC yak\u0131nda aktif olacakt\u0131r."}</p>
        </div>
      </Sec>
    </div>
  );
}

/* ── HISTORY ── */
export function HistoryTab() {
  const items = [
    { d: "Mehmet Y.", r: "\u0130SG Uzman\u0131", a: "Risk analizi g\u00FCncellendi", t: "2 saat \u00F6nce" },
    { d: "Ay\u015Fe K.", r: "\u0130\u015Fveren Vekili", a: "Acil durum plan\u0131 onayland\u0131", t: "D\u00FCn" },
    { d: "Sistem", r: "Otomatik", a: "Periyodik kontrol hat\u0131rlatmas\u0131", t: "2 g\u00FCn \u00F6nce" },
    { d: "Ali R.", r: "\u0130SG Uzman\u0131", a: "Saha denetimi tamamland\u0131", t: "1 hafta \u00F6nce" },
  ];
  return (
    <Sec title={"Ge\u00E7mi\u015F ve Denetim \u0130zi"} desc={"Firma \u00FCzerindeki t\u00FCm i\u015Flemler ve de\u011Fi\u015Fiklik ge\u00E7mi\u015Fi."}>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{item.d.charAt(0)}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{item.d}</p>
                <span className="text-[10px] text-muted-foreground">{item.t}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{item.r}</p>
              <p className="mt-0.5 text-xs text-foreground">{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </Sec>
  );
}

/* ── DIGITAL TWIN ── */
export function DigitalTwinTab() {
  return (
    <Sec title={"Dijital \u0130kiz"} desc={"Firman\u0131n dijital temsili ve sim\u00FClasyon ortam\u0131."}>
      <div className="rounded-lg border border-border bg-secondary/30 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">{"\u{1F916}"}</div>
        <h3 className="mt-4 text-base font-semibold text-foreground">{"Dijital \u0130kiz Mod\u00FCl\u00FC"}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{"Firman\u0131n fiziksel yap\u0131s\u0131n\u0131n dijital temsili, risk sim\u00FClasyonlar\u0131 ve senaryo analizleri bu alanda yer alacakt\u0131r."}</p>
        <Badge variant="neutral" className="mt-3">{"Geli\u015Ftirme A\u015Famas\u0131nda"}</Badge>
      </div>
    </Sec>
  );
}
