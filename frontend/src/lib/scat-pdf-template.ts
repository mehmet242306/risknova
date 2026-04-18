/**
 * SCAT (Systematic Cause Analysis Technique / DNV-Bird modeli) PDF rapor template'i.
 *
 * Tam DNV SCAT chart formatı:
 *  - Description of Accident
 *  - Evaluation of Loss Potential
 *  - Type of Event (13+ madde)
 *  - Immediate Causes — Substandard Acts (20) + Substandard Conditions (20)
 *  - Basic Causes — Personal Factors (8) + Job/System Factors (8)
 *  - Areas for Corrective Action (22 program, her biri P/S/C kutusu)
 */

import type { ScatData } from "@/lib/analysis/types";
import {
  type PdfReportMeta,
  SHARED_PDF_CSS,
  renderReportHeader,
  renderReportFooter,
  generateQrDataUrl,
  escHtml as esc,
} from "@/lib/pdf-shared-template";

export interface ScatPdfData extends ScatData {
  problemStatement?: string | null;
  analysisSummary?: string | null;
  /** Opsiyonel: AI tarafından önerilen kategori indeks listesi — checkbox işaretlemek için */
  suggestedTypeIndices?: number[];
  suggestedActIndices?: number[];
  suggestedConditionIndices?: number[];
  suggestedPersonalFactorIndices?: number[];
  suggestedJobFactorIndices?: number[];
  suggestedCanIndices?: number[];
  /** Opsiyonel: Kayıp potansiyeli değerlendirme */
  lossSeverity?: "major" | "serious" | "minor" | null;
  probability?: "high" | "moderate" | "low" | null;
  frequency?: "extensive" | "moderate" | "low" | null;
  /** Etki kategorileri */
  impactPeople?: boolean;
  impactProperty?: boolean;
  impactProcess?: boolean;
  impactEnvironmental?: boolean;
}

/* ------------------------------------------------------------------ */
/*  DNV SCAT referans listeleri — Türkçe                              */
/* ------------------------------------------------------------------ */

const TYPE_OF_EVENT = [
  "Çarpma (Koşma veya Çarparak)",
  "Çarpılma (Hareketli Nesne ile)",
  "Yüksekten Alt Seviyeye Düşme",
  "Aynı Seviyede Düşme (Kayma, Tökezleme)",
  "Sıkışma (Pinch/Nip Noktaları)",
  "Takılma (Yakalanma, Asılma)",
  "Arada/Altında Sıkışma (Ezilme/Kopma)",
  "Temas (Elektrik, Isı, Soğuk, Radyasyon, Kimyasal, Toksik, Biyolojik, Gürültü)",
  "Anormal Operasyon",
  "Ürün Kontaminasyonu",
  "Aşırı Yük/Basınç/Gerilim, Ergonomik",
  "Ekipman Arızası",
  "Çevresel Salınım",
];

const SUBSTANDARD_ACTS = [
  "Yetkisiz Ekipman Kullanımı",
  "Uyarı Yapmama",
  "Sabitleme/Güvenceye Alma Hatası",
  "Uygunsuz Hızda Çalışma",
  "Güvenlik Cihazlarını Devre Dışı Bırakma",
  "Arızalı Ekipman Kullanma",
  "KKD'yi Doğru Kullanmama",
  "Hatalı Yükleme",
  "Hatalı Yerleştirme",
  "Hatalı Kaldırma",
  "Görev için Yanlış Pozisyon",
  "Çalışan Ekipmana Servis",
  "Şakalaşma / Disiplinsizlik",
  "Alkol/Uyuşturucu Etkisi Altında",
  "Ekipmanı Yanlış Şekilde Kullanma",
  "Prosedür/Politika/Uygulamayı İhlal",
  "Tehlike/Riski Tespit Etmeme",
  "Kontrol/İzleme Hatası",
  "Tepki/Düzeltme Hatası",
  "İletişim/Koordinasyon Eksikliği",
];

const SUBSTANDARD_CONDITIONS = [
  "Yetersiz Koruyucu/Bariyer",
  "Yetersiz veya Uygunsuz KKD",
  "Arızalı Alet, Ekipman veya Malzeme",
  "Sıkışıklık veya Kısıtlı Hareket Alanı",
  "Yetersiz Uyarı Sistemi",
  "Yangın & Patlama Tehlikeleri",
  "Düzensizlik / Kötü Temizlik",
  "Gürültü Maruziyeti",
  "Radyasyon Maruziyeti",
  "Aşırı Sıcaklık (Sıcak/Soğuk)",
  "Yetersiz veya Aşırı Aydınlatma",
  "Yetersiz Havalandırma",
  "Zararlı Madde Varlığı",
  "Yetersiz Talimat/Prosedür",
  "Yetersiz Bilgi/Veri",
  "Yetersiz Hazırlık/Planlama",
  "Yetersiz Destek/Yardım",
  "Yetersiz İletişim Donanım/Yazılım",
  "Yol Koşulları",
  "Hava Koşulları",
];

