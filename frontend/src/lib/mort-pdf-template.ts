/**
 * MORT (Management Oversight & Risk Tree) — DOE/ANSI standardı PDF rapor.
 *
 * İçerik:
 *  - Üst olay + Enerji-Hedef-Bariyer (ETB) trace SVG
 *  - MORT Tree SVG (S dalı + M dalı, AND/OR kapıları, LTA renk kodlaması)
 *  - Olay Sequence (zaman çizgisi)
 *  - Specific Control Factors (SA1/SA2/SA3 detay tabloları)
 *  - Management Factor Assessment Matrix (7 faktör × LTA durumu)
 *  - Change Analysis (ne değişti / neden / etkisi)
 *  - Birincil Kök Neden + Öneriler
 */

import type { MortData, MortFactorStatus, MortBarrierAssessment } from "@/lib/analysis/types";
import {
  type PdfReportMeta,
  SHARED_PDF_CSS,
  renderReportHeader,
  renderReportFooter,
  generateQrDataUrl,
  escHtml as esc,
} from "@/lib/pdf-shared-template";

export interface MortPdfData extends MortData {
  problemStatement?: string | null;
  analysisSummary?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Statü meta                                                         */
/* ------------------------------------------------------------------ */

const STATUS_META: Record<MortFactorStatus, { label: string; color: string; bg: string; icon: string }> = {
  adequate:     { label: "Yeterli",            color: "#16a34a", bg: "#f0fdf4", icon: "✓" },
  lta:          { label: "Yetersiz (LTA)",     color: "#dc2626", bg: "#fef2f2", icon: "✗" },
  not_assessed: { label: "Değerlendirilmedi",  color: "#a16207", bg: "#fef9c3", icon: "?" },
};

const MGMT_FACTOR_LABELS: Record<string, string> = {
  policy: "Politika",
  implementation: "Uygulama",
  riskAssessment: "Risk Değerlendirme",
  resources: "Kaynaklar",
  communication: "İletişim",
  training: "Eğitim",
  monitoring: "İzleme/Denetim",
};

/** SVG diyagramda kullanılacak kısa label (genişliğe göre) */
const MGMT_FACTOR_SHORT_LABELS: Record<string, string> = {
  policy: "Politika",
  implementation: "Uygulama",
  riskAssessment: "Risk Değer.",
  resources: "Kaynaklar",
  communication: "İletişim",
  training: "Eğitim",
  monitoring: "İzleme",
};

const ENERGY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  kinetik:      { label: "Kinetik (hareket)",      color: "#dc2626" },
  termal:       { label: "Termal (ısı)",           color: "#ea580c" },
  kimyasal:     { label: "Kimyasal",               color: "#7c3aed" },
  elektriksel:  { label: "Elektriksel",            color: "#eab308" },
  mekanik:      { label: "Mekanik",                color: "#0891b2" },
  biyolojik:    { label: "Biyolojik",              color: "#16a34a" },
  radyasyon:    { label: "Radyasyon",              color: "#a16207" },
  akustik:      { label: "Akustik (gürültü)",      color: "#7e22ce" },
};

function getEnergyMeta(type?: string | null) {
  if (!type) return { label: "Belirsiz", color: "#6b7280" };
  const key = type.toLowerCase().split(/[\s/]/)[0];
  return ENERGY_TYPE_LABELS[key] ?? { label: type, color: "#6b7280" };
}

/* ------------------------------------------------------------------ */
/*  ETB (Energy-Target-Barrier) trace SVG                              */
/* ------------------------------------------------------------------ */

