/**
 * 5 Neden (5 Why) PDF rapor template'i.
 *
 * İçerik:
 *  - Shared header
 *  - Adım adım numaralı neden zinciri (her adımda soru + cevap)
 *  - Kök neden vurgulu kutu
 *  - Shared footer
 */

import type { FiveWhyData } from "@/lib/analysis/types";
import {
  type PdfReportMeta,
  SHARED_PDF_CSS,
  renderReportHeader,
  renderReportFooter,
  generateQrDataUrl,
  escHtml as esc,
} from "@/lib/pdf-shared-template";

export interface FiveWhyPdfData extends FiveWhyData {
  /** Olay/problem tanımı (kullanıcı veya AI'dan) */
  problemStatement?: string | null;
  /** Önerilen çözümler veya AI özeti */
  recommendation?: string | null;
}

type FiveWhyMetaInput = Omit<PdfReportMeta, "reportTitle" | "reportSubtitle"> & Partial<Pick<PdfReportMeta, "reportTitle" | "reportSubtitle">>;

function normalizeFiveWhyMeta(metaInput: FiveWhyMetaInput): PdfReportMeta {
  return {
    reportTitle: metaInput.reportTitle ?? "5 Neden (5 Why) Analiz Raporu",
    reportSubtitle: metaInput.reportSubtitle ?? "Ardışık neden sorularıyla kök neden tespiti",
    ...metaInput,
  };
}

export function buildFiveWhyPdfHtml(
  data: FiveWhyPdfData,
  meta: PdfReportMeta,
  qrDataUrl: string,
): string {
  const validWhys = (data.whys ?? []).filter((w) => w?.question || w?.answer);

  const chainHtml = validWhys.length === 0
    ? `<div style="padding:14px;background:#fef3c7;border-left:4px solid #d4a017;font-size:10px;color:#7c2d12;">
        Henüz neden zinciri tanımlanmamış. Wizard üzerinden adımları doldurarak analizi tamamlayın.
       </div>`
    : validWhys
        .map((w, i) => `
          <div class="why-step">
            <div class="why-num">${i + 1}</div>
            <div class="why-content">
              <div class="why-q">
                <span class="why-q-label">Neden ${i + 1}?</span>
                ${esc(w.question)}
              </div>
              <div class="why-a">
                <span class="why-a-label">Cevap:</span>
                ${esc(w.answer)}
              </div>
            </div>
          </div>
          ${i < validWhys.length - 1 ? '<div class="why-arrow">↓</div>' : ""}
        `).join("");

  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8">
    <title>${esc(meta.reportTitle)}</title>
    <style>
      ${SHARED_PDF_CSS}
      h3 {
        margin: 14px 0 8px 0; padding: 5px 10px;
        background: #5a9ee0; color: #fff;
        font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border-radius: 3px;
        page-break-after: avoid;
      }
      .problem-box {
        background: #eff6ff; border: 1px solid #bfdbfe;
        border-left: 4px solid #5a9ee0;
        padding: 10px 14px; margin: 8px 0;
        font-size: 11px; line-height: 1.55;
      }
      .why-step {
        display: flex; gap: 10px; align-items: flex-start;
        margin: 8px 0; page-break-inside: avoid;
      }
      .why-num {
        flex-shrink: 0;
        width: 28px; height: 28px;
        background: #5a9ee0; color: #fff;
        border-radius: 50%; font-size: 13px; font-weight: 700;
        display: flex; align-items: center; justify-content: center;
      }
      .why-content {
        flex: 1; padding: 8px 12px;
        background: #f9fafb; border: 1px solid #e5e7eb;
        border-left: 3px solid #5a9ee0; border-radius: 4px;
      }
      .why-q { font-size: 10px; color: #1e40af; margin-bottom: 4px; font-weight: 600; }
      .why-q-label {
        display: inline-block; font-size: 8px; padding: 1px 6px;
        background: #5a9ee0; color: #fff; border-radius: 3px;
        margin-right: 6px; text-transform: uppercase; letter-spacing: 0.3px;
      }
      .why-a { font-size: 10.5px; color: #111; line-height: 1.5; }
      .why-a-label {
        display: inline-block; font-size: 8px; padding: 1px 6px;
        background: #e5e7eb; color: #374151; border-radius: 3px;
        margin-right: 6px; text-transform: uppercase; letter-spacing: 0.3px;
      }
      .why-arrow {
        text-align: center; color: #9ca3af; font-size: 14px;
        margin: 4px 0 4px 14px;
      }
      .root-box {
        background: #fef2f2; border: 2px solid #dc2626;
        padding: 14px 18px; margin: 12px 0;
        border-radius: 6px;
      }
      .root-label {
        font-size: 10px; color: #991b1b; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.5px;
        margin-bottom: 6px;
      }
      .root-text { font-size: 13px; color: #7f1d1d; font-weight: 600; line-height: 1.5; }
      .recommendation-box {
        background: #f0fdf4; border: 1px solid #86efac;
        border-left: 4px solid #16a34a;
        padding: 10px 14px; margin: 8px 0;
        font-size: 11px; line-height: 1.55;
      }
    </style>
  </head>
  <body>
    ${renderReportHeader(meta)}

    ${data.problemStatement ? `
      <div class="problem-box">
        <strong style="color:#1e40af;">Başlangıç problemi:</strong>
        ${esc(data.problemStatement)}
      </div>` : ""}

    <h3>Neden Zinciri (${validWhys.length} adım)</h3>
    ${chainHtml}

    ${data.rootCause ? `
      <div class="root-box">
        <div class="root-label">★ Tespit edilen kök neden</div>
        <div class="root-text">${esc(data.rootCause)}</div>
      </div>` : ""}

    ${data.recommendation ? `
      <h3>Öneri / Sonraki Adımlar</h3>
      <div class="recommendation-box">${esc(data.recommendation)}</div>` : ""}

    ${renderReportFooter(meta, qrDataUrl)}
  </body>
</html>`;
}

export async function exportFiveWhyPdf(data: FiveWhyPdfData, metaInput: FiveWhyMetaInput): Promise<void> {
  if (typeof window === "undefined") return;
  const meta = normalizeFiveWhyMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildFiveWhyPdfHtml(data, meta, qrDataUrl);
  const printWindow = window.open("", "_blank", "width=1100,height=1400");
  if (!printWindow) { alert("Yazıcı penceresi açılamadı."); return; }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

export async function exportFiveWhyPdfBlob(data: FiveWhyPdfData, metaInput: FiveWhyMetaInput): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("client-side only");
  const meta = normalizeFiveWhyMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildFiveWhyPdfHtml(data, meta, qrDataUrl);
  const { generatePdfBlob } = await import("@/lib/pdf-generator");
  return generatePdfBlob(html, { title: meta.reportTitle, scale: 2 });
}