const PERSONAL_FACTORS = [
  "Yetersiz Fiziksel/Fizyolojik Kapasite",
  "Yetersiz Zihinsel/Psikolojik Kapasite",
  "Fiziksel veya Fizyolojik Stres",
  "Zihinsel veya Psikolojik Stres",
  "Bilgi Eksikliği",
  "Beceri Eksikliği",
  "Yetersiz Motivasyon",
  "İstismar veya Kötüye Kullanım",
];

const JOB_FACTORS = [
  "Yetersiz Liderlik ve/veya Denetim",
  "Yetersiz Mühendislik",
  "Yetersiz Satın Alma",
  "Yetersiz Bakım",
  "Yetersiz Alet ve Ekipman",
  "Yetersiz İş Standartları",
  "Aşırı Aşınma ve Yıpranma",
  "Yetersiz İletişim",
];

const CAN_PROGRAMS = [
  "Liderlik ve Yönetim",
  "Liderlik Eğitimi",
  "Planlı Denetim ve Bakım",
  "Kritik Görev Analizi ve Prosedürler",
  "Olay Soruşturma",
  "Görev Gözlemleme",
  "Acil Durum Hazırlığı",
  "Kurallar ve Çalışma İzinleri",
  "Olay Analizi",
  "Bilgi ve Beceri Eğitimi",
  "Kişisel Koruyucu Ekipman",
  "Sağlık ve Hijyen Kontrolü",
  "Sistem Değerlendirme",
  "Mühendislik ve Değişim Yönetimi",
  "Kişisel İletişim",
  "Grup İletişimi",
  "Genel Tanıtım/Promosyon",
  "İşe Alım ve Yerleştirme",
  "Malzeme ve Hizmet Yönetimi",
  "İş Dışı Güvenlik",
  "Çevresel Yönetim",
  "Kalite Yönetimi",
];

/* ------------------------------------------------------------------ */
/*  Render helpers                                                     */
/* ------------------------------------------------------------------ */

function checkbox(checked: boolean): string {
  return `<span class="scat-cb">${checked ? "■" : "□"}</span>`;
}

function radioBox(checked: boolean): string {
  return `<span class="scat-rb">${checked ? "●" : "○"}</span>`;
}

function renderNumberedList(items: readonly string[], suggestedIndices: number[] = [], cols = 3): string {
  const cells = items.map((item, i) => {
    const isChecked = suggestedIndices.includes(i);
    return `
      <div class="scat-li ${isChecked ? "scat-li-on" : ""}">
        ${checkbox(isChecked)}
        <span class="scat-li-num">${i + 1}.</span>
        <span class="scat-li-text">${esc(item)}</span>
      </div>`;
  }).join("");

  return `<div class="scat-grid scat-grid-${cols}">${cells}</div>`;
}

function renderCanRow(name: string, index: number, suggestedCanIndices: number[]): string {
  const isFlagged = suggestedCanIndices.includes(index);
  // AI bu programı tespit ettiyse: P (mevcut değil) işaretsiz, S+C işaretli (yetersiz standart/uyum)
  // Tespit etmediyse: hepsi boş (manuel doldurulabilir)
  return `
    <tr ${isFlagged ? 'class="scat-can-flagged"' : ""}>
      <td class="scat-can-num">${index + 1}</td>
      <td class="scat-can-name">${esc(name)}</td>
      <td class="scat-can-cell">${checkbox(false)}</td>
      <td class="scat-can-cell">${checkbox(isFlagged)}</td>
      <td class="scat-can-cell">${checkbox(isFlagged)}</td>
    </tr>`;
}

/* ------------------------------------------------------------------ */
/*  Meta normalizer + HTML builder                                     */
/* ------------------------------------------------------------------ */

type ScatMetaInput = Omit<PdfReportMeta, "reportTitle" | "reportSubtitle"> & Partial<Pick<PdfReportMeta, "reportTitle" | "reportSubtitle">>;

