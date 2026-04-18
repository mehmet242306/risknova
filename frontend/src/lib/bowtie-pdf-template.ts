/**
 * Bow-Tie (Kelebek Analizi) PDF rapor template'i.
 *
 * Yatay şema:
 *   Tehditler → [Önleyici Bariyerler] → Kritik Olay → [Hafifletici Bariyerler] → Sonuçlar
 */

import type { BowTieData } from "@/lib/analysis/types";
import {
  type PdfReportMeta,
  SHARED_PDF_CSS,
  renderReportHeader,
  renderReportFooter,
  generateQrDataUrl,
  escHtml as esc,
} from "@/lib/pdf-shared-template";

export interface BowTiePdfData extends BowTieData {
  problemStatement?: string | null;
  analysisSummary?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Bow-Tie (Kelebek) SVG diyagramı                                    */
/* ------------------------------------------------------------------ */

function wrapTextSvg(text: string, maxChars: number, maxLines = 2): string[] {
  const cleaned = String(text ?? "").trim();
  if (cleaned.length <= maxChars) return [cleaned];
  const words = cleaned.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (lines.length >= maxLines - 1) {
      cur = cur ? cur + " " + w : w;
    } else if ((cur + (cur ? " " : "") + w).length <= maxChars) {
      cur = cur ? cur + " " + w : w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length === maxLines && lines[maxLines - 1].length > maxChars) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + "…";
  }
  return lines;
}

