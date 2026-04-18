/**
 * Ishikawa (Balık Kılçığı) PDF rapor template'i.
 *
 * İçerik:
 *  - Shared header (firma + lokasyon + olay + hazırlayan)
 *  - Fishbone SVG diyagramı (6 kategori)
 *  - Detaylı 6M tablosu — her kategori için nedenler
 *  - Birincil kök neden + analiz özeti
 *  - Shared footer (paylaşım URL + QR)
 */

import {
  type PdfReportMeta,
  SHARED_PDF_CSS,
  renderReportHeader,
  renderReportFooter,
  generateQrDataUrl,
  escHtml as esc,
} from "@/lib/pdf-shared-template";

/* ------------------------------------------------------------------ */
/*  Ishikawa 6M kategorileri (AI response formatıyla uyumlu)           */
/* ------------------------------------------------------------------ */

export type IshikawaCategoryKey = "insan" | "makine" | "metot" | "malzeme" | "olcum" | "cevre";

export interface IshikawaPdfData {
  /** 6M kategorileri */
  insan: string[];
  makine: string[];
  metot: string[];
  malzeme: string[];
  olcum: string[];
  cevre: string[];
  /** AI veya kullanıcının yazdığı problem cümlesi (genelde olay narrative) */
  problemStatement?: string | null;
  /** AI özeti */
  analysisSummary?: string | null;
  /** Birincil kök neden — AI veya manuel */
  primaryRootCause?: string | null;
  /** Önem değerlendirmesi (Yüksek/Orta/Düşük) */
  severityAssessment?: string | null;
  /** Custom kategoriler — 6M dışı eklenmiş ek başlıklar */
  customCategories?: { key: string; label: string; items: string[] }[];
}

const CATEGORY_META: { key: IshikawaCategoryKey; label: string; color: string; side: "top" | "bottom" }[] = [
  { key: "insan",    label: "İnsan",    color: "#dc2626", side: "top" },
  { key: "makine",   label: "Makine",   color: "#2563eb", side: "top" },
  { key: "metot",    label: "Metot",    color: "#16a34a", side: "top" },
  { key: "malzeme",  label: "Malzeme",  color: "#d4a017", side: "bottom" },
  { key: "olcum",    label: "Ölçüm",    color: "#9333ea", side: "bottom" },
  { key: "cevre",    label: "Çevre",    color: "#0891b2", side: "bottom" },
];

/* ------------------------------------------------------------------ */
/*  Fishbone SVG                                                       */
/* ------------------------------------------------------------------ */

/**
 * Uzun text'i SVG'de iki satıra böler. tspan kullanır.
 * maxChars: tek satıra sığacak yaklaşık karakter sayısı.
 */
function wrapTextSvg(text: string, maxChars: number, maxLines = 2): string[] {
  const cleaned = text.trim();
  if (cleaned.length <= maxChars) return [cleaned];
  const words = cleaned.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (lines.length >= maxLines - 1) {
      // son satırda kalan tüm kelimeleri sıkıştır
      cur = cur ? cur + " " + w : w;
    } else if ((cur + (cur ? " " : "") + w).length <= maxChars) {
      cur = cur ? cur + " " + w : w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  // Son satır hala uzun ise kırp + …
  if (lines.length === maxLines && lines[maxLines - 1].length > maxChars) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + "…";
  }
  return lines;
}

