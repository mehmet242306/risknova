"use client";

/**
 * Yıllık Eğitim Planı — firma × yıl bazlı düzenlenebilir + kaydedilir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, GraduationCap, Loader2, Plus, Save, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { loadCompanyDirectory } from "@/lib/company-directory";
import { createClient } from "@/lib/supabase/client";

interface TrainingRow {
  id: string;
  category: "genel" | "saglik" | "teknik";
  title: string;
  trainer: string;
  audience: string;
  plannedDate: string;
  durationHours: number;
  realizedDate: string;
  certificate: "var" | "yok" | "";
  attendance: number | "";
}

const DEFAULT_TRAININGS: TrainingRow[] = [
  row("genel", "İş sağlığı ve güvenliği çalışma mevzuatı ile ilgili bilgiler", "İSG Uzmanı", "Çalışanlar"),
  row("genel", "Çalışanların hak ve sorumlulukları hakkında genel bilgiler", "İSG Uzmanı", "Çalışanlar"),
  row("genel", "İş yeri temizliği ve düzeni", "İSG Uzmanı", "Çalışanlar"),
  row("genel", "İş kazası ve meslek hastalığından doğan hukuki sonuçlar", "İSG Uzmanı", "Çalışanlar"),
  row("saglik", "Meslek hastalıklarının sebepleri", "İşyeri Hekimi", "Çalışanlar"),
  row("saglik", "Meslek hastalıklarından korunma prensipleri ve korunma tekniklerinin uygulanması", "İşyeri Hekimi", "Çalışanlar"),
  row("saglik", "Biyolojik risk etkenleri ve biyolojik risk etkenleri sebep oldukları meslek hastalıkları", "İşyeri Hekimi", "Çalışanlar"),
  row("saglik", "İlk yardım ve kurtarma teknikleri", "Dış Eğitim (İlk Yardımcı)", "Seçili Çalışanlar"),
  row("teknik", "Kimyasal maddelerle çalışma risk etmenleri", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Fiziksel risk etmenleri", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Ergonomik risk etmenleri", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Elle kaldırma ve taşıma", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Parlama, patlama, yangın ve yangından korunma", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "İş ekipmanlarının güvenli kullanımı ve riskleri", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Ekranlı araçlarda çalışma ve riskleri", "İSG Uzmanı", "Ofis Çalışanları"),
  row("teknik", "Elektrik, tehlikeleri, riskleri ve önlemleri", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "İş kazalarının sebepleri ve korunma prensipleri", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Düşme ve sağlık çarpmaları (kazalardan korunma)", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Kişisel koruyucu donanım seçimi ve kullanımı", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "İş sağlığı ve güvenliği genel kuralları ve temel güvenlik", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Tahliye ve kurtarma", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Kaza ve yaralanma sebepleri ile korunma prensipleri", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "İş hijyeni ve çalışma ortamından doğan riskler", "İSG Uzmanı", "Çalışanlar"),
  row("teknik", "Yüksekte çalışma", "Dış Eğitim", "İlgili Çalışanlar"),
];

function row(category: TrainingRow["category"], title: string, trainer: string, audience: string): TrainingRow {
  return { id: Math.random().toString(36).slice(2, 10), category, title, trainer, audience, plannedDate: "", durationHours: 4, realizedDate: "", certificate: "", attendance: "" };
}

const CATEGORY_META = {
  genel:  { label: "GENEL KONULAR (4 saat)",    bg: "#fef3c7", fg: "#7c2d12" },
  saglik: { label: "SAĞLIK KONULARI (4 saat)",  bg: "#dbeafe", fg: "#1e40af" },
  teknik: { label: "TEKNİK KONULAR (4 saat)",   bg: "#dcfce7", fg: "#166534" },
} as const;

export default function YearlyTrainingTab() {
  const companies = useMemo(() => loadCompanyDirectory(), []);
  const [companyId, setCompanyId] = useState<string>(companies[0]?.id ?? "");
  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;
  const [year, setYear] = useState(new Date().getFullYear());
  const [trainings, setTrainings] = useState<TrainingRow[]>(DEFAULT_TRAININGS);
  const [signers, setSigners] = useState<{ employer: string; physician: string; safetyExpert: string }>({
    employer: "",
    physician: "",
    safetyExpert: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);

  const loadPlan = useCallback(async (cid: string, y: number) => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase bağlantısı yok");
      const { data, error: e } = await supabase
        .from("yearly_training_plans")
        .select("*")
        .eq("company_workspace_id", cid)
        .eq("year", y)
        .maybeSingle();
      if (e && e.code !== "PGRST116") throw e;
      if (data) {
        const payload = data.data as { trainings?: TrainingRow[]; signers?: typeof signers };
        if (payload?.trainings) setTrainings(payload.trainings);
        if (payload?.signers) setSigners(payload.signers);
        else setSigners({ employer: "", physician: "", safetyExpert: "" });
        setRecordId(data.id);
      } else {
        setTrainings(DEFAULT_TRAININGS);
        setSigners({ employer: "", physician: "", safetyExpert: "" });
        setRecordId(null);
      }
    } catch (e) {
      console.warn("loadPlan training:", e);
      setError(e instanceof Error ? e.message : "Plan yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (companyId) void loadPlan(companyId, year);
  }, [companyId, year, loadPlan]);

  async function handleSave() {
    if (!companyId) { setError("Lütfen bir firma seçin"); return; }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase bağlantısı yok");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");
      const { data: profile } = await supabase.from("user_profiles").select("organization_id").eq("auth_user_id", user.id).single();
      if (!profile?.organization_id) throw new Error("Organizasyon bilgisi bulunamadı");

      const payload = {
        organization_id: profile.organization_id,
        company_workspace_id: companyId,
        year,
        data: { trainings, signers },
        created_by: user.id,
      };
      const { data, error: e } = await supabase
        .from("yearly_training_plans")
        .upsert(payload, { onConflict: "organization_id,company_workspace_id,year" })
        .select()
        .single();
      if (e) throw e;
      if (data) setRecordId(data.id);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  function updateRow(idx: number, patch: Partial<TrainingRow>) {
    setTrainings((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function addRow(category: TrainingRow["category"]) {
    setTrainings((prev) => [...prev, row(category, "", "İSG Uzmanı", "Çalışanlar")]);
  }

  function removeRow(idx: number) {
    setTrainings((prev) => prev.filter((_, i) => i !== idx));
  }

  function exportPdf() {
    const html = buildTrainingHtml({ companyName: selectedCompany?.name ?? "—", year, trainings, signers });
    const w = window.open("", "_blank", "width=1400,height=900");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GraduationCap className="size-4 text-blue-600" />
            Yıllık İSG Eğitim Planı
          </CardTitle>
          <CardDescription>
            İSG Eğitim Usul ve Esasları Yönetmeliği — 24 standart eğitim konusu. Firma × yıl bazlı arşivlenir.
            Her satır düzenlenebilir (planlanan tarih, süre, gerçekleşen tarih, sertifika, katılım).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Firma</label>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground">
                <option value="">Firma seçin</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Eğitim Yılı</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
                className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground" />
            </div>
          </div>
          {/* İmzacılar */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              İmzacılar (PDF'in alt bölümünde imza alanlarına yazılır)
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">İşveren / İşveren Vekili</label>
                <input value={signers.employer} onChange={(e) => setSigners((s) => ({ ...s, employer: e.target.value }))} placeholder="Ad Soyad" className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">İşyeri Hekimi</label>
                <input value={signers.physician} onChange={(e) => setSigners((s) => ({ ...s, physician: e.target.value }))} placeholder="Dr. Ad Soyad" className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">İş Güvenliği Uzmanı</label>
                <input value={signers.safetyExpert} onChange={(e) => setSigners((s) => ({ ...s, safetyExpert: e.target.value }))} placeholder="Ad Soyad · Sınıf (A/B/C)" className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground" />
              </div>
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void handleSave()} disabled={saving || !companyId}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : savedFeedback ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
              {saving ? "Kaydediliyor..." : savedFeedback ? "Kaydedildi" : "Kaydet"}
            </Button>
            <Button variant="accent" onClick={exportPdf} disabled={!companyId}>
              <Download className="size-4" /> PDF olarak indir / yazdır
            </Button>
            {recordId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Bu firma için {year} eğitim planı arşivde mevcut
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Plan yükleniyor...
        </CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Önizleme & Düzenleme</CardTitle>
            <CardDescription>Satırları düzenleyin — tarih / süre / sertifika / katılım</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-100 dark:bg-amber-900/30">
                    <th className="border border-border p-2 text-left" style={{ width: 30 }}>#</th>
                    <th className="border border-border p-2 text-left">Eğitim Konusu</th>
                    <th className="border border-border p-2 text-left" style={{ width: 140 }}>Eğitimi Verecek</th>
                    <th className="border border-border p-2 text-left" style={{ width: 120 }}>Katılımcı</th>
                    <th className="border border-border p-2 text-center" style={{ width: 110 }}>Planlanan</th>
                    <th className="border border-border p-2 text-center" style={{ width: 50 }}>Süre</th>
                    <th className="border border-border p-2 text-center" style={{ width: 110 }}>Gerçekleşen</th>
                    <th className="border border-border p-2 text-center" style={{ width: 70 }}>Sertifika</th>
                    <th className="border border-border p-2 text-center" style={{ width: 60 }}>Katılım</th>
                    <th className="border border-border p-1" style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(["genel", "saglik", "teknik"] as const).map((cat) => (
                    <CategoryBlock
                      key={cat}
                      cat={cat}
                      rows={trainings}
                      onUpdate={updateRow}
                      onAdd={() => addRow(cat)}
                      onRemove={removeRow}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CategoryBlock({ cat, rows, onUpdate, onAdd, onRemove }: {
  cat: keyof typeof CATEGORY_META;
  rows: TrainingRow[];
  onUpdate: (idx: number, patch: Partial<TrainingRow>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  const meta = CATEGORY_META[cat];
  const catRows = rows.map((r, i) => ({ row: r, globalIdx: i })).filter((x) => x.row.category === cat);
  let n = 0;
  return (
    <>
      <tr>
        <td colSpan={10} className="border border-border px-2 py-1.5 text-xs font-bold" style={{ background: meta.bg, color: meta.fg }}>
          <div className="flex items-center justify-between">
            <span>{meta.label}</span>
            <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-white/60 px-2 py-0.5 text-[10px] font-medium hover:bg-white">
              <Plus className="size-3" /> Satır ekle
            </button>
          </div>
        </td>
      </tr>
      {catRows.map(({ row: r, globalIdx }) => {
        n++;
        return (
          <tr key={r.id} className="hover:bg-muted/40">
            <td className="border border-border p-2 text-center font-mono">{n}</td>
            <td className="border border-border p-0.5"><input value={r.title} onChange={(e) => onUpdate(globalIdx, { title: e.target.value })} className="w-full border-none bg-transparent p-1.5 text-xs outline-none focus:bg-primary/5" /></td>
            <td className="border border-border p-0.5"><input value={r.trainer} onChange={(e) => onUpdate(globalIdx, { trainer: e.target.value })} className="w-full border-none bg-transparent p-1.5 text-xs text-muted-foreground outline-none focus:bg-primary/5" /></td>
            <td className="border border-border p-0.5"><input value={r.audience} onChange={(e) => onUpdate(globalIdx, { audience: e.target.value })} className="w-full border-none bg-transparent p-1.5 text-xs text-muted-foreground outline-none focus:bg-primary/5" /></td>
            <td className="border border-border p-0.5"><input type="date" value={r.plannedDate} onChange={(e) => onUpdate(globalIdx, { plannedDate: e.target.value })} className="w-full border-none bg-transparent p-1.5 text-[10px] text-muted-foreground outline-none focus:bg-primary/5" /></td>
            <td className="border border-border p-0.5"><input type="number" value={r.durationHours} onChange={(e) => onUpdate(globalIdx, { durationHours: Number(e.target.value) || 0 })} className="w-full border-none bg-transparent p-1.5 text-center text-xs font-semibold outline-none focus:bg-primary/5" /></td>
            <td className="border border-border p-0.5"><input type="date" value={r.realizedDate} onChange={(e) => onUpdate(globalIdx, { realizedDate: e.target.value })} className="w-full border-none bg-transparent p-1.5 text-[10px] text-muted-foreground outline-none focus:bg-primary/5" /></td>
            <td className="border border-border p-0.5">
              <select value={r.certificate} onChange={(e) => onUpdate(globalIdx, { certificate: e.target.value as TrainingRow["certificate"] })} className="w-full border-none bg-transparent p-1.5 text-center text-xs outline-none focus:bg-primary/5">
                <option value="">—</option>
                <option value="var">Var</option>
                <option value="yok">Yok</option>
              </select>
            </td>
            <td className="border border-border p-0.5">
              <input type="number" value={r.attendance} onChange={(e) => onUpdate(globalIdx, { attendance: e.target.value ? Number(e.target.value) : "" })} className="w-full border-none bg-transparent p-1.5 text-center text-xs outline-none focus:bg-primary/5" />
            </td>
            <td className="border border-border text-center">
              <button type="button" onClick={() => onRemove(globalIdx)} className="p-1 text-muted-foreground hover:text-red-500" aria-label="Satırı sil">
                <Trash2 className="size-3.5" />
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function buildTrainingHtml({ companyName, year, trainings, signers }: { companyName: string; year: number; trainings: TrainingRow[]; signers: { employer: string; physician: string; safetyExpert: string } }): string {
  const rowsByCat = (["genel", "saglik", "teknik"] as const).map((cat) => {
    const catRows = trainings.filter((t) => t.category === cat);
    const meta = CATEGORY_META[cat];
    const inner = catRows.map((r, i) => `
      <tr>
        <td class="c mono">${i + 1}</td>
        <td>${esc(r.title)}</td>
        <td class="muted">${esc(r.trainer)}</td>
        <td class="muted">${esc(r.audience)}</td>
        <td class="c muted">${esc(r.plannedDate || "—")}</td>
        <td class="c strong">${r.durationHours}</td>
        <td class="c muted">${esc(r.realizedDate || "—")}</td>
        <td class="c muted">${esc(r.certificate || "—")}</td>
        <td class="c muted">${r.attendance === "" ? "—" : r.attendance}</td>
      </tr>
    `).join("");
    return `
      <tr><td colspan="9" class="section-title" style="background:${meta.bg};color:${meta.fg};">${esc(meta.label)}</td></tr>
      ${inner}
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Yıllık İSG Eğitim Planı — ${esc(companyName)}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 landscape; margin: 10mm; }
  body { margin: 0; font-family: 'Inter', Arial, sans-serif; color: #111; font-size: 9px; }
  .header-row { display: flex; justify-content: space-between; align-items: center; background: #dbeafe; border: 2px solid #1e40af; padding: 8px 14px; margin-bottom: 4px; font-size: 11px; }
  .header-row .title { font-size: 14px; font-weight: 700; color: #1e40af; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #dbeafe; padding: 5px 4px; border: 1px solid #111; font-size: 9px; font-weight: 700; }
  td { padding: 4px 6px; border: 1px solid #6b7280; font-size: 9px; }
  td.c { text-align: center; } td.mono { font-family: monospace; font-weight: 700; }
  td.muted { color: #4b5563; } td.strong { font-weight: 700; }
  td.section-title { font-weight: 700; font-size: 10px; padding: 5px 8px; }
  .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
  .sig-box { border: 1px dashed #6b7280; padding: 12px; text-align: center; height: 80px; display: flex; flex-direction: column; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header-row">
    <div class="title">YILLIK EĞİTİM PLANI</div>
    <div>FİRMA: <strong>${esc(companyName)}</strong> · YIL: <strong>${year}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:30px;">No</th><th>Eğitim Konusu</th>
        <th style="width:110px;">Eğitimi Verecek</th><th style="width:100px;">Katılımcı</th>
        <th style="width:85px;">Planlanan</th><th style="width:45px;">Süre</th>
        <th style="width:85px;">Gerçekleşen</th><th style="width:50px;">Sertifika</th><th style="width:45px;">Katılım</th>
      </tr>
    </thead>
    <tbody>${rowsByCat}</tbody>
  </table>
  <div class="sig-grid">
    <div class="sig-box">
      <div style="font-weight:700;">İşveren</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111;font-weight:600;">${esc(signers.employer || "—")}</div>
      <div style="border-top:1px solid #111;padding-top:2px;font-size:8px;color:#6b7280;">İmza / Tarih</div>
    </div>
    <div class="sig-box">
      <div style="font-weight:700;">İşyeri Hekimi</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111;font-weight:600;">${esc(signers.physician || "—")}</div>
      <div style="border-top:1px solid #111;padding-top:2px;font-size:8px;color:#6b7280;">İmza / Tarih</div>
    </div>
    <div class="sig-box">
      <div style="font-weight:700;">İş Güvenliği Uzmanı</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111;font-weight:600;">${esc(signers.safetyExpert || "—")}</div>
      <div style="border-top:1px solid #111;padding-top:2px;font-size:8px;color:#6b7280;">İmza / Tarih</div>
    </div>
  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