export function renderBowTieSvg(data: BowTiePdfData): string {
  const W = 800, H = 440;
  const cx = W / 2, cy = H / 2;
  // Top event metnine göre dinamik daire boyutu — uzun metinler için daha büyük
  const eventTextLen = (data.topEvent ?? "").length;
  const eventR = eventTextLen <= 30 ? 55 : eventTextLen <= 60 ? 70 : 85;

  // Sol mavi üçgen — sol kenar geniş, ortada eventR yarıçapına daralır
  const triLeftX = 30;
  const triLeftWidth = cx - eventR - 30; // ~330
  // Sağ kırmızı üçgen
  const triRightX = cx + eventR;
  const triRightWidth = W - 30 - triRightX; // ~330

  // Sol mavi üçgen path: sol-üst, sol-alt, orta merkez
  const leftTriPath = `M ${triLeftX} ${cy - 130} L ${triLeftX} ${cy + 130} L ${triLeftX + triLeftWidth} ${cy + eventR / 2} L ${triLeftX + triLeftWidth} ${cy - eventR / 2} Z`;
  const rightTriPath = `M ${triRightX} ${cy - eventR / 2} L ${triRightX} ${cy + eventR / 2} L ${triRightX + triRightWidth} ${cy + 130} L ${triRightX + triRightWidth} ${cy - 130} Z`;

  // Sol kutucuklar — threats (max 5)
  const threats = (data.threats ?? []).slice(0, 5);
  const consequences = (data.consequences ?? []).slice(0, 5);

  const boxW = 130, boxH = 36, boxGap = 10;
  const boxStartY = cy - (5 * boxH + 4 * boxGap) / 2; // 5 kutu için merkezde

  function renderLeftBox(label: string, idx: number, color = "#2563eb"): string {
    const y = boxStartY + idx * (boxH + boxGap);
    const x = triLeftX - 10;
    const lines = wrapTextSvg(label, 18, 2);
    const lineH = 11;
    const startTextY = y + boxH / 2 - (lines.length - 1) * lineH / 2 + 3;
    return `
      <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="3" fill="${color}" stroke="${color}" stroke-width="0.5" />
      ${lines.map((line, i) => `
        <text x="${x + boxW / 2}" y="${startTextY + i * lineH}" font-size="9" font-weight="700" fill="#fff" text-anchor="middle" font-family="sans-serif">${esc(line)}</text>
      `).join("")}
    `;
  }

  function renderRightBox(label: string, idx: number, color = "#dc2626"): string {
    const y = boxStartY + idx * (boxH + boxGap);
    const x = W - boxW + 10;
    const lines = wrapTextSvg(label, 18, 2);
    const lineH = 11;
    const startTextY = y + boxH / 2 - (lines.length - 1) * lineH / 2 + 3;
    return `
      <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="3" fill="${color}" stroke="${color}" stroke-width="0.5" />
      ${lines.map((line, i) => `
        <text x="${x + boxW / 2}" y="${startTextY + i * lineH}" font-size="9" font-weight="700" fill="#fff" text-anchor="middle" font-family="sans-serif">${esc(line)}</text>
      `).join("")}
    `;
  }

  // Event yazısı (kelebek ortası) — dinamik wrap + font, daire boyutuna göre
  const eventText = data.topEvent || "OLAY";
  // Daire büyüdükçe daha fazla karakter sığar
  const wrapChars = eventR <= 55 ? 14 : eventR <= 70 ? 17 : 20;
  const maxLines = eventR <= 55 ? 4 : eventR <= 70 ? 5 : 6;
  const eventLines = wrapTextSvg(eventText, wrapChars, maxLines);
  // Çok satır varsa font küçülsün
  const eventFontSize = eventLines.length <= 3 ? 9 : eventLines.length <= 4 ? 8 : 7.5;
  const eventLineH = eventFontSize + 1.5;
  const eventStartY = cy - (eventLines.length - 1) * eventLineH / 2 + 3;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    <!-- Üst başlık -->
    <text x="${cx}" y="22" font-size="14" font-weight="700" fill="#0f172a" text-anchor="middle" font-family="sans-serif">Bow-Tie / Kelebek Analizi</text>

    <!-- Sol üçgen (mavi - önleyici) -->
    <path d="${leftTriPath}" fill="#2563eb" opacity="0.85" />

    <!-- Sağ üçgen (kırmızı - hafifletici) -->
    <path d="${rightTriPath}" fill="#dc2626" opacity="0.85" />

    <!-- Sol kutucuklar (threats) -->
    ${threats.map((t, i) => renderLeftBox(t.label || `Tehdit ${i + 1}`, i, "#1d4ed8")).join("")}

    <!-- Sağ kutucuklar (consequences) -->
    ${consequences.map((c, i) => renderRightBox(c.label || `Sonuç ${i + 1}`, i, "#b91c1c")).join("")}

    <!-- Orta event dairesi (yeşil) -->
    <circle cx="${cx}" cy="${cy}" r="${eventR + 4}" fill="#cbd5e1" />
    <circle cx="${cx}" cy="${cy}" r="${eventR}" fill="#16a34a" />
    ${eventLines.map((line, i) => `
      <text x="${cx}" y="${eventStartY + i * eventLineH}" font-size="${eventFontSize}" font-weight="700" fill="#fff" text-anchor="middle" font-family="sans-serif">${esc(line)}</text>
    `).join("")}

    <!-- Alt etiketler -->
    <text x="${triLeftX}" y="${H - 50}" font-size="11" font-weight="700" fill="#1d4ed8" font-family="sans-serif">Önleyici Bariyerler</text>
    <text x="${W - 30}" y="${H - 50}" font-size="11" font-weight="700" fill="#b91c1c" text-anchor="end" font-family="sans-serif">Hafifletici Bariyerler</text>

    <!-- Timeline ok -->
    <line x1="${triLeftX + 100}" y1="${H - 25}" x2="${W - 130}" y2="${H - 25}" stroke="#10b981" stroke-width="2" />
    <polygon points="${W - 130},${H - 30} ${W - 115},${H - 25} ${W - 130},${H - 20}" fill="#10b981" />
    <text x="${cx}" y="${H - 28}" font-size="9" font-weight="700" fill="#065f46" text-anchor="middle" font-family="sans-serif">Zaman →</text>

    <!-- Notlar (eğer veri 5'ten fazlaysa) -->
    ${(data.threats?.length ?? 0) > 5
      ? `<text x="${triLeftX + 5}" y="${H - 8}" font-size="8" fill="#1e40af" font-family="sans-serif">+${(data.threats?.length ?? 0) - 5} tehdit daha · detaylı tablo aşağıda</text>`
      : ""}
    ${(data.consequences?.length ?? 0) > 5
      ? `<text x="${W - 35}" y="${H - 8}" font-size="8" fill="#991b1b" text-anchor="end" font-family="sans-serif">+${(data.consequences?.length ?? 0) - 5} sonuç daha</text>`
      : ""}
  </svg>`;
}

type BowTieMetaInput = Omit<PdfReportMeta, "reportTitle" | "reportSubtitle"> & Partial<Pick<PdfReportMeta, "reportTitle" | "reportSubtitle">>;

function normalizeBowTieMeta(metaInput: BowTieMetaInput): PdfReportMeta {
  return {
    reportTitle: metaInput.reportTitle ?? "Bow-Tie (Kelebek) Analiz Raporu",
    reportSubtitle: metaInput.reportSubtitle ?? "Tehditler · Önleyici bariyerler · Olay · Hafifletici bariyerler · Sonuçlar",
    ...metaInput,
  };
}

export function buildBowTiePdfHtml(
  data: BowTiePdfData,
  meta: PdfReportMeta,
  qrDataUrl: string,
): string {
  // Bariyerleri tehdit/sonuç ID'sine göre eşleştir
  const preventiveByThreat = new Map<string, typeof data.preventiveBarriers>();
  for (const b of data.preventiveBarriers ?? []) {
    const list = preventiveByThreat.get(b.threatId) ?? [];
    list.push(b);
    preventiveByThreat.set(b.threatId, list);
  }
  const mitigatingByConsequence = new Map<string, typeof data.mitigatingBarriers>();
  for (const b of data.mitigatingBarriers ?? []) {
    const list = mitigatingByConsequence.get(b.consequenceId) ?? [];
    list.push(b);
    mitigatingByConsequence.set(b.consequenceId, list);
  }

  function barrierBadge(working: boolean, label: string): string {
    const color = working ? "#16a34a" : "#dc2626";
    const icon = working ? "✓" : "✗";
    return `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;padding:4px 8px;background:${working ? "#f0fdf4" : "#fef2f2"};border-left:3px solid ${color};border-radius:3px;font-size:9px;">
      <span style="color:${color};font-weight:700;">${icon}</span>
      <span style="color:#111;flex:1;">${esc(label)}</span>
      <span style="font-size:7.5px;color:${color};text-transform:uppercase;">${working ? "Çalışıyor" : "Eksik"}</span>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8">
    <title>${esc(meta.reportTitle)}</title>
    <style>
      ${SHARED_PDF_CSS}
      h3 {
        margin: 14px 0 8px 0; padding: 5px 10px;
        background: #5ae0e0; color: #134e4a;
        font-size: 11px; font-weight: 700; letter-spacing: 0.5px; border-radius: 3px;
        page-break-after: avoid;
      }
      .hazard-box {
        background: #f0fdfa; border: 2px solid #14b8a6;
        padding: 10px 14px; margin: 8px 0; border-radius: 6px; text-align: center;
      }
      .hazard-label { font-size: 9px; color: #134e4a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
      .hazard-text { font-size: 12px; font-weight: 700; color: #064e4a; }
      .top-event-box {
        background: #fef2f2; border: 2px solid #dc2626;
        padding: 10px 14px; margin: 8px 0; border-radius: 6px; text-align: center;
      }
      .top-event-label { font-size: 9px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
      .top-event-text { font-size: 13px; font-weight: 700; color: #7f1d1d; }
      .bowtie-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 8px 0;
      }
      .branch-card {
        background: #f9fafb; border: 1px solid #d1d5db;
        border-radius: 4px; padding: 10px;
        page-break-inside: avoid;
      }
      .branch-card h4 {
        margin: 0 0 6px 0; font-size: 10px;
        color: #111; font-weight: 700;
      }
      .branch-causes-effects {
        font-size: 9.5px; color: #4b5563; margin: 4px 0 6px 14px;
      }
      .branch-causes-effects li { margin: 2px 0; }
      .barriers-section {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px dashed #d1d5db;
      }
      .barriers-label {
        font-size: 8px; color: #6b7280; text-transform: uppercase;
        letter-spacing: 0.4px; margin-bottom: 4px;
      }
    </style>
  </head>
  <body>
    ${renderReportHeader(meta)}

    ${data.problemStatement ? `
      <div style="background:#f9fafb;border:1px solid #d1d5db;border-left:4px solid #5ae0e0;padding:10px 14px;font-size:11px;line-height:1.55;margin-bottom:8px;">
        <strong>Olay özeti:</strong> ${esc(data.problemStatement)}
      </div>` : ""}

    ${data.hazard ? `
      <div class="hazard-box">
        <div class="hazard-label">Tehlike (Hazard)</div>
        <div class="hazard-text">${esc(data.hazard)}</div>
      </div>` : ""}

    ${data.topEvent ? `
      <div class="top-event-box">
        <div class="top-event-label">⚠ Kritik Olay (Top Event)</div>
        <div class="top-event-text">${esc(data.topEvent)}</div>
      </div>` : ""}

    <!-- KELEBEK DİYAGRAMI — SVG -->
    <h3>Bow-Tie / Kelebek Diyagramı</h3>
    <div style="background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:8px;margin-bottom:12px;page-break-inside:avoid;">
      ${renderBowTieSvg(data)}
    </div>

    <h3>Sol Kanat — Tehditler ve Önleyici Bariyerler</h3>
    ${(data.threats?.length ?? 0) === 0
      ? `<div style="padding:14px;background:#fef3c7;border-left:4px solid #d4a017;font-size:10px;color:#7c2d12;">Tehdit tanımlanmamış.</div>`
      : `<div class="bowtie-grid">
          ${data.threats.map((t) => `
            <div class="branch-card">
              <h4 style="color:#dc2626;">⚠ ${esc(t.label)}</h4>
              ${t.causes && t.causes.length > 0 ? `
                <ul class="branch-causes-effects">
                  ${t.causes.map((c) => `<li>${esc(c)}</li>`).join("")}
                </ul>` : ""}
              <div class="barriers-section">
                <div class="barriers-label">→ Önleyici bariyerler</div>
                ${(preventiveByThreat.get(t.id) ?? []).length === 0
                  ? `<div style="font-size:9px;color:#9ca3af;font-style:italic;">Bariyer tanımlanmamış</div>`
                  : (preventiveByThreat.get(t.id) ?? []).map((b) => barrierBadge(b.working, b.label)).join("")}
              </div>
            </div>
          `).join("")}
        </div>`}

    <h3>Sağ Kanat — Sonuçlar ve Hafifletici Bariyerler</h3>
    ${(data.consequences?.length ?? 0) === 0
      ? `<div style="padding:14px;background:#fef3c7;border-left:4px solid #d4a017;font-size:10px;color:#7c2d12;">Sonuç tanımlanmamış.</div>`
      : `<div class="bowtie-grid">
          ${data.consequences.map((c) => `
            <div class="branch-card">
              <h4 style="color:#7c3aed;">▶ ${esc(c.label)}</h4>
              ${c.effects && c.effects.length > 0 ? `
                <ul class="branch-causes-effects">
                  ${c.effects.map((e) => `<li>${esc(e)}</li>`).join("")}
                </ul>` : ""}
              <div class="barriers-section">
                <div class="barriers-label">→ Hafifletici bariyerler</div>
                ${(mitigatingByConsequence.get(c.id) ?? []).length === 0
                  ? `<div style="font-size:9px;color:#9ca3af;font-style:italic;">Bariyer tanımlanmamış</div>`
                  : (mitigatingByConsequence.get(c.id) ?? []).map((b) => barrierBadge(b.working, b.label)).join("")}
              </div>
            </div>
          `).join("")}
        </div>`}

    ${data.analysisSummary ? `
      <h3>Analiz Özeti</h3>
      <div style="background:#f9fafb;border:1px solid #d1d5db;border-left:4px solid #5ae0e0;padding:10px 14px;font-size:11px;line-height:1.55;">
        ${esc(data.analysisSummary)}
      </div>` : ""}

    ${renderReportFooter(meta, qrDataUrl)}
  </body>
</html>`;
}

export async function exportBowTiePdf(data: BowTiePdfData, metaInput: BowTieMetaInput): Promise<void> {
  if (typeof window === "undefined") return;
  const meta = normalizeBowTieMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildBowTiePdfHtml(data, meta, qrDataUrl);
  const printWindow = window.open("", "_blank", "width=1100,height=1400");
  if (!printWindow) { alert("Yazıcı penceresi açılamadı."); return; }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

export async function exportBowTiePdfBlob(data: BowTiePdfData, metaInput: BowTieMetaInput): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("client-side only");
  const meta = normalizeBowTieMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildBowTiePdfHtml(data, meta, qrDataUrl);
  const { generatePdfBlob } = await import("@/lib/pdf-generator");
  return generatePdfBlob(html, { title: meta.reportTitle, scale: 2 });
}
