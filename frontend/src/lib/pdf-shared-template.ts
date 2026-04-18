/**
 * PDF Shared Template — tüm rapor PDF'lerinde ortak header/footer/CSS.
 *
 * Sağlanan:
 *  - PdfReportMeta tipi (firma + lokasyon + olay + hazırlayan + paylaşım)
 *  - SHARED_PDF_CSS (print-uyumlu temel stiller)
 *  - renderReportHeader(meta) — A4'ün üst meta bloğu
 *  - renderReportFooter(meta) — sayfa altında paylaşım linki + QR
 *  - generateQrDataUrl(url) — qrcode paketi ile data URL
 *  - escHtml(value) — XSS güvenli HTML escape
 *
 * Kullanım pattern:
 *   const meta: PdfReportMeta = { ... };
 *   const qr = await generateQrDataUrl(meta.shareUrl);
 *   const html = `<style>${SHARED_PDF_CSS}</style>` +
 *     renderReportHeader(meta) +
 *     ...kendine özgü içerik... +
 *     renderReportFooter(meta, qr);
 */

import QRCode from "qrcode";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PdfReportMeta {
  /** Rapor başlığı (örn. "R₂D-RCA Analiz Raporu", "Ishikawa Balık Kılçığı") */
  reportTitle: string;
  /** Rapor alt başlığı (örn. "9 boyutlu kompozit risk metriği") */
  reportSubtitle?: string;
  /** Firma adı */
  companyName?: string | null;
  /** Lokasyon — saha/şube/departman birleşik yazılabilir */
  location?: string | null;
  /** Olay başlığı (kısa anlatım) */
  incidentTitle?: string | null;
  /** Olay tarihi — ISO veya görüntü string */
  incidentDate?: string | null;
  /** Olay tipi (İş Kazası, Ramak Kala, Meslek Hastalığı, Diğer) */
  incidentType?: string | null;
  /** Hazırlayan kişi */
  preparedBy?: {
    name?: string | null;
    title?: string | null;
    email?: string | null;
  } | null;
  /** Paylaşım için link — bu URL QR olarak da basılır */
  shareUrl?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** XSS-güvenli HTML escape; null/undefined için em-dash döner */
export function escHtml(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
}

/** ISO tarihi tr-TR formatına çevirir; başka string'leri olduğu gibi döner */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * QR kod data URL üretir. URL undefined/boş ise boş string döner.
 * Print-uyumlu: PNG, koyu renk, beyaz arka plan, hata düzeltme M.
 */
export async function generateQrDataUrl(url?: string | null): Promise<string> {
  if (!url) return "";
  try {
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 200,
      color: { dark: "#111111", light: "#FFFFFF" },
    });
  } catch (e) {
    console.warn("generateQrDataUrl failed:", e);
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Shared CSS                                                         */
/* ------------------------------------------------------------------ */

export const SHARED_PDF_CSS = `
  * { box-sizing: border-box; }
  @page { size: A4; margin: 12mm; }
  body {
    margin: 0; padding: 0;
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    color: #111; background: #fff;
    font-size: 10px; line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ---- Header ---- */
  .rn-header {
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 3px double #d4a017;
  }
  .rn-header-top {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 16px; margin-bottom: 10px;
  }
  .rn-header-title {
    font-size: 16px; font-weight: 700; color: #111;
  }
  .rn-header-title small {
    display: block; font-size: 9px; font-weight: 400;
    color: #6b7280; margin-top: 2px;
  }
  .rn-header-brand {
    text-align: right; font-size: 9px; color: #6b7280;
  }
  .rn-header-brand strong { color: #d4a017; font-weight: 700; }

  .rn-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    font-size: 9px;
  }
  .rn-meta-item {
    padding: 6px 8px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-left: 3px solid #d4a017;
    border-radius: 3px;
  }
  .rn-meta-label {
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-size: 8px;
    margin-bottom: 2px;
  }
  .rn-meta-value {
    color: #111;
    font-weight: 600;
    word-break: break-word;
  }

  /* ---- Section title ---- */
  h3.rn-section {
    margin: 14px 0 8px 0;
    padding: 5px 10px;
    background: #d4a017;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    border-radius: 3px;
    page-break-after: avoid;
  }

  /* ---- Tables ---- */
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #f3f4f6; padding: 6px 8px; border: 1px solid #9ca3af; font-size: 10px; font-weight: 700; text-align: left; }
  td { padding: 6px 8px; border: 1px solid #d1d5db; font-size: 10px; }
  th.c, td.c { text-align: center; }

  /* ---- Footer ---- */
  .rn-footer {
    margin-top: 18px;
    padding-top: 10px;
    border-top: 2px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    page-break-inside: avoid;
  }
  .rn-footer-info {
    flex: 1;
    font-size: 9px;
    color: #4b5563;
    line-height: 1.5;
  }
  .rn-footer-link {
    margin-top: 4px;
    word-break: break-all;
    font-family: monospace;
    color: #1d4ed8;
    font-size: 8.5px;
  }
  .rn-footer-qr {
    flex-shrink: 0;
    text-align: center;
    width: 110px;
  }
  .rn-footer-qr img {
    width: 100px; height: 100px;
    display: block; margin: 0 auto;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
  }
  .rn-footer-qr-label {
    margin-top: 4px;
    font-size: 8px;
    color: #6b7280;
    letter-spacing: 0.3px;
  }

  /* ---- Yasal not ---- */
  .rn-legal {
    margin-top: 8px;
    padding: 8px 12px;
    background: #fef2f2;
    border-left: 3px solid #dc2626;
    font-size: 9px;
    color: #991b1b;
    line-height: 1.5;
  }

  /* ---- AI üretim damgası ---- */
  .rn-ai-stamp {
    margin-top: 12px;
    padding: 10px 14px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 2px solid #d4a017;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 12px;
    page-break-inside: avoid;
  }
  .rn-ai-stamp-badge {
    flex-shrink: 0;
    padding: 6px 12px;
    background: #d4a017;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    border-radius: 4px;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  .rn-ai-stamp-text {
    flex: 1;
    font-size: 9.5px;
    color: #7c2d12;
    line-height: 1.5;
  }
  .rn-ai-stamp-text strong {
    color: #7c2d12;
    display: block;
    margin-bottom: 2px;
  }
`;

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

export function renderReportHeader(meta: PdfReportMeta): string {
  const reportDate = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const preparer = meta.preparedBy
    ? `${escHtml(meta.preparedBy.name)}${meta.preparedBy.title ? ` · <span style="color:#6b7280;">${escHtml(meta.preparedBy.title)}</span>` : ""}`
    : "—";

  return `
    <header class="rn-header">
      <div class="rn-header-top">
        <div class="rn-header-title">
          ${escHtml(meta.reportTitle)}
          ${meta.reportSubtitle ? `<small>${escHtml(meta.reportSubtitle)}</small>` : ""}
        </div>
        <div class="rn-header-brand">
          Risk<strong>Nova</strong> İSG Platformu<br>
          <span style="font-size:8px;">Rapor: ${escHtml(reportDate)}</span>
        </div>
      </div>

      <div class="rn-meta-grid">
        <div class="rn-meta-item">
          <div class="rn-meta-label">Firma</div>
          <div class="rn-meta-value">${escHtml(meta.companyName)}</div>
        </div>
        <div class="rn-meta-item">
          <div class="rn-meta-label">Lokasyon</div>
          <div class="rn-meta-value">${escHtml(meta.location)}</div>
        </div>
        <div class="rn-meta-item">
          <div class="rn-meta-label">Olay Tarihi</div>
          <div class="rn-meta-value">${escHtml(formatDate(meta.incidentDate))}${meta.incidentType ? ` · <span style="color:#6b7280;font-weight:400;">${escHtml(meta.incidentType)}</span>` : ""}</div>
        </div>
        <div class="rn-meta-item" style="grid-column: span 2;">
          <div class="rn-meta-label">Olay</div>
          <div class="rn-meta-value">${escHtml(meta.incidentTitle)}</div>
        </div>
        <div class="rn-meta-item">
          <div class="rn-meta-label">Hazırlayan</div>
          <div class="rn-meta-value">${preparer}</div>
        </div>
      </div>
    </header>
  `;
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

/**
 * Footer — paylaşım linki + QR kod + yasal not.
 * @param meta - rapor meta bilgisi
 * @param qrDataUrl - generateQrDataUrl(meta.shareUrl) ile üretilmiş data URL
 */
export function renderReportFooter(meta: PdfReportMeta, qrDataUrl: string): string {
  const url = meta.shareUrl ?? "";
  return `
    <footer class="rn-footer">
      <div class="rn-footer-info">
        <strong>Çevrimiçi Paylaşım:</strong> Bu raporun dijital sürümüne aşağıdaki link veya QR ile ulaşabilirsiniz.
        Her güncelleme dijital sürüme yansır; basılı kopya bilgilendirme amaçlıdır.
        ${url ? `<div class="rn-footer-link">${escHtml(url)}</div>` : ""}
        <div style="margin-top:6px;font-size:8px;color:#9ca3af;">
          Hazırlayan: ${escHtml(meta.preparedBy?.name)}
          ${meta.preparedBy?.title ? ` · ${escHtml(meta.preparedBy.title)}` : ""}
          ${meta.preparedBy?.email ? ` · ${escHtml(meta.preparedBy.email)}` : ""}
        </div>
      </div>
      ${
        qrDataUrl
          ? `<div class="rn-footer-qr">
              <img src="${qrDataUrl}" alt="Rapor QR kodu" />
              <div class="rn-footer-qr-label">Mobil ile tarayın</div>
            </div>`
          : ""
      }
    </footer>

    <div class="rn-ai-stamp">
      <div class="rn-ai-stamp-badge">⚡ RiskNova AI ile üretildi</div>
      <div class="rn-ai-stamp-text">
        <strong>Bu rapor yapay zeka destekli oluşturulmuştur — yetkili İSG uzmanı tarafından kontrol edilmesi zorunludur.</strong>
        Nihai karar uzman sorumluluğundadır.
      </div>
    </div>

    <div class="rn-legal">
      <strong>Yasal Not:</strong> Bu rapor RiskNova AI destekli analiz aracıyla hazırlanmış teknik bir değerlendirmedir.
      Nihai karar yetkili İSG uzmanına aittir. 6331 sayılı İş Sağlığı ve Güvenliği Kanunu kapsamında
      resmi belge olarak kullanılmadan önce kurum içi onaydan geçirilmelidir.
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  Convenience: print window helper                                   */
/* ------------------------------------------------------------------ */

/**
 * Verilen HTML'i yeni pencerede açar ve print dialog'unu tetikler.
 * Tüm PDF template'leri bu yardımcıyı çağırabilir.
 */
export function openPrintWindow(htmlBody: string, title: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=1100,height=1400");
  if (!w) {
    alert("Yazıcı penceresi açılamadı. Lütfen pop-up engelleyiciyi kontrol edin.");
    return;
  }
  w.document.write(`<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8">
    <title>${escHtml(title)}</title>
    <style>${SHARED_PDF_CSS}</style>
  </head>
  <body>${htmlBody}</body>
</html>`);
  w.document.close();
  w.focus();
  // QR resimleri yüklenene kadar küçük bir bekleme (data URL genelde anında, ama emin olalım)
  setTimeout(() => w.print(), 600);
}

/**
 * Blob versiyonu için: tam HTML belgesi (DOCTYPE+html+body) üretir.
 * Bu HTML doğrudan generatePdfBlob'a verilebilir.
 */
export function buildFullPdfHtml(htmlBody: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8">
    <title>${escHtml(title)}</title>
    <style>${SHARED_PDF_CSS}</style>
  </head>
  <body>${htmlBody}</body>
</html>`;
}