function normalizeScatMeta(metaInput: ScatMetaInput): PdfReportMeta {
  return {
    reportTitle: metaInput.reportTitle ?? "SCAT (Sistematik Neden Analizi Tekniği) Raporu",
    reportSubtitle: metaInput.reportSubtitle ?? "DNV-Bird modeli — anlık nedenden temel nedene, kontrol eylem ihtiyaçlarına",
    ...metaInput,
  };
}

export function buildScatPdfHtml(
  data: ScatPdfData,
  meta: PdfReportMeta,
  qrDataUrl: string,
): string {
  const suggestedTypes = data.suggestedTypeIndices ?? [];
  const suggestedActs = data.suggestedActIndices ?? [];
  const suggestedConditions = data.suggestedConditionIndices ?? [];
  const suggestedPersonal = data.suggestedPersonalFactorIndices ?? [];
  const suggestedJob = data.suggestedJobFactorIndices ?? [];
  const suggestedCan = data.suggestedCanIndices ?? [];

  const userImmediateCauses = (data.immediateCauses ?? []).filter((c) => c?.trim());
  const userBasicCauses = (data.basicCauses ?? []).filter((c) => c?.trim());
  const userControlDeficiencies = (data.controlDeficiencies ?? []).filter((c) => c?.trim());

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${esc(meta.reportTitle)}</title>
<style>
  ${SHARED_PDF_CSS}

  /* ============================================================ */
  /* SCAT-spesifik stiller                                          */
  /* ============================================================ */
  h3.scat-section {
    margin: 12px 0 6px;
    padding: 6px 12px;
    background: #1e3a8a;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.6px;
    border-radius: 3px;
    text-transform: uppercase;
    page-break-after: avoid;
    text-align: center;
  }
  h4.scat-subhead {
    margin: 8px 0 4px;
    padding: 3px 8px;
    background: #cbd5e1;
    color: #1e293b;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    border-radius: 2px;
    text-transform: uppercase;
  }
  .scat-cb, .scat-rb {
    display: inline-block;
    width: 10px;
    color: #1e3a8a;
    font-family: "Cambria Math", "DejaVu Sans", sans-serif;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    flex-shrink: 0;
  }

  /* Description box */
  .scat-desc-box {
    border: 1.5px solid #1e293b;
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 10px;
    background: #f9fafb;
  }
  .scat-desc-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    font-size: 9.5px;
  }
  .scat-impact-tags {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }
  .scat-impact-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9px;
    color: #1e293b;
  }

  /* Loss Potential Evaluation */
  .scat-loss-eval {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    border: 1.5px solid #1e293b;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 10px;
    background: #fef9c3;
  }
  .scat-loss-cell { font-size: 9px; }
  .scat-loss-cell .label {
    font-weight: 700;
    color: #1e293b;
    font-size: 9px;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .scat-loss-options {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .scat-loss-option {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 9px;
  }

  /* Numbered grid */
  .scat-grid {
    display: grid;
    gap: 2px 8px;
    margin: 4px 0 8px;
  }
  .scat-grid-2 { grid-template-columns: 1fr 1fr; }
  .scat-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
  .scat-grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .scat-li {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    font-size: 8.5px;
    line-height: 1.3;
    color: #1f2937;
    padding: 1px 4px;
    border-radius: 2px;
  }
  .scat-li-on {
    background: #fef3c7;
    color: #7c2d12;
    font-weight: 600;
  }
  .scat-li-num {
    font-weight: 700;
    color: #1e3a8a;
    flex-shrink: 0;
    min-width: 16px;
  }
  .scat-li-text { word-break: break-word; }

  /* User input box */
  .scat-user-box {
    margin: 6px 0 10px;
    padding: 8px 12px;
    background: #fef3c7;
    border-left: 4px solid #d4a017;
    border-radius: 3px;
    font-size: 10px;
    line-height: 1.5;
  }
  .scat-user-box .title {
    font-size: 8.5px;
    font-weight: 700;
    color: #7c2d12;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 4px;
  }
  .scat-user-box ul {
    margin: 0;
    padding-left: 18px;
  }
  .scat-user-box li {
    margin: 2px 0;
    color: #111;
  }

  /* CAN table */
  .scat-can-wrap { page-break-inside: avoid; }
  table.scat-can {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    margin-bottom: 6px;
  }
  table.scat-can th {
    background: #1e3a8a;
    color: #fff;
    padding: 4px 6px;
    text-align: center;
    font-size: 8.5px;
    font-weight: 700;
    border: 1px solid #1e3a8a;
  }
  table.scat-can td {
    padding: 3px 6px;
    border: 1px solid #cbd5e1;
    font-size: 9px;
  }
  .scat-can-num {
    text-align: center;
    font-weight: 700;
    color: #1e3a8a;
    width: 24px;
  }
  .scat-can-name { color: #1f2937; }
  .scat-can-cell {
    text-align: center;
    width: 36px;
  }
  .scat-can-flagged { background: #fef3c7; }
  .scat-can-flagged .scat-can-name {
    color: #7c2d12;
    font-weight: 600;
  }
  .scat-legend {
    margin-top: 6px;
    padding: 6px 10px;
    background: #f1f5f9;
    border-left: 3px solid #1e3a8a;
    font-size: 8.5px;
    color: #1e293b;
    line-height: 1.5;
  }
  .scat-legend strong { color: #1e3a8a; }

  /* Branding */
  .scat-brand {
    text-align: center;
    margin: 10px 0 4px;
    padding: 4px;
    font-size: 9px;
    color: #1e3a8a;
    font-weight: 700;
    letter-spacing: 1px;
    border-top: 2px solid #1e3a8a;
    border-bottom: 2px solid #1e3a8a;
  }
</style>
</head>
<body>

${renderReportHeader(meta)}

<div class="scat-brand">RISKNOVA SCAT — SİSTEMATİK NEDEN ANALİZİ TEKNİĞİ (DNV / BIRD MODELİ)</div>

<!-- DESCRIPTION OF ACCIDENT -->
<h3 class="scat-section">Olay/Kaza Tanımı</h3>
<div class="scat-desc-box">
  <div class="scat-desc-row">
    <div style="flex:1;">
      ${data.problemStatement
        ? `<div style="font-size:10px;line-height:1.55;color:#111;">${esc(data.problemStatement)}</div>`
        : `<div style="font-size:9.5px;color:#9ca3af;font-style:italic;">Olay tanımı girilmemiş.</div>`}
      ${data.immediateEvent
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #d1d5db;">
            <span style="font-size:8.5px;color:#7c2d12;font-weight:700;text-transform:uppercase;">Anlık Olay:</span>
            <span style="font-size:10px;color:#111;margin-left:6px;">${esc(data.immediateEvent)}</span>
          </div>`
        : ""}
    </div>
    <div class="scat-impact-tags">
      <span class="scat-impact-tag">${checkbox(data.impactPeople ?? false)} İnsan</span>
      <span class="scat-impact-tag">${checkbox(data.impactProperty ?? false)} Mülk</span>
      <span class="scat-impact-tag">${checkbox(data.impactProcess ?? false)} Süreç</span>
      <span class="scat-impact-tag">${checkbox(data.impactEnvironmental ?? false)} Çevre</span>
    </div>
  </div>
</div>

<!-- LOSS POTENTIAL EVALUATION -->
<h3 class="scat-section">Kontrol Edilmezse Kayıp Potansiyeli Değerlendirmesi</h3>
<div class="scat-loss-eval">
  <div class="scat-loss-cell">
    <div class="label">Kayıp Şiddet Potansiyeli</div>
    <div class="scat-loss-options">
      <span class="scat-loss-option">${radioBox(data.lossSeverity === "major")} Yüksek (A)</span>
      <span class="scat-loss-option">${radioBox(data.lossSeverity === "serious")} Ciddi (B)</span>
      <span class="scat-loss-option">${radioBox(data.lossSeverity === "minor")} Düşük (C)</span>
    </div>
  </div>
  <div class="scat-loss-cell">
    <div class="label">Tekrar Olasılığı</div>
    <div class="scat-loss-options">
      <span class="scat-loss-option">${radioBox(data.probability === "high")} Yüksek (A)</span>
      <span class="scat-loss-option">${radioBox(data.probability === "moderate")} Orta (B)</span>
      <span class="scat-loss-option">${radioBox(data.probability === "low")} Düşük (C)</span>
    </div>
  </div>
  <div class="scat-loss-cell">
    <div class="label">Maruziyet Sıklığı</div>
    <div class="scat-loss-options">
      <span class="scat-loss-option">${radioBox(data.frequency === "extensive")} Yoğun (A)</span>
      <span class="scat-loss-option">${radioBox(data.frequency === "moderate")} Orta (B)</span>
      <span class="scat-loss-option">${radioBox(data.frequency === "low")} Düşük (C)</span>
    </div>
  </div>
</div>

<!-- TYPE OF EVENT -->
<h3 class="scat-section">Olay Tipi (Enerji veya Madde ile Temas)</h3>
${renderNumberedList(TYPE_OF_EVENT, suggestedTypes, 2)}

<!-- IMMEDIATE / DIRECT CAUSES -->
<h3 class="scat-section">Anlık / Doğrudan Nedenler (IC)</h3>
<h4 class="scat-subhead">Standart-altı Davranışlar (Substandard Acts)</h4>
${renderNumberedList(SUBSTANDARD_ACTS, suggestedActs, 2)}

<h4 class="scat-subhead">Standart-altı Koşullar (Substandard Conditions)</h4>
${renderNumberedList(SUBSTANDARD_CONDITIONS, suggestedConditions, 2)}

${userImmediateCauses.length > 0
  ? `<div class="scat-user-box">
      <div class="title">★ Bu Olay için Tespit Edilen Anlık Nedenler</div>
      <ul>
        ${userImmediateCauses.map((c) => `<li>${esc(c)}</li>`).join("")}
      </ul>
    </div>`
  : ""}

<!-- BASIC / ROOT CAUSES -->
<h3 class="scat-section">Temel / Kök Nedenler (BC)</h3>
<h4 class="scat-subhead">Kişisel Faktörler (Personal Factors)</h4>
${renderNumberedList(PERSONAL_FACTORS, suggestedPersonal, 2)}

<h4 class="scat-subhead">İş / Sistem Faktörleri (Job/System Factors)</h4>
${renderNumberedList(JOB_FACTORS, suggestedJob, 2)}

${userBasicCauses.length > 0
  ? `<div class="scat-user-box">
      <div class="title">★ Bu Olay için Tespit Edilen Temel Nedenler</div>
      <ul>
        ${userBasicCauses.map((c) => `<li>${esc(c)}</li>`).join("")}
      </ul>
    </div>`
  : ""}

<!-- AREAS FOR CORRECTIVE ACTION (CAN) -->
<h3 class="scat-section">Düzeltici Eylem Alanları (CAN — Control Action Needs)</h3>
<div class="scat-can-wrap">
  <table class="scat-can">
    <thead>
      <tr>
        <th style="width:24px;">#</th>
        <th style="text-align:left;">Program</th>
        <th>P</th>
        <th>S</th>
        <th>C</th>
      </tr>
    </thead>
    <tbody>
      ${CAN_PROGRAMS.map((name, i) => renderCanRow(name, i, suggestedCan)).join("")}
    </tbody>
  </table>
  <div class="scat-legend">
    <strong>P</strong> — Sistemimizde mevcut değil &nbsp;·&nbsp;
    <strong>S</strong> — Yetersiz standart &nbsp;·&nbsp;
    <strong>C</strong> — Standartlara yetersiz uyum &nbsp;·&nbsp;
    <em>Sarı satırlar bu olay için kritik kontrol eylem ihtiyacı.</em>
  </div>
</div>

${userControlDeficiencies.length > 0
  ? `<div class="scat-user-box">
      <div class="title">★ Bu Olay için Tespit Edilen Kontrol Eksiklikleri</div>
      <ul>
        ${userControlDeficiencies.map((c) => `<li>${esc(c)}</li>`).join("")}
      </ul>
    </div>`
  : ""}

<!-- AI ANALYSIS SUMMARY -->
${data.analysisSummary
  ? `<h3 class="scat-section">AI Analiz Özeti</h3>
    <div style="padding:10px 14px;background:#f9fafb;border:1px solid #d1d5db;border-left:4px solid #1e3a8a;border-radius:3px;font-size:10.5px;line-height:1.6;color:#111;">
      ${esc(data.analysisSummary)}
    </div>`
  : ""}

${renderReportFooter(meta, qrDataUrl)}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function exportScatPdf(data: ScatPdfData, metaInput: ScatMetaInput): Promise<void> {
  if (typeof window === "undefined") return;
  const meta = normalizeScatMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildScatPdfHtml(data, meta, qrDataUrl);
  const printWindow = window.open("", "_blank", "width=1100,height=1400");
  if (!printWindow) { alert("Yazıcı penceresi açılamadı."); return; }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

export async function exportScatPdfBlob(data: ScatPdfData, metaInput: ScatMetaInput): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("client-side only");
  const meta = normalizeScatMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildScatPdfHtml(data, meta, qrDataUrl);
  const { generatePdfBlob } = await import("@/lib/pdf-generator");
  return generatePdfBlob(html, { title: meta.reportTitle, scale: 2 });
}