function renderFishboneSvg(data: IshikawaPdfData): string {
  // Daha geniş canvas — branch text'lerinin sığması için
  const W = 900, H = 460;
  const spineY = H / 2;
  const headW = 130, headH = 110;
  const headX = W - headW - 10;     // başın sol kenarı
  const tailX = 30;
  const branchSpacing = (headX - tailX - 30) / 3;

  // 3 üst kategori, 3 alt kategori — sıraya göre
  const tops = CATEGORY_META.filter((c) => c.side === "top");
  const bottoms = CATEGORY_META.filter((c) => c.side === "bottom");

  function renderBranch(cat: typeof CATEGORY_META[number], baseX: number, isTop: boolean): string {
    const items = (data[cat.key] ?? []).filter((c) => c && c.trim());
    const branchEndY = isTop ? spineY - 160 : spineY + 160;
    const labelY = isTop ? branchEndY - 8 : branchEndY + 14;

    // Ana dal — daha uzun, daha geniş açı
    const branch = `<line x1="${baseX}" y1="${spineY}" x2="${baseX + 70}" y2="${branchEndY}" stroke="${cat.color}" stroke-width="2" />`;

    // Kategori etiketi
    const labelBg = `<rect x="${baseX + 60}" y="${labelY - 11}" width="70" height="15" rx="3" fill="${cat.color}" />`;
    const label = `<text x="${baseX + 95}" y="${labelY}" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">${esc(cat.label)}</text>`;

    // Maksimum 5 neden göster
    const visibleItems = items.slice(0, 5);

    const causeLines = visibleItems
      .map((cause, i) => {
        const t = (i + 1) / 6; // ana dal üzerindeki konum
        const cx = baseX + 70 * t;
        const cy = spineY + (branchEndY - spineY) * t;
        const lineEndX = cx - 50;

        // 2 satıra kadar wrap, sonra "…"
        const lines = wrapTextSvg(String(cause), 28, 2);
        const lineH = 8;
        // Çoklu satır için baseline'ı yukarı kaydır (text dikey ortalansın)
        const startY = cy + 3 - (lines.length - 1) * lineH / 2;

        const tspans = lines
          .map((line, li) => {
            const y = startY + li * lineH;
            return `<text x="${lineEndX - 3}" y="${y}" font-size="6.5" fill="#374151" text-anchor="end">${esc(line)}</text>`;
          })
          .join("");

        return `
          <line x1="${cx}" y1="${cy}" x2="${lineEndX}" y2="${cy}" stroke="${cat.color}" stroke-width="1" opacity="0.7" />
          ${tspans}
        `;
      })
      .join("");

    // 5'ten fazla neden varsa "+N daha" notu
    const overflow = items.length > 5
      ? `<text x="${baseX + 35}" y="${branchEndY + (isTop ? -22 : 26)}" font-size="6.5" font-style="italic" fill="${cat.color}" text-anchor="middle" opacity="0.85">+${items.length - 5} neden daha</text>`
      : "";

    return branch + causeLines + labelBg + label + overflow;
  }

  // Problem statement multi-line wrap (head kutusunun içine sığdırma)
  const problemText = data.problemStatement ?? "Olay / Problem";
  const headLines = wrapTextSvg(problemText, 18, 7); // max 7 satıra kadar
  const headLineH = 11;
  // Kutu yüksekliğini içeriğe göre dinamik genişlet
  const dynamicHeadH = Math.max(headH, headLines.length * headLineH + 16);
  const headY = spineY - dynamicHeadH / 2;
  const headCenterX = headX + headW / 2;
  // Text bloğunu dikey ortala
  const headTextStartY = headY + (dynamicHeadH - headLines.length * headLineH) / 2 + headLineH - 2;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    <!-- Ana omurga (head'in sol kenarına kadar) -->
    <line x1="${tailX}" y1="${spineY}" x2="${headX}" y2="${spineY}" stroke="#1f2937" stroke-width="3" />
    <!-- Ok ucu -->
    <polygon points="${headX - 14},${spineY - 10} ${headX},${spineY} ${headX - 14},${spineY + 10}" fill="#1f2937" />
    <!-- Kuyruk -->
    <line x1="${tailX - 10}" y1="${spineY - 8}" x2="${tailX}" y2="${spineY}" stroke="#1f2937" stroke-width="2" />
    <line x1="${tailX - 10}" y1="${spineY + 8}" x2="${tailX}" y2="${spineY}" stroke="#1f2937" stroke-width="2" />

    <!-- Üst kategoriler -->
    ${tops.map((c, i) => renderBranch(c, tailX + 60 + branchSpacing * i + branchSpacing / 2, true)).join("")}

    <!-- Alt kategoriler -->
    ${bottoms.map((c, i) => renderBranch(c, tailX + 60 + branchSpacing * i + branchSpacing / 2, false)).join("")}

    <!-- Problem (baş) — SVG text multi-line, foreignObject yerine (html2canvas uyumlu) -->
    <rect x="${headX}" y="${headY}" width="${headW}" height="${dynamicHeadH}" rx="8" fill="#d4a017" stroke="#92400e" stroke-width="1.5" />
    ${headLines.map((line, i) => `
      <text x="${headCenterX}" y="${headTextStartY + i * headLineH}" font-size="9" font-weight="700" fill="#fff" text-anchor="middle" font-family="sans-serif">${esc(line)}</text>
    `).join("")}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  Detay tablosu — 6M kategorileri                                    */
/* ------------------------------------------------------------------ */

function renderCausesTable(data: IshikawaPdfData): string {
  const rows = CATEGORY_META.map((cat) => {
    const items = data[cat.key] ?? [];
    const list = items.filter((c) => c && c.trim());
    if (list.length === 0) {
      return `
        <tr>
          <td style="background:${cat.color}15;border-left:3px solid ${cat.color};font-weight:700;">${esc(cat.label)}</td>
          <td style="color:#9ca3af;font-style:italic;">— Bu kategoride neden tanımlanmamış —</td>
        </tr>`;
    }
    const causesHtml = list
      .map((c, i) => `<div style="margin:2px 0;"><span style="color:${cat.color};font-weight:600;">${i + 1}.</span> ${esc(c)}</div>`)
      .join("");
    return `
      <tr>
        <td style="background:${cat.color}15;border-left:3px solid ${cat.color};font-weight:700;vertical-align:top;width:90px;">
          ${esc(cat.label)}
          <div style="font-size:8px;color:#6b7280;font-weight:400;margin-top:2px;">${list.length} neden</div>
        </td>
        <td style="vertical-align:top;">${causesHtml}</td>
      </tr>`;
  }).join("");

  // Custom kategoriler
  const customRows = (data.customCategories ?? [])
    .filter((c) => c.items && c.items.some((i) => i && i.trim()))
    .map((cat) => {
      const list = cat.items.filter((c) => c && c.trim());
      const causesHtml = list
        .map((c, i) => `<div style="margin:2px 0;"><span style="color:#6b7280;font-weight:600;">${i + 1}.</span> ${esc(c)}</div>`)
        .join("");
      return `
        <tr>
          <td style="background:#f3f4f6;border-left:3px solid #6b7280;font-weight:700;vertical-align:top;">
            ${esc(cat.label)}
            <div style="font-size:8px;color:#6b7280;font-weight:400;margin-top:2px;">Özel · ${list.length} neden</div>
          </td>
          <td style="vertical-align:top;">${causesHtml}</td>
        </tr>`;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr><th style="width:90px;">Kategori</th><th>Tespit Edilen Nedenler</th></tr>
      </thead>
      <tbody>${rows}${customRows}</tbody>
    </table>
  `;
}

/* ------------------------------------------------------------------ */
/*  Meta normalizer                                                    */
/* ------------------------------------------------------------------ */

type IshikawaMetaInput = Omit<PdfReportMeta, "reportTitle" | "reportSubtitle"> & Partial<Pick<PdfReportMeta, "reportTitle" | "reportSubtitle">>;

function normalizeIshikawaMeta(metaInput: IshikawaMetaInput): PdfReportMeta {
  return {
    reportTitle: metaInput.reportTitle ?? "Ishikawa (Balık Kılçığı) Analiz Raporu",
    reportSubtitle: metaInput.reportSubtitle ?? "6M kategorisi ile kök neden görselleştirmesi",
    ...metaInput,
  };
}

/* ------------------------------------------------------------------ */
/*  HTML builder — print/blob için ortak                               */
/* ------------------------------------------------------------------ */

export function buildIshikawaPdfHtml(
  data: IshikawaPdfData,
  meta: PdfReportMeta,
  qrDataUrl: string,
): string {
  const totalCauses = CATEGORY_META.reduce((sum, c) => sum + (data[c.key]?.filter((x) => x?.trim()).length ?? 0), 0);
  const customTotal = (data.customCategories ?? []).reduce((sum, c) => sum + (c.items?.filter((x) => x?.trim()).length ?? 0), 0);

  return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8">
    <title>${esc(meta.reportTitle)}</title>
    <style>
      ${SHARED_PDF_CSS}
      h3 {
        margin: 14px 0 8px 0; padding: 5px 10px;
        background: #d4a017; color: #fff;
        font-size: 11px; font-weight: 700;
        letter-spacing: 0.5px; border-radius: 3px;
        page-break-after: avoid;
      }
      .severity-badge {
        display: inline-block; padding: 3px 10px;
        background: #fef3c7; color: #92400e; border: 1px solid #fbbf24;
        border-radius: 12px; font-size: 10px; font-weight: 600;
      }
      .summary-box {
        background: #f9fafb; border: 1px solid #d1d5db;
        border-left: 4px solid #d4a017;
        padding: 10px 14px; margin: 8px 0;
        font-size: 11px; line-height: 1.55;
      }
      .root-cause-box {
        background: #fef2f2; border: 1px solid #fca5a5;
        border-left: 4px solid #dc2626;
        padding: 10px 14px; margin: 8px 0;
        font-size: 11px; line-height: 1.55;
      }
      .root-cause-box .label {
        font-size: 9px; color: #991b1b; text-transform: uppercase;
        letter-spacing: 0.5px; margin-bottom: 4px;
      }
      .stats-row {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: 10px; margin-bottom: 12px;
      }
      .stat {
        padding: 8px 12px; background: #f9fafb; border: 1px solid #d1d5db;
        border-radius: 4px; text-align: center;
      }
      .stat-value { font-size: 16px; font-weight: 700; color: #111; }
      .stat-label { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }
      .fishbone-card {
        background: #fff; padding: 6px;
        border: 1px solid #d1d5db; border-radius: 4px;
        page-break-inside: avoid; margin-bottom: 12px;
      }
    </style>
  </head>
  <body>
    ${renderReportHeader(meta)}

    <div class="stats-row">
      <div class="stat">
        <div class="stat-value">${totalCauses + customTotal}</div>
        <div class="stat-label">Toplam Neden</div>
      </div>
      <div class="stat">
        <div class="stat-value">${CATEGORY_META.length + (data.customCategories?.length ?? 0)}</div>
        <div class="stat-label">Kategori</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.severityAssessment ? `<span class="severity-badge">${esc(data.severityAssessment)}</span>` : "—"}</div>
        <div class="stat-label">Önem</div>
      </div>
    </div>

    ${
      data.problemStatement
        ? `<div class="summary-box"><strong>Problem ifadesi:</strong> ${esc(data.problemStatement)}</div>`
        : ""
    }

    <h3>Balık Kılçığı Diyagramı</h3>
    <div class="fishbone-card">${renderFishboneSvg(data)}</div>

    <h3>6M Kategorisi · Detaylı Neden Listesi</h3>
    ${renderCausesTable(data)}

    ${
      data.primaryRootCause
        ? `<h3>Birincil Kök Neden</h3>
           <div class="root-cause-box">
             <div class="label">★ Birincil kök neden tespiti</div>
             ${esc(data.primaryRootCause)}
           </div>`
        : ""
    }

    ${
      data.analysisSummary
        ? `<h3>Analiz Özeti</h3>
           <div class="summary-box">${esc(data.analysisSummary)}</div>`
        : ""
    }

    ${renderReportFooter(meta, qrDataUrl)}
  </body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Public API — Print                                                 */
/* ------------------------------------------------------------------ */

export async function exportIshikawaPdf(
  data: IshikawaPdfData,
  metaInput: IshikawaMetaInput,
): Promise<void> {
  if (typeof window === "undefined") return;
  const meta = normalizeIshikawaMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildIshikawaPdfHtml(data, meta, qrDataUrl);

  const printWindow = window.open("", "_blank", "width=1100,height=1400");
  if (!printWindow) {
    alert("Yazıcı penceresi açılamadı. Lütfen pop-up engelleyiciyi kontrol edin.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

/* ------------------------------------------------------------------ */
/*  Public API — Blob (paylaşım için)                                  */
/* ------------------------------------------------------------------ */

export async function exportIshikawaPdfBlob(
  data: IshikawaPdfData,
  metaInput: IshikawaMetaInput,
): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("client-side only");
  const meta = normalizeIshikawaMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildIshikawaPdfHtml(data, meta, qrDataUrl);
  const { generatePdfBlob } = await import("@/lib/pdf-generator");
  return generatePdfBlob(html, { title: meta.reportTitle, scale: 2 });
}