function renderEtbTraceSvg(data: MortPdfData): string {
  const W = 900, H = 240;
  const sourceBox = { x: 20, y: 60, w: 220, h: 120, color: "#fb923c" };
  const targetBox = { x: W - 240, y: 60, w: 220, h: 120, color: "#3b82f6" };
  const barrierY = 60, barrierH = 120, barrierW = 100, barrierGap = 8;
  const barriers = [
    ...(data.sa1Barriers ?? []).slice(0, 2),
    ...(data.sa2Barriers ?? []).slice(0, 2),
    ...(data.sa3Barriers ?? []).slice(0, 2),
  ].slice(0, 4); // max 4 bariyer ETB'de

  const totalBarrierWidth = barriers.length * barrierW + (barriers.length - 1) * barrierGap;
  const barriersStartX = (W - totalBarrierWidth) / 2;

  const energy = getEnergyMeta(data.energyType);

  function wrapShort(text: string, max: number, lines = 3): string[] {
    const cleaned = String(text ?? "").trim();
    if (cleaned.length <= max) return [cleaned];
    const words = cleaned.split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      if (out.length >= lines - 1) { cur = cur ? cur + " " + w : w; }
      else if ((cur + (cur ? " " : "") + w).length <= max) { cur = cur ? cur + " " + w : w; }
      else { if (cur) out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    if (out.length === lines && out[lines - 1].length > max) {
      out[lines - 1] = out[lines - 1].slice(0, max - 1) + "…";
    }
    return out;
  }

  function renderBox(x: number, y: number, w: number, h: number, fill: string, label: string, sub: string): string {
    // Dinamik wrap: kutu genişliğine göre karakter sayısı + 5 satıra kadar
    const charsPerLine = Math.max(14, Math.floor(w / 7));
    const subLines = wrapShort(sub, charsPerLine, 5);
    // Fontu satır sayısına göre ayarla
    const fontSub = subLines.length <= 2 ? 11 : subLines.length <= 3 ? 10 : subLines.length <= 4 ? 9 : 8;
    const lineH = fontSub + 2;
    // Alt metni kutunun orta-alt kısmına ortala
    const subBlockH = subLines.length * lineH;
    const subStartY = y + 34 + (h - 40 - subBlockH) / 2 + lineH - 2;
    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" opacity="0.92" />
      <text x="${x + w / 2}" y="${y + 20}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle" font-family="sans-serif" letter-spacing="0.4">${esc(label)}</text>
      ${subLines.map((line, i) => `
        <text x="${x + w / 2}" y="${subStartY + i * lineH}" font-size="${fontSub}" font-weight="600" fill="#fff" text-anchor="middle" font-family="sans-serif">${esc(line)}</text>
      `).join("")}
    `;
  }

  function renderBarrier(b: MortBarrierAssessment, x: number, y: number, w: number, h: number): string {
    const status = STATUS_META[b.status] ?? STATUS_META.not_assessed;
    // Daha fazla satır (4) ve dinamik font
    const charsPerLine = Math.max(12, Math.floor(w / 6.5));
    const lines = wrapShort(b.label, charsPerLine, 4);
    const fontSize = lines.length <= 2 ? 9 : lines.length <= 3 ? 8 : 7;
    const lineH = fontSize + 1;
    const textBlockH = lines.length * lineH;
    const startY = y + 22 + (h - 28 - textBlockH) / 2 + lineH - 1;
    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"
        fill="${status.bg}" stroke="${status.color}" stroke-width="2"
        ${b.status === "lta" ? 'stroke-dasharray="4 2"' : ""} />
      <text x="${x + w / 2}" y="${y + 15}" font-size="15" font-weight="700" fill="${status.color}" text-anchor="middle">${status.icon}</text>
      ${lines.map((line, i) => `
        <text x="${x + w / 2}" y="${startY + i * lineH}" font-size="${fontSize}" font-weight="600" fill="#111" text-anchor="middle" font-family="sans-serif">${esc(line)}</text>
      `).join("")}
    `;
  }

  // Akış oku (kaynak → bariyerler → hedef) — dikey merkez
  const arrowY = 120;
  const arrows = [];
  if (barriers.length === 0) {
    arrows.push(`<line x1="${sourceBox.x + sourceBox.w}" y1="${arrowY}" x2="${targetBox.x - 10}" y2="${arrowY}" stroke="#dc2626" stroke-width="3" />`);
    arrows.push(`<polygon points="${targetBox.x - 10},${arrowY - 8} ${targetBox.x},${arrowY} ${targetBox.x - 10},${arrowY + 8}" fill="#dc2626" />`);
  } else {
    arrows.push(`<line x1="${sourceBox.x + sourceBox.w}" y1="${arrowY}" x2="${barriersStartX - 5}" y2="${arrowY}" stroke="${energy.color}" stroke-width="3" />`);
    arrows.push(`<line x1="${barriersStartX + totalBarrierWidth + 5}" y1="${arrowY}" x2="${targetBox.x - 10}" y2="${arrowY}" stroke="#ef4444" stroke-width="3" />`);
    arrows.push(`<polygon points="${targetBox.x - 10},${arrowY - 8} ${targetBox.x},${arrowY} ${targetBox.x - 10},${arrowY + 8}" fill="#ef4444" />`);
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    <text x="${W / 2}" y="20" font-size="13" font-weight="700" fill="#0f172a" text-anchor="middle" font-family="sans-serif">
      Enerji-Hedef-Bariyer (ETB) Akışı
    </text>
    <text x="${W / 2}" y="36" font-size="9" fill="#6b7280" text-anchor="middle" font-family="sans-serif">
      Enerji tipi: ${esc(energy.label)}
    </text>
    ${arrows.join("")}
    ${renderBox(sourceBox.x, sourceBox.y, sourceBox.w, sourceBox.h, energy.color, "ENERJİ KAYNAĞI", data.energySource ?? "—")}
    ${barriers.map((b, i) => renderBarrier(b, barriersStartX + i * (barrierW + barrierGap), barrierY, barrierW, barrierH)).join("")}
    ${renderBox(targetBox.x, targetBox.y, targetBox.w, targetBox.h, targetBox.color, "SAVUNMASIZ HEDEF", data.vulnerableTarget ?? "—")}
    <text x="${W / 2}" y="${H - 8}" font-size="8" fill="#6b7280" text-anchor="middle" font-style="italic">
      ✓ Yeterli bariyer · ✗ LTA (Less Than Adequate) · ? Değerlendirilmedi
    </text>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  MORT Tree SVG (S + M dalları)                                      */
/* ------------------------------------------------------------------ */

function renderMortTreeSvg(data: MortPdfData): string {
  const W = 920, H = 500;
  const cx = W / 2;

  // Top event box — dinamik boyut (uzun metinler için multi-line)
  const topText = data.topEvent || "Olay tanımlanmamış";
  const topWrapChars = 44; // 320px genişlikte sığar
  const topLines: string[] = (() => {
    const cleaned = topText.trim();
    if (cleaned.length <= topWrapChars) return [cleaned];
    const words = cleaned.split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      if (out.length >= 2) { cur = cur ? cur + " " + w : w; }
      else if ((cur + (cur ? " " : "") + w).length <= topWrapChars) { cur = cur ? cur + " " + w : w; }
      else { if (cur) out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    // max 3 satır, fazlası "..."
    if (out.length > 3) {
      out.length = 3;
      if (out[2].length > topWrapChars - 1) out[2] = out[2].slice(0, topWrapChars - 1) + "…";
    }
    return out;
  })();
  const topW = 340;
  const topLineH = 13;
  const topH = Math.max(50, 24 + topLines.length * topLineH + 10);
  const topY = 30;
  const topX = cx - topW / 2;

  // Sub-tree positions
  const branchY = 130;
  const sBranchX = W * 0.25;
  const mBranchX = W * 0.75;

  // S dalı alt nodları (SA1, SA2, SA3)
  const sNodes = [
    { label: "SA1\nEnerji Kontrolü", x: sBranchX - 130, y: 220, items: data.sa1Barriers ?? [], color: "#dc2626" },
    { label: "SA2\nHedef Koruma", x: sBranchX,         y: 220, items: data.sa2Barriers ?? [], color: "#ea580c" },
    { label: "SA3\nGenel Bariyer", x: sBranchX + 130,  y: 220, items: data.sa3Barriers ?? [], color: "#7c3aed" },
  ];

  // M dalı alt nodları (yönetim faktörleri) — 4'lü grid, daha geniş kutu
  const mFactors = data.mortMgmtFactors ?? {};
  const mFactorEntries = Object.entries(MGMT_FACTOR_SHORT_LABELS);
  const mCellW = 88, mCellGap = 8, mRowH = 52;
  const mGridStartX = mBranchX - (4 * mCellW + 3 * mCellGap) / 2 + mCellW / 2;
  const mNodes = mFactorEntries.map(([key, label], i) => ({
    key,
    label,
    status: (mFactors as Record<string, MortFactorStatus | undefined>)[key] ?? "not_assessed",
    x: mGridStartX + (i % 4) * (mCellW + mCellGap),
    y: 220 + Math.floor(i / 4) * mRowH,
  }));

  function aggregateStatus(items: MortBarrierAssessment[]): MortFactorStatus {
    if (items.length === 0) return "not_assessed";
    if (items.some((i) => i.status === "lta")) return "lta";
    if (items.every((i) => i.status === "adequate")) return "adequate";
    return "not_assessed";
  }

  function renderNode(x: number, y: number, w: number, h: number, label: string, status: MortFactorStatus, count?: number): string {
    const meta = STATUS_META[status];
    return `
      <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="4"
        fill="${meta.bg}" stroke="${meta.color}" stroke-width="2" />
      <text x="${x}" y="${y - 4}" font-size="9" font-weight="700" fill="${meta.color}" text-anchor="middle">
        ${meta.icon} ${esc(label.split("\n")[0])}
      </text>
      ${label.includes("\n") ? `
        <text x="${x}" y="${y + 8}" font-size="7" font-weight="600" fill="#111" text-anchor="middle">
          ${esc(label.split("\n")[1] ?? "")}
        </text>` : ""}
      ${count !== undefined && count > 0 ? `
        <text x="${x}" y="${y + 18}" font-size="6.5" fill="#6b7280" text-anchor="middle">${count} öğe</text>` : ""}
    `;
  }

  // Connector lines
  const connectors = [
    // Top event → S branch
    `<line x1="${cx}" y1="${topY + topH}" x2="${cx}" y2="${branchY - 10}" stroke="#475569" stroke-width="2" />`,
    `<line x1="${sBranchX}" y1="${branchY - 10}" x2="${mBranchX}" y2="${branchY - 10}" stroke="#475569" stroke-width="2" />`,
    `<line x1="${sBranchX}" y1="${branchY - 10}" x2="${sBranchX}" y2="${branchY}" stroke="#1d4ed8" stroke-width="2" />`,
    `<line x1="${mBranchX}" y1="${branchY - 10}" x2="${mBranchX}" y2="${branchY}" stroke="#7c2d12" stroke-width="2" />`,
    // S branch → SA1/SA2/SA3
    ...sNodes.map((n) => `<line x1="${sBranchX}" y1="${branchY + 30}" x2="${n.x}" y2="${n.y - 25}" stroke="#1d4ed8" stroke-width="1.5" />`),
    // M branch → factor nodes
    ...mNodes.map((n) => `<line x1="${mBranchX}" y1="${branchY + 30}" x2="${n.x}" y2="${n.y - 18}" stroke="#7c2d12" stroke-width="1" opacity="0.7" />`),
  ];

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    <!-- Title -->
    <text x="${cx}" y="18" font-size="13" font-weight="700" fill="#0f172a" text-anchor="middle" font-family="sans-serif">
      MORT Tree — Yönetim Gözetim Risk Ağacı
    </text>

    <!-- Top Event (dinamik yükseklik, multi-line wrap) -->
    <rect x="${topX}" y="${topY}" width="${topW}" height="${topH}" rx="6" fill="#dc2626" stroke="#7f1d1d" stroke-width="2" />
    <text x="${cx}" y="${topY + 18}" font-size="9" fill="#fff" font-weight="700" text-anchor="middle" letter-spacing="0.5">
      ⚠ ÜST OLAY (TOP EVENT)
    </text>
    ${topLines.map((line, i) => `
      <text x="${cx}" y="${topY + 34 + i * topLineH}" font-size="9.5" fill="#fff" font-weight="600" text-anchor="middle" font-family="sans-serif">${esc(line)}</text>
    `).join("")}

    <!-- Connector lines -->
    ${connectors.join("")}

    <!-- S branch label (geniş) -->
    <rect x="${sBranchX - 110}" y="${branchY}" width="220" height="32" rx="4" fill="#1d4ed8" />
    <text x="${sBranchX}" y="${branchY + 14}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">
      S — Spesifik Kontrol Faktörleri
    </text>
    <text x="${sBranchX}" y="${branchY + 26}" font-size="7" fill="#dbeafe" text-anchor="middle">
      Olayla doğrudan ilişkili
    </text>

    <!-- M branch label (geniş — 4'lü grid'e oturmak için) -->
    <rect x="${mBranchX - 200}" y="${branchY}" width="400" height="32" rx="4" fill="#7c2d12" />
    <text x="${mBranchX}" y="${branchY + 14}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">
      M — Yönetim Sistemi Faktörleri (7 alt-faktör)
    </text>
    <text x="${mBranchX}" y="${branchY + 26}" font-size="7" fill="#fed7aa" text-anchor="middle">
      Sistemik / dolaylı nedenler
    </text>

    <!-- S sub-nodes (SA1/SA2/SA3) -->
    ${sNodes.map((n) => renderNode(n.x, n.y, 110, 50, n.label, aggregateStatus(n.items), n.items.length)).join("")}

    <!-- M factor nodes (geniş kutucuk, 8 char'a kadar tek satır sığar) -->
    ${mNodes.map((n) => renderNode(n.x, n.y, mCellW - 4, 38, n.label, n.status as MortFactorStatus)).join("")}

    <!-- Legend -->
    <g transform="translate(20, ${H - 30})">
      <text x="0" y="0" font-size="8" font-weight="700" fill="#0f172a">Durum:</text>
      <rect x="40" y="-8" width="10" height="10" rx="2" fill="${STATUS_META.adequate.bg}" stroke="${STATUS_META.adequate.color}" stroke-width="1.5" />
      <text x="54" y="0" font-size="8" fill="#111">${STATUS_META.adequate.icon} Yeterli</text>
      <rect x="115" y="-8" width="10" height="10" rx="2" fill="${STATUS_META.lta.bg}" stroke="${STATUS_META.lta.color}" stroke-width="1.5" />
      <text x="129" y="0" font-size="8" fill="#111">${STATUS_META.lta.icon} Yetersiz (LTA)</text>
      <rect x="220" y="-8" width="10" height="10" rx="2" fill="${STATUS_META.not_assessed.bg}" stroke="${STATUS_META.not_assessed.color}" stroke-width="1.5" />
      <text x="234" y="0" font-size="8" fill="#111">${STATUS_META.not_assessed.icon} Değerlendirilmedi</text>
    </g>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  Yardımcılar                                                        */
/* ------------------------------------------------------------------ */

function renderBarrierTable(barriers: MortBarrierAssessment[], emptyMsg: string): string {
  if (barriers.length === 0) {
    return `<div style="padding:8px 12px;background:#f9fafb;border:1px dashed #d1d5db;border-radius:4px;font-size:9.5px;color:#6b7280;font-style:italic;">${emptyMsg}</div>`;
  }
  return `
    <table>
      <thead>
        <tr>
          <th style="width:50%;">Bariyer / Kontrol</th>
          <th style="width:120px;">Durum</th>
          <th>Notlar</th>
        </tr>
      </thead>
      <tbody>
        ${barriers.map((b) => {
          const meta = STATUS_META[b.status] ?? STATUS_META.not_assessed;
          return `
            <tr>
              <td style="font-weight:600;">${esc(b.label)}</td>
              <td style="text-align:center;">
                <span style="display:inline-block;padding:2px 8px;background:${meta.bg};color:${meta.color};border:1px solid ${meta.color};border-radius:10px;font-size:9px;font-weight:700;">
                  ${meta.icon} ${esc(meta.label)}
                </span>
              </td>
              <td style="font-size:9.5px;color:#4b5563;">${esc(b.notes ?? "—")}</td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderMgmtMatrix(factors?: MortPdfData["mortMgmtFactors"]): string {
  const safeFactors = factors ?? {};
  const rows = Object.entries(MGMT_FACTOR_LABELS).map(([key, label]) => {
    const status = (safeFactors as Record<string, MortFactorStatus | undefined>)[key] ?? "not_assessed";
    const meta = STATUS_META[status];
    return `
      <tr style="background:${status === "lta" ? "#fef2f2" : status === "adequate" ? "#f0fdf4" : "#fff"};">
        <td style="font-weight:600;width:40%;">${esc(label)}</td>
        <td style="text-align:center;width:100px;font-size:18px;color:${meta.color};font-weight:700;">${meta.icon}</td>
        <td style="text-align:center;width:140px;">
          <span style="display:inline-block;padding:2px 8px;background:${meta.bg};color:${meta.color};border:1px solid ${meta.color};border-radius:10px;font-size:9px;font-weight:700;">
            ${esc(meta.label)}
          </span>
        </td>
        <td style="font-size:9px;color:#6b7280;">
          ${key === "policy" ? "İSG politikası, prosedürler, yazılı kurallar" : ""}
          ${key === "implementation" ? "Politikanın sahada uygulanması" : ""}
          ${key === "riskAssessment" ? "Risk analizi yapılmış mı?" : ""}
          ${key === "resources" ? "Bütçe, personel, ekipman yeterliliği" : ""}
          ${key === "communication" ? "Bilgi akışı, toplantılar, raporlama" : ""}
          ${key === "training" ? "Eğitim programı, sertifika, tatbikat" : ""}
          ${key === "monitoring" ? "Denetim, gözlem, KPI takibi" : ""}
        </td>
      </tr>`;
  }).join("");

  return `
    <table>
      <thead>
        <tr>
          <th>Yönetim Faktörü</th>
          <th style="text-align:center;">Sembol</th>
          <th style="text-align:center;">Değerlendirme</th>
          <th>Açıklama</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ------------------------------------------------------------------ */
/*  Meta normalizer + HTML builder                                     */
/* ------------------------------------------------------------------ */

type MortMetaInput = Omit<PdfReportMeta, "reportTitle" | "reportSubtitle"> & Partial<Pick<PdfReportMeta, "reportTitle" | "reportSubtitle">>;

function normalizeMortMeta(metaInput: MortMetaInput): PdfReportMeta {
  return {
    reportTitle: metaInput.reportTitle ?? "MORT (Management Oversight & Risk Tree) Analiz Raporu",
    reportSubtitle: metaInput.reportSubtitle ?? "DOE/ANSI standardı yönetim-gözetim ağaç analizi · ETB trace + LTA değerlendirme",
    ...metaInput,
  };
}

export function buildMortPdfHtml(
  data: MortPdfData,
  meta: PdfReportMeta,
  qrDataUrl: string,
): string {
  const energy = getEnergyMeta(data.energyType);
  const mgmtLta = data.mortMgmtFactors
    ? Object.values(data.mortMgmtFactors).filter((s) => s === "lta").length
    : 0;
  const totalLtaBarriers = [
    ...(data.sa1Barriers ?? []),
    ...(data.sa2Barriers ?? []),
    ...(data.sa3Barriers ?? []),
  ].filter((b) => b.status === "lta").length;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${esc(meta.reportTitle)}</title>
<style>
  ${SHARED_PDF_CSS}
  h3 {
    margin: 14px 0 8px 0; padding: 5px 12px;
    background: #7c2d12; color: #fff;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.5px; border-radius: 3px;
    page-break-after: avoid; text-transform: uppercase;
  }
  h4 {
    margin: 10px 0 6px; padding: 3px 10px;
    background: #fed7aa; color: #7c2d12;
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.4px; border-radius: 2px;
  }
  .mort-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .mort-stat {
    padding: 8px 10px;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    text-align: center;
  }
  .mort-stat-value { font-size: 16px; font-weight: 700; }
  .mort-stat-label { font-size: 8.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }
  .top-event-box {
    background: #fef2f2; border: 2px solid #dc2626;
    padding: 12px 16px; margin: 8px 0; border-radius: 6px;
  }
  .top-event-label {
    font-size: 9px; color: #991b1b; text-transform: uppercase;
    letter-spacing: 0.5px; margin-bottom: 4px;
  }
  .top-event-text { font-size: 13px; font-weight: 700; color: #7f1d1d; line-height: 1.4; }
  .what-happened-box {
    background: #faf5ff; border: 1px solid #d8b4fe;
    border-left: 4px solid #a05ae0;
    padding: 10px 14px; margin: 8px 0;
    font-size: 11px; line-height: 1.6;
  }
  .diagram-card {
    padding: 8px;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    margin-bottom: 12px;
    page-break-inside: avoid;
  }
  .seq-list {
    counter-reset: step;
    margin: 0; padding: 0; list-style: none;
  }
  .seq-list li {
    counter-increment: step;
    padding: 6px 10px 6px 36px;
    margin-bottom: 4px;
    background: #f9fafb;
    border-left: 3px solid #7c2d12;
    border-radius: 3px;
    font-size: 10px;
    position: relative;
  }
  .seq-list li::before {
    content: counter(step);
    position: absolute;
    left: 8px; top: 50%; transform: translateY(-50%);
    width: 20px; height: 20px;
    background: #7c2d12; color: #fff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700;
  }
  .change-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 8px;
  }
  .change-cell {
    padding: 8px 10px;
    background: #fef9c3;
    border: 1px solid #fde68a;
    border-left: 3px solid #d4a017;
    border-radius: 3px;
  }
  .change-cell .label {
    font-size: 8.5px; color: #7c2d12;
    text-transform: uppercase; letter-spacing: 0.4px;
    font-weight: 700; margin-bottom: 4px;
  }
  .change-cell .value { font-size: 9.5px; color: #111; line-height: 1.4; }
  .root-cause-box {
    background: #fef2f2; border: 2px solid #dc2626;
    padding: 14px 18px; margin: 12px 0; border-radius: 6px;
  }
  .recommendation-list {
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-left: 4px solid #16a34a;
    padding: 10px 14px;
    border-radius: 3px;
    margin: 8px 0;
  }
  .recommendation-list ol {
    margin: 0; padding-left: 22px;
    font-size: 10.5px; line-height: 1.6;
  }
  .recommendation-list li { margin: 3px 0; }
</style>
</head>
<body>

${renderReportHeader(meta)}

<!-- ÖZET STATS -->
<div class="mort-stats">
  <div class="mort-stat" style="border-left:3px solid ${energy.color};">
    <div class="mort-stat-value" style="color:${energy.color};font-size:11px;">${esc(energy.label)}</div>
    <div class="mort-stat-label">Enerji Tipi</div>
  </div>
  <div class="mort-stat" style="border-left:3px solid #dc2626;">
    <div class="mort-stat-value" style="color:#dc2626;">${totalLtaBarriers}</div>
    <div class="mort-stat-label">LTA Bariyer</div>
  </div>
  <div class="mort-stat" style="border-left:3px solid #ea580c;">
    <div class="mort-stat-value" style="color:#ea580c;">${mgmtLta} / 7</div>
    <div class="mort-stat-label">Yetersiz Mgmt Faktör</div>
  </div>
  <div class="mort-stat" style="border-left:3px solid ${data.riskAssumed ? "#a16207" : "#16a34a"};">
    <div class="mort-stat-value" style="color:${data.riskAssumed ? "#a16207" : "#16a34a"};font-size:11px;">${data.riskAssumed ? "ÜSTLENİLDİ" : "ÜSTLENMEDİ"}</div>
    <div class="mort-stat-label">Risk Üstlenildi mi?</div>
  </div>
</div>

<!-- ÜST OLAY -->
${data.topEvent ? `
  <div class="top-event-box">
    <div class="top-event-label">⚠ Üst Olay (Top Event)</div>
    <div class="top-event-text">${esc(data.topEvent)}</div>
  </div>` : ""}

<!-- NE OLDU -->
${data.sections?.whatHappened ? `
  <h3>Ne Oldu?</h3>
  <div class="what-happened-box">${esc(data.sections.whatHappened)}</div>` : ""}

<!-- ETB TRACE DİYAGRAMI -->
<h3>Enerji-Hedef-Bariyer (ETB) Trace</h3>
<div class="diagram-card">
  ${renderEtbTraceSvg(data)}
</div>

<!-- MORT TREE DİYAGRAMI -->
<h3>MORT Ağacı — Yönetim Gözetim Risk Ağacı</h3>
<div class="diagram-card">
  ${renderMortTreeSvg(data)}
</div>

<!-- OLAY ZİNCİRİ -->
${(data.eventSequence?.length ?? 0) > 0 ? `
  <h3>Olay Zinciri (Event Sequence)</h3>
  <ol class="seq-list">
    ${(data.eventSequence ?? []).map((e) => `<li>${esc(e)}</li>`).join("")}
  </ol>` : ""}

<!-- SPESIFIK KONTROL FAKTÖRLERİ -->
<h3>S Dalı — Spesifik Kontrol Faktörleri</h3>

<h4>SA1 — Enerji Kontrolü Bariyerleri</h4>
${renderBarrierTable(data.sa1Barriers ?? [], "Enerji kontrol bariyeri tanımlanmamış.")}

<h4>SA2 — Hedef Koruma Bariyerleri</h4>
${renderBarrierTable(data.sa2Barriers ?? [], "Hedef koruma bariyeri tanımlanmamış.")}

<h4>SA3 — Genel Bariyer/Kontroller</h4>
${renderBarrierTable(data.sa3Barriers ?? [], "Genel bariyer tanımlanmamış.")}

<!-- M DALI — YÖNETIM FAKTÖRLERİ -->
<h3>M Dalı — Yönetim Sistemi Faktörleri (LTA Değerlendirme)</h3>
${renderMgmtMatrix(data.mortMgmtFactors)}

<!-- DEĞIŞIM ANALİZİ -->
${data.changeAnalysis ? `
  <h3>Değişim Analizi (Change Analysis)</h3>
  <div class="change-grid">
    <div class="change-cell">
      <div class="label">▶ Ne Değişti?</div>
      <div class="value">${esc(data.changeAnalysis.whatChanged ?? "—")}</div>
    </div>
    <div class="change-cell">
      <div class="label">▶ Neden Değişti?</div>
      <div class="value">${esc(data.changeAnalysis.whyChanged ?? "—")}</div>
    </div>
    <div class="change-cell">
      <div class="label">▶ Etkisi Ne Oldu?</div>
      <div class="value">${esc(data.changeAnalysis.effectOfChange ?? "—")}</div>
    </div>
  </div>` : ""}

<!-- BİRİNCİL KÖK NEDEN -->
${data.primaryRootCause ? `
  <h3>★ Birincil Kök Neden</h3>
  <div class="root-cause-box">
    <div style="font-size:9px;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">MORT metoduna göre sistemik kök neden tespiti:</div>
    <div style="font-size:12px;font-weight:600;color:#7f1d1d;line-height:1.5;">${esc(data.primaryRootCause)}</div>
  </div>` : ""}

<!-- YÖNETSEL KONTROL EKSİKLİKLERİ + ÇIKARILAN DERSLER (eski format - geriye dönük) -->
${(data.sections?.supervisoryControl?.length ?? 0) > 0 ? `
  <h4>Yönetsel Kontrol Eksiklikleri</h4>
  <ul style="margin:0;padding-left:22px;font-size:10px;line-height:1.6;">
    ${(data.sections?.supervisoryControl ?? []).filter((c) => c?.trim()).map((c) => `<li>${esc(c)}</li>`).join("")}
  </ul>` : ""}

${(data.sections?.lessonsLearned?.length ?? 0) > 0 ? `
  <h4>Çıkarılan Dersler</h4>
  <ul style="margin:0;padding-left:22px;font-size:10px;line-height:1.6;">
    ${(data.sections?.lessonsLearned ?? []).filter((c) => c?.trim()).map((c) => `<li>${esc(c)}</li>`).join("")}
  </ul>` : ""}

<!-- ÖNERİLER -->
${(data.recommendations?.length ?? 0) > 0 ? `
  <h3>Öneri Eylemler</h3>
  <div class="recommendation-list">
    <ol>
      ${(data.recommendations ?? []).map((r) => `<li>${esc(r)}</li>`).join("")}
    </ol>
  </div>` : ""}

${data.analysisSummary ? `
  <h3>Analiz Özeti</h3>
  <div style="background:#f9fafb;border:1px solid #d1d5db;border-left:4px solid #7c2d12;padding:10px 14px;font-size:11px;line-height:1.6;">
    ${esc(data.analysisSummary)}
  </div>` : ""}

${renderReportFooter(meta, qrDataUrl)}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function exportMortPdf(data: MortPdfData, metaInput: MortMetaInput): Promise<void> {
  if (typeof window === "undefined") return;
  const meta = normalizeMortMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildMortPdfHtml(data, meta, qrDataUrl);
  const printWindow = window.open("", "_blank", "width=1100,height=1400");
  if (!printWindow) { alert("Yazıcı penceresi açılamadı."); return; }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 600);
}

export async function exportMortPdfBlob(data: MortPdfData, metaInput: MortMetaInput): Promise<Blob> {
  if (typeof window === "undefined") throw new Error("client-side only");
  const meta = normalizeMortMeta(metaInput);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildMortPdfHtml(data, meta, qrDataUrl);
  const { generatePdfBlob } = await import("@/lib/pdf-generator");
  return generatePdfBlob(html, { title: meta.reportTitle, scale: 2 });
}

/** Diğer panellerde de kullanılabilir export'lar */
export { renderEtbTraceSvg, renderMortTreeSvg };
