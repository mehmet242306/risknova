"use client";

/**
 * Yıllık İSG Çalışma Planı — firma × yıl bazlı düzenlenebilir + kaydedilir.
 *
 *  - Firma dropdown (mevcut firmalar)
 *  - Yıl seçici
 *  - Her satır editable (konu, sorumlu, mevzuat, 12 ay checkbox)
 *  - Satır ekle/sil
 *  - Supabase: yearly_work_plans tablosunda (organization_id, company_id, year) unique
 *  - PDF çıktı: resmi A4 landscape form
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Plus, Save, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { loadCompanyDirectory } from "@/lib/company-directory";
import { createClient } from "@/lib/supabase/client";

const MONTH_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

interface WorkItem {
  id: string;
  title: string;
  responsible: string;
  regulation: string;
  months: boolean[];
}

interface WorkSection {
  id: string;
  title: string;
  items: WorkItem[];
}

const DEFAULT_SECTIONS: WorkSection[] = [
  {
    id: "1", title: "İş Sağlığı ve Güvenliği Kurul Çalışmaları",
    items: [
      makeItem("İSG Kurulunun Oluşturulması", "İşveren", "İSG Kurulları Hakkındaki Yönetmelik", [0]),
      makeItem("İSG Kurul Atamalarının Üyelere Tebliğ Edilmesi", "İşveren", "İSG Kurulları Yönetmeliği", [0]),
      makeItem("Aylık İSG Kurul Toplantılarının Gerçekleştirilmesi", "İSG Kurulu", "İSG Kurulları Yönetmeliği", Array.from({ length: 12 }, (_, i) => i)),
      makeItem("İSG Kurulu Yıllık Çalışma Raporunun Oluşturulması", "İSG Kurulu", "İSG Kurulları Yönetmeliği", [11]),
    ],
  },
  {
    id: "2", title: "Risk Analizi ve Değerlendirilmesi",
    items: [
      makeItem("Makine Envanterinin Oluşturulması veya Alınması", "İş Güvenliği Uzmanı", "İSG Risk Değerlendirmesi Yönetmeliği", [0]),
      makeItem("Organizasyon Şemasının Alınması", "İş Güvenliği Uzmanı", "İSG Risk Değerlendirmesi Yönetmeliği", [0]),
      makeItem("Ön Durum Tespiti ve Raporlanması", "İş Güvenliği Uzmanı", "İSG Risk Değerlendirmesi Yönetmeliği", [1]),
      makeItem("Risk Analizi Çalışması / Değerlendirilmesi", "İş Güvenliği Uzmanı", "İSG Risk Değerlendirmesi Yönetmeliği", [2, 5, 8, 11]),
      makeItem("Periyodik Risk Analizi Güncellemesi", "İSG Uzmanı", "İSG Risk Değerlendirmesi Yönetmeliği", [5, 11]),
    ],
  },
  {
    id: "3", title: "Periyodik Kontroller ve Ölçümler",
    items: [
      makeItem("Elektrik Makinaları/Topraklama Kontrolü", "Teknik Birim", "İSG ve İş Ekipmanları Yönetmeliği", [3]),
      makeItem("Elektrik Ölçümleri (Topraklama, Paratoner...)", "Teknik Birim", "İSG ve İş Ekipmanları Yönetmeliği", [3]),
      makeItem("Kaldırma Araçları Periyodik Kontrolleri", "Teknik Birim", "İş Ekipmanları Yönetmeliği", [5, 11]),
      makeItem("Ortam Gürültü Ölçümü", "Teknik Birim", "Gürültü Yönetmeliği", [5]),
      makeItem("Ortam Aydınlatma Ölçümü", "Teknik Birim", "İSG Yönetmeliği", [5]),
      makeItem("İçme Suyu Tahlilleri", "Teknik Birim", "İnsani Tüketim Amaçlı Sular Yön.", [2, 8]),
    ],
  },
  {
    id: "4", title: "Acil Durumlar",
    items: [
      makeItem("Tahliye ve Söndürme Tatbikatları", "İş Güvenliği Uzmanı", "Acil Durumlar Yönetmeliği", [5, 11]),
      makeItem("Tatbikat Tutanağının Oluşturulması", "Teknik Birim", "Acil Durumlar Yönetmeliği", [5, 11]),
      makeItem("Acil Durum Ekipmanlarının Kontrolü", "Teknik Birim", "Acil Durumlar Yönetmeliği", [2, 5, 8, 11]),
      makeItem("Acil Durum Eylem Planının Hazırlanması", "İş Güvenliği Uzmanı", "Acil Durumlar Yönetmeliği", [0]),
    ],
  },
  {
    id: "5", title: "Sağlık Kontrolleri",
    items: [
      makeItem("Sağlık Denetimleri", "İşyeri Hekimi", "İş Sağlığı Yönetmeliği", Array.from({ length: 12 }, (_, i) => i)),
      makeItem("Sağlık Birimi Yıllık Çalışma Planı", "İşyeri Hekimi", "İş Sağlığı Yönetmeliği", [0]),
      makeItem("İşe Giriş Raporları", "İşyeri Hekimi", "İş Sağlığı Yönetmeliği", Array.from({ length: 12 }, (_, i) => i)),
      makeItem("Periyodik Muayene Raporları", "İşyeri Hekimi", "İş Sağlığı Yönetmeliği", [2, 5, 8, 11]),
    ],
  },
  {
    id: "6", title: "Kimyasallar",
    items: [
      makeItem("MSDS'lerin Temininin Sağlanması", "İş Güvenliği Uzmanı", "Kimyasallar Yönetmeliği", [2]),
      makeItem("Kimyasal Risk Değerlendirmesi", "İş Güvenliği Uzmanı", "Kimyasallar Yönetmeliği", [5]),
    ],
  },
];

function makeItem(title: string, responsible: string, regulation: string, monthIdx: number[]): WorkItem {
  return {
    id: Math.random().toString(36).slice(2, 10),
    title, responsible, regulation,
    months: Array.from({ length: 12 }, (_, i) => monthIdx.includes(i)),
  };
}

export default function YearlyWorkPlanTab() {
  const companies = useMemo(() => loadCompanyDirectory(), []);
  const [companyId, setCompanyId] = useState<string>(companies[0]?.id ?? "");
  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;
  const [year, setYear] = useState(new Date().getFullYear());
  const [revNo, setRevNo] = useState("00");
  const [sections, setSections] = useState<WorkSection[]>(DEFAULT_SECTIONS);
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

  /** DB'den mevcut planı yükle */
  const loadPlan = useCallback(async (cid: string, y: number) => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase bağlantısı yok");
      const { data, error: e } = await supabase
        .from("yearly_work_plans")
        .select("*")
        .eq("company_workspace_id", cid)
        .eq("year", y)
        .maybeSingle();
      if (e && e.code !== "PGRST116") throw e;
      if (data) {
        const payload = data.data as { sections?: WorkSection[]; revNo?: string; signers?: typeof signers };
        if (payload?.sections) setSections(payload.sections);
        if (payload?.revNo) setRevNo(payload.revNo);
        if (payload?.signers) setSigners(payload.signers);
        else setSigners({ employer: "", physician: "", safetyExpert: "" });
        setRecordId(data.id);
      } else {
        // Yeni plan — default template yükle
        setSections(DEFAULT_SECTIONS);
        setRevNo("00");
        setSigners({ employer: "", physician: "", safetyExpert: "" });
        setRecordId(null);
      }
    } catch (e) {
      console.warn("loadPlan:", e);
      setError(e instanceof Error ? e.message : "Plan yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (companyId) void loadPlan(companyId, year);
  }, [companyId, year, loadPlan]);

  /** DB'ye kaydet */
  async function handleSave() {
    if (!companyId) { setError("Lütfen bir firma seçin"); return; }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase bağlantısı yok");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Oturum bulunamadı");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id")
        .eq("auth_user_id", user.id)
        .single();
      if (!profile?.organization_id) throw new Error("Organizasyon bilgisi bulunamadı");

      const payload = {
        organization_id: profile.organization_id,
        company_workspace_id: companyId,
        year,
        rev_no: revNo,
        data: { sections, revNo, signers },
        created_by: user.id,
      };

      const { data, error: e } = await supabase
        .from("yearly_work_plans")
        .upsert(payload, { onConflict: "organization_id,company_workspace_id,year" })
        .select()
        .single();
      if (e) throw e;
      if (data) setRecordId(data.id);

      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } catch (e) {
      console.warn("handleSave work plan:", e);
      setError(e instanceof Error ? e.message : "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  /** Editable satır güncelle */
  function updateItem(sectionIdx: number, itemIdx: number, patch: Partial<WorkItem>) {
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, items: [...s.items] }));
      next[sectionIdx].items[itemIdx] = { ...next[sectionIdx].items[itemIdx], ...patch };
      return next;
    });
  }

  function toggleMonth(sectionIdx: number, itemIdx: number, monthIdx: number) {
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, items: s.items.map((it) => ({ ...it, months: [...it.months] })) }));
      next[sectionIdx].items[itemIdx].months[monthIdx] = !next[sectionIdx].items[itemIdx].months[monthIdx];
      return next;
    });
  }

  function addItem(sectionIdx: number) {
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, items: [...s.items] }));
      next[sectionIdx].items.push(makeItem("", "", "", []));
      return next;
    });
  }

  function removeItem(sectionIdx: number, itemIdx: number) {
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, items: [...s.items] }));
      next[sectionIdx].items.splice(itemIdx, 1);
      return next;
    });
  }

  function exportPdf() {
    const html = buildWorkPlanHtml({ companyName: selectedCompany?.name ?? "—", year, revNo, sections, signers });
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
            <FileText className="size-4 text-amber-600" />
            Yıllık İSG Çalışma Planı
          </CardTitle>
          <CardDescription>
            6331 sayılı İSG Kanunu gereği yıllık çalışma planı. Firma × yıl bazlı arşivlenir.
            Her satır düzenlenebilir, ay takvimi tıklanarak değiştirilebilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Firma</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
              >
                <option value="">Firma seçin</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Çalışma Yılı</label>
              <input
                type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
                className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Revizyon No</label>
              <input
                value={revNo} onChange={(e) => setRevNo(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
              />
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
                <input
                  value={signers.employer}
                  onChange={(e) => setSigners((s) => ({ ...s, employer: e.target.value }))}
                  placeholder="Ad Soyad"
                  className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">İşyeri Hekimi</label>
                <input
                  value={signers.physician}
                  onChange={(e) => setSigners((s) => ({ ...s, physician: e.target.value }))}
                  placeholder="Dr. Ad Soyad"
                  className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-foreground">İş Güvenliği Uzmanı</label>
                <input
                  value={signers.safetyExpert}
                  onChange={(e) => setSigners((s) => ({ ...s, safetyExpert: e.target.value }))}
                  placeholder="Ad Soyad · Sınıf (A/B/C)"
                  className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

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
                <CheckCircle2 className="size-3" /> Bu firma için {year} planı arşivde mevcut
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Plan yükleniyor...
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Önizleme & Düzenleme</CardTitle>
            <CardDescription>Satırları düzenlemek için tıklayın · ay hücresi toggle</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-100 dark:bg-amber-900/30">
                    <th className="border border-border p-2 text-left" style={{ width: 40 }}>#</th>
                    <th className="border border-border p-2 text-left">Çalışma Konusu</th>
                    <th className="border border-border p-2 text-left" style={{ width: 140 }}>Sorumlu</th>
                    <th className="border border-border p-2 text-left" style={{ width: 180 }}>Mevzuat</th>
                    {MONTH_SHORT.map((m) => (
                      <th key={m} className="border border-border p-1 text-center font-semibold" style={{ width: 30 }}>{m}</th>
                    ))}
                    <th className="border border-border p-1 text-center" style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((section, si) => (
                    <SectionBlock
                      key={section.id}
                      section={section}
                      si={si}
                      onItemChange={updateItem}
                      onMonthToggle={toggleMonth}
                      onAdd={() => addItem(si)}
                      onRemove={(ii) => removeItem(si, ii)}
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

function SectionBlock({
  section, si, onItemChange, onMonthToggle, onAdd, onRemove,
}: {
  section: WorkSection; si: number;
  onItemChange: (si: number, ii: number, patch: Partial<WorkItem>) => void;
  onMonthToggle: (si: number, ii: number, mi: number) => void;
  onAdd: () => void;
  onRemove: (ii: number) => void;
}) {
  return (
    <>
      <tr className="bg-amber-50 dark:bg-amber-900/10">
        <td colSpan={17} className="border border-border px-2 py-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{section.title}</span>
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium hover:bg-muted"
            >
              <Plus className="size-3" /> Satır ekle
            </button>
          </div>
        </td>
      </tr>
      {section.items.map((item, ii) => (
        <tr key={item.id} className="hover:bg-muted/40">
          <td className="border border-border p-2 text-center font-mono">{section.id}.{ii + 1}</td>
          <td className="border border-border p-0.5">
            <input value={item.title} onChange={(e) => onItemChange(si, ii, { title: e.target.value })}
              className="w-full border-none bg-transparent p-1.5 text-xs outline-none focus:bg-primary/5" />
          </td>
          <td className="border border-border p-0.5">
            <input value={item.responsible} onChange={(e) => onItemChange(si, ii, { responsible: e.target.value })}
              className="w-full border-none bg-transparent p-1.5 text-xs text-muted-foreground outline-none focus:bg-primary/5" />
          </td>
          <td className="border border-border p-0.5">
            <input value={item.regulation} onChange={(e) => onItemChange(si, ii, { regulation: e.target.value })}
              className="w-full border-none bg-transparent p-1.5 text-[10px] text-muted-foreground outline-none focus:bg-primary/5" />
          </td>
          {item.months.map((checked, mi) => (
            <td
              key={mi}
              onClick={() => onMonthToggle(si, ii, mi)}
              className="cursor-pointer border border-border p-0 text-center select-none"
              style={{ background: checked ? "#d1fae5" : undefined }}
            >
              <div className="py-1.5">
                {checked ? <span className="text-emerald-600 font-bold">●</span> : <span className="text-muted-foreground">·</span>}
              </div>
            </td>
          ))}
          <td className="border border-border text-center">
            <button type="button" onClick={() => onRemove(ii)} className="p-1 text-muted-foreground hover:text-red-500" aria-label="Satırı sil">
              <Trash2 className="size-3.5" />
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  PDF HTML                                                           */
/* ------------------------------------------------------------------ */

function buildWorkPlanHtml({ companyName, year, revNo, sections, signers }: { companyName: string; year: number; revNo: string; sections: WorkSection[]; signers: { employer: string; physician: string; safetyExpert: string } }): string {
  const rowsHtml = sections.map((s) => {
    const itemRows = s.items.map((item, idx) => `
      <tr>
        <td class="c mono">${s.id}.${idx + 1}</td>
        <td>${esc(item.title)}</td>
        <td class="muted">${esc(item.responsible)}</td>
        <td class="muted small">${esc(item.regulation)}</td>
        ${item.months.map((m) => `<td class="c">${m ? "●" : ""}</td>`).join("")}
      </tr>
    `).join("");
    return `
      <tr class="section-title">
        <td colspan="16">${esc(s.title)}</td>
      </tr>
      ${itemRows}
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Yıllık İSG Çalışma Planı — ${esc(companyName)}</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 landscape; margin: 10mm; }
  body { margin: 0; font-family: 'Inter', Arial, sans-serif; color: #111; font-size: 9px; line-height: 1.3; }
  .header-row {
    display: flex; justify-content: space-between; align-items: center;
    background: #fef3c7; border: 2px solid #d4a017; padding: 8px 14px;
    margin-bottom: 4px; font-size: 11px;
  }
  .header-row .title { font-size: 14px; font-weight: 700; color: #7c2d12; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #fef3c7; padding: 5px 4px; border: 1px solid #111; font-size: 9px; font-weight: 700; }
  td { padding: 4px 6px; border: 1px solid #6b7280; font-size: 9px; vertical-align: middle; }
  td.c { text-align: center; }
  td.mono { font-family: monospace; font-weight: 700; }
  td.muted { color: #4b5563; }
  td.small { font-size: 8px; }
  tr.section-title td {
    background: #d1fae5; font-weight: 700; color: #064e3b;
    padding: 4px 6px; font-size: 10px;
  }
  .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
  .sig-box { border: 1px dashed #6b7280; padding: 12px; text-align: center; height: 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .sig-line { border-top: 1px solid #111; padding-top: 2px; font-size: 8px; color: #6b7280; }
</style>
</head>
<body>
  <div class="header-row">
    <div class="title">İŞ SAĞLIĞI VE GÜVENLİĞİ YILLIK ÇALIŞMA PLANI</div>
    <div>FİRMA: <strong>${esc(companyName)}</strong> · YIL: <strong>${year}</strong> · REV: <strong>${esc(revNo)}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px;">Sıra</th>
        <th>Çalışma Konusu</th>
        <th style="width:110px;">Sorumlu</th>
        <th style="width:170px;">Mevzuat</th>
        ${MONTH_SHORT.map((m) => `<th style="width:22px;">${m}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="sig-grid">
    <div class="sig-box">
      <div style="font-weight:700;">İşveren / İşveren Vekili</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111;font-weight:600;">${esc(signers.employer || "—")}</div>
      <div class="sig-line">İmza / Tarih</div>
    </div>
    <div class="sig-box">
      <div style="font-weight:700;">İşyeri Hekimi</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111;font-weight:600;">${esc(signers.physician || "—")}</div>
      <div class="sig-line">İmza / Tarih</div>
    </div>
    <div class="sig-box">
      <div style="font-weight:700;">İş Güvenliği Uzmanı</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#111;font-weight:600;">${esc(signers.safetyExpert || "—")}</div>
      <div class="sig-line">İmza / Tarih</div>
    </div>
  </div>
</body>
</html>`;
}

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
