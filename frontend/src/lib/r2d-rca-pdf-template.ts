import { R2D_DIMENSIONS, DIMENSION_META, computeR2DRCA, SOURCE_COLORS, TAU_PRIMARY, TAU_SECONDARY, type RCAResult } from "@/lib/r2d-rca-engine";
import type { R2dRcaData } from "@/lib/analysis/types";
import {
  type PdfReportMeta,
  SHARED_PDF_CSS,
  renderReportHeader,
  renderReportFooter,
  generateQrDataUrl,
  escHtml as esc,
} from "@/lib/pdf-shared-template";

function num(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/* ------------------------------------------------------------------ */
/*  SVG Grafikler — print-friendly, paket gerektirmez                  */
/* ------------------------------------------------------------------ */

function deltaColor(d: number): string {
  if (d >= TAU_PRIMARY) return "#dc2626";    // override (kırmızı)
  if (d >= 0.20) return "#ea580c";           // major (turuncu)
  if (d >= TAU_SECONDARY) return "#ca8a04";  // secondary (sarı)
  if (d > 0) return "#9ca3af";               // minor (gri)
  return "#e5e7eb";                          // none (açık gri)
}

/** Yatay Δ̂ bar chart — 9 boyut için sapma şiddeti */
function renderDeltaBarSvg(deltaHat: number[]): string {
  // W ve padL artırıldı ki boyut isimleri tam sığsın (önceden "Tehlike Yo" gibi kesiliyordu)
  const W = 440, H = 240, padL = 150, padR = 42, padT = 10, padB = 18;
  const innerW = W - padL - padR;
  const rowH = (H - padT - padB) / 9;
  const maxScale = Math.max(0.5, ...deltaHat);
  const xMax = Math.min(1, Math.ceil(maxScale * 10) / 10);

  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1.0].filter((t) => t <= xMax);

  const gridlines = ticks
    .map((t) => {
      const x = padL + (t / xMax) * innerW;
      return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="#e5e7eb" stroke-width="0.5" />
              <text x="${x}" y="${H - 4}" font-size="8" fill="#6b7280" text-anchor="middle">${t.toFixed(1)}</text>`;
    })
    .join("");

  const bars = deltaHat
    .map((d, i) => {
      const code = R2D_DIMENSIONS[i];
      const y = padT + i * rowH + 2;
      const barH = rowH - 4;
      const w = d > 0 ? Math.max(2, (d / xMax) * innerW) : 0;
      const color = deltaColor(d);
      // Tam isim (kesme yok), daha küçük font
      const fullName = DIMENSION_META[code].nameTR;
      return `
        <text x="${padL - 6}" y="${y + barH / 2 + 3}" font-size="8" fill="#111" text-anchor="end" font-weight="700">${code}</text>
        <text x="${padL - 22}" y="${y + barH / 2 + 3}" font-size="7.5" fill="#4b5563" text-anchor="end">${esc(fullName)}</text>
        <rect x="${padL}" y="${y}" width="${innerW}" height="${barH}" fill="#f9fafb" stroke="#e5e7eb" stroke-width="0.5" rx="1" />
        ${w > 0 ? `<rect x="${padL}" y="${y}" width="${w}" height="${barH}" fill="${color}" rx="1" />` : ""}
        ${d > 0 ? `<text x="${padL + w + 4}" y="${y + barH / 2 + 3}" font-size="7.5" fill="${color}" font-weight="700">${num(d, 2)}</text>` : ""}
      `;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${gridlines}
    ${bars}
  </svg>`;
}

/** Yarım daire gauge — R₂D-RCA skoru */
function renderGaugeSvg(score: number): string {
  // H artırıldı (140 → 180) ki altındaki skor yazısı SVG içinde tam görünsün
  const W = 240, H = 180;
  const cx = W / 2, cy = H - 48, r = 82, thickness = 16;
  const PI = Math.PI;
  const zones = [
    { from: 0.0, to: 0.2, color: "#16a34a" },
    { from: 0.2, to: 0.4, color: "#ca8a04" },
    { from: 0.4, to: 0.6, color: "#ea580c" },
    { from: 0.6, to: 1.0, color: "#dc2626" },
  ];

  const arcPath = (from: number, to: number) => {
    const a0 = PI + PI * from;
    const a1 = PI + PI * to;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const largeArc = to - from > 0.5 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  const zoneArcs = zones
    .map((z) => `<path d="${arcPath(z.from, z.to)}" stroke="${z.color}" stroke-width="${thickness}" fill="none" stroke-linecap="round" />`)
    .join("");

  const tickMarks = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
    .map((t) => {
      const a = PI + PI * t;
      const x1 = cx + (r + thickness / 2 + 2) * Math.cos(a);
      const y1 = cy + (r + thickness / 2 + 2) * Math.sin(a);
      const x2 = cx + (r - thickness / 2 - 2) * Math.cos(a);
      const y2 = cy + (r - thickness / 2 - 2) * Math.sin(a);
      const xt = cx + (r + thickness / 2 + 10) * Math.cos(a);
      const yt = cy + (r + thickness / 2 + 10) * Math.sin(a) + 2;
      return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#6b7280" stroke-width="1" />
              <text x="${xt.toFixed(2)}" y="${yt.toFixed(2)}" font-size="6" fill="#6b7280" text-anchor="middle">${t.toFixed(1)}</text>`;
    })
    .join("");

  const needleAngle = PI + PI * Math.max(0, Math.min(1, score));
  const nx = cx + (r - 8) * Math.cos(needleAngle);
  const ny = cy + (r - 8) * Math.sin(needleAngle);

  const scoreColor = score >= 0.6 ? "#dc2626" : score >= 0.4 ? "#ea580c" : score >= 0.2 ? "#ca8a04" : "#16a34a";

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${zoneArcs}
    ${tickMarks}
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="#1f2937" stroke-width="2.5" stroke-linecap="round" />
    <circle cx="${cx}" cy="${cy}" r="6" fill="#1f2937" />
    <circle cx="${cx}" cy="${cy}" r="3" fill="#fff" />
    <text x="${cx}" y="${cy + 30}" font-size="22" fill="${scoreColor}" text-anchor="middle" font-weight="700" font-family="monospace">${num(score)}</text>
    <text x="${cx}" y="${cy + 42}" font-size="8" fill="#6b7280" text-anchor="middle" letter-spacing="0.5">R₂D-RCA</text>
  </svg>`;
}

/** 9-eksenli mini radar — t₀ vs t₁ profili */
function renderRadarSvg(t0: number[], t1: number[]): string {
  const W = 240, H = 220;
  const cx = W / 2, cy = H / 2 + 4, r = 78;
  const N = 9;
  const PI = Math.PI;

  const point = (val: number, i: number) => {
    const a = -PI / 2 + (2 * PI * i) / N;
    const v = Math.max(0, Math.min(1, val));
    return [cx + r * v * Math.cos(a), cy + r * v * Math.sin(a)];
  };

  // Background grid: 4 levels
  const gridRings = [0.25, 0.5, 0.75, 1.0]
    .map((level) => {
      const pts = Array.from({ length: N }, (_, i) => {
        const a = -PI / 2 + (2 * PI * i) / N;
        return `${(cx + r * level * Math.cos(a)).toFixed(2)},${(cy + r * level * Math.sin(a)).toFixed(2)}`;
      }).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="#e5e7eb" stroke-width="0.5" />`;
    })
    .join("");

  const axes = Array.from({ length: N }, (_, i) => {
    const a = -PI / 2 + (2 * PI * i) / N;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    const lx = cx + (r + 10) * Math.cos(a), ly = cy + (r + 10) * Math.sin(a) + 3;
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#e5e7eb" stroke-width="0.5" />
            <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="7" fill="#6b7280" text-anchor="middle" font-weight="600">${R2D_DIMENSIONS[i]}</text>`;
  }).join("");

  const polyT0 = t0.map((v, i) => point(v, i).map((n) => n.toFixed(2)).join(",")).join(" ");
  const polyT1 = t1.map((v, i) => point(v, i).map((n) => n.toFixed(2)).join(",")).join(" ");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${gridRings}
    ${axes}
    <polygon points="${polyT0}" fill="rgba(30,39,97,0.12)" stroke="#1E2761" stroke-width="1.5" />
    <polygon points="${polyT1}" fill="rgba(216,90,48,0.12)" stroke="#D85A30" stroke-width="1.5" stroke-dasharray="4 2" />
  </svg>`;
}

/** Donut chart — priority katkı dağılımı (sadece bozulan boyutlar) */
function renderDonutSvg(result: RCAResult): string {
  const W = 220, H = 220;
  const cx = W / 2, cy = H / 2, rOuter = 78, rInner = 44;

  const items = result.priorityRanking;
  const total = items.reduce((a, p) => a + p.priority, 0);

  if (total <= 0 || items.length === 0) {
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
      <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="#e5e7eb" stroke-width="${rOuter - rInner}" />
      <text x="${cx}" y="${cy + 4}" font-size="9" fill="#6b7280" text-anchor="middle">Bozulan boyut yok</text>
    </svg>`;
  }

  let acc = 0;
  const PI = Math.PI;
  const slices = items
    .map((item) => {
      const frac = item.priority / total;
      const a0 = -PI / 2 + 2 * PI * acc;
      const a1 = -PI / 2 + 2 * PI * (acc + frac);
      acc += frac;

      const xo0 = cx + rOuter * Math.cos(a0), yo0 = cy + rOuter * Math.sin(a0);
      const xo1 = cx + rOuter * Math.cos(a1), yo1 = cy + rOuter * Math.sin(a1);
      const xi0 = cx + rInner * Math.cos(a0), yi0 = cy + rInner * Math.sin(a0);
      const xi1 = cx + rInner * Math.cos(a1), yi1 = cy + rInner * Math.sin(a1);
      const largeArc = frac > 0.5 ? 1 : 0;

      const path = `M ${xo0.toFixed(2)} ${yo0.toFixed(2)}
        A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${xo1.toFixed(2)} ${yo1.toFixed(2)}
        L ${xi1.toFixed(2)} ${yi1.toFixed(2)}
        A ${rInner} ${rInner} 0 ${largeArc} 0 ${xi0.toFixed(2)} ${yi0.toFixed(2)}
        Z`;

      // Etiket: dilim ortasının dışında
      const aMid = (a0 + a1) / 2;
      const lx = cx + (rOuter + 8) * Math.cos(aMid);
      const ly = cy + (rOuter + 8) * Math.sin(aMid) + 3;
      const showLabel = frac >= 0.04;

      return `<path d="${path}" fill="${deltaColor(item.deltaHat)}" stroke="#fff" stroke-width="1" />
              ${showLabel ? `<text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="7" fill="#111" text-anchor="middle" font-weight="600">${item.code}</text>` : ""}`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${slices}
    <text x="${cx}" y="${cy - 4}" font-size="8" fill="#6b7280" text-anchor="middle">Toplam</text>
    <text x="${cx}" y="${cy + 10}" font-size="14" fill="#111" text-anchor="middle" font-weight="700" font-family="monospace">${num(total, 3)}</text>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  Heatmap SVG — 9 boyut × 3 sütun (t0, t1, Δ̂) ısı haritası          */
/* ------------------------------------------------------------------ */

function heatColor(v: number): string {
  // 0-1 arası değer → yeşilden kırmızıya gradient
  if (v <= 0.05) return "#f0fdf4";
  if (v <= 0.2)  return "#d1fae5";
  if (v <= 0.35) return "#fef3c7";
  if (v <= 0.5)  return "#fed7aa";
  if (v <= 0.7)  return "#fca5a5";
  return "#dc2626";
}

function renderHeatmapSvg(t0: number[], t1: number[], deltaHat: number[]): string {
  const W = 420, H = 320;
  const colW = 80, rowH = 28, labelW = 130;
  const startX = labelW + 10, startY = 30;

  const headers = ["t₀", "t₁", "Δ̂"];
  const headerRow = headers
    .map((h, i) => `<text x="${startX + i * colW + colW / 2}" y="20" font-size="10" font-weight="700" fill="#1f2937" text-anchor="middle">${h}</text>`)
    .join("");

  const rows = R2D_DIMENSIONS.map((code, i) => {
    const meta = DIMENSION_META[code];
    const y = startY + i * rowH;
    const cells = [t0[i], t1[i], deltaHat[i]].map((val, j) => {
      const bg = heatColor(val);
      const textColor = val > 0.4 ? "#fff" : "#111";
      const x = startX + j * colW;
      return `
        <rect x="${x}" y="${y}" width="${colW - 2}" height="${rowH - 2}" rx="2" fill="${bg}" stroke="#e5e7eb" stroke-width="0.5" />
        <text x="${x + colW / 2}" y="${y + rowH / 2 + 3}" font-size="9" font-weight="700" fill="${textColor}" text-anchor="middle" font-family="monospace">${num(val, 2)}</text>
      `;
    }).join("");
    return `
      <text x="${labelW - 4}" y="${y + rowH / 2 + 3}" font-size="8" font-weight="600" fill="#374151" text-anchor="end">${code} ${esc(meta.nameTR.slice(0, 14))}</text>
      ${cells}
    `;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${headerRow}
    ${rows}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  Waterfall SVG — priority birikim grafiği                           */
/* ------------------------------------------------------------------ */

function renderWaterfallSvg(result: RCAResult): string {
  const W = 420, H = 260;
  const items = result.priorityRanking;

  if (items.length === 0) {
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
      <text x="${W / 2}" y="${H / 2}" font-size="10" fill="#6b7280" text-anchor="middle">Bozulan boyut yok</text>
    </svg>`;
  }

  const padL = 40, padR = 20, padT = 20, padB = 50;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = items.length;
  const totalScore = result.rRcaScore;
  const barW = Math.min(40, innerW / (n + 2));
  const gap = (innerW - (n + 1) * barW) / n;

  // Y axis: 0 → totalScore * 1.1 için
  const yMax = Math.max(totalScore * 1.15, 0.1);
  const yScale = innerH / yMax;

  let cumulative = 0;
  const bars = items.map((item, i) => {
    const x = padL + i * (barW + gap);
    const prevY = padT + innerH - cumulative * yScale;
    cumulative += item.priority;
    const barH = item.priority * yScale;
    const yTop = prevY - barH;
    const color = item.deltaHat >= 0.4 ? "#dc2626" : item.deltaHat >= 0.15 ? "#ea580c" : "#ca8a04";
    return `
      <rect x="${x}" y="${yTop.toFixed(1)}" width="${barW}" height="${Math.max(1, barH).toFixed(1)}" fill="${color}" stroke="#fff" stroke-width="1" />
      <text x="${x + barW / 2}" y="${yTop - 4}" font-size="7" font-weight="700" fill="#111" text-anchor="middle">${num(item.priority, 3)}</text>
      <text x="${x + barW / 2}" y="${padT + innerH + 12}" font-size="8" font-weight="700" fill="#1f2937" text-anchor="middle">${item.code}</text>
      ${i < n - 1 ? `<line x1="${x + barW}" y1="${yTop.toFixed(1)}" x2="${x + barW + gap}" y2="${yTop.toFixed(1)}" stroke="#9ca3af" stroke-width="0.8" stroke-dasharray="2 2" />` : ""}
    `;
  }).join("");

  // Toplam bar (en sağda)
  const totalX = padL + n * (barW + gap);
  const totalBarH = totalScore * yScale;
  const totalBars = `
    <rect x="${totalX}" y="${(padT + innerH - totalBarH).toFixed(1)}" width="${barW}" height="${Math.max(1, totalBarH).toFixed(1)}" fill="#1E2761" stroke="#fff" stroke-width="1" />
    <text x="${totalX + barW / 2}" y="${(padT + innerH - totalBarH - 4).toFixed(1)}" font-size="8" font-weight="700" fill="#1E2761" text-anchor="middle">${num(totalScore)}</text>
    <text x="${totalX + barW / 2}" y="${padT + innerH + 12}" font-size="8" font-weight="700" fill="#1E2761" text-anchor="middle">Σ</text>
  `;

  // Y axis
  const axisY = `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="#6b7280" stroke-width="1" />
                 <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="#6b7280" stroke-width="1" />`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${axisY}
    ${bars}
    ${totalBars}
    <text x="${W / 2}" y="${H - 5}" font-size="8" fill="#6b7280" text-anchor="middle" font-style="italic">Priority birikim: C₁→Cₙ → Σ (toplam R_RCA)</text>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  Root Cause Chain SVG — kategorize bar list                          */
/* ------------------------------------------------------------------ */

function renderRootCauseChainSvg(result: RCAResult): string {
  const W = 520, H = 340;
  const categorized = result.categorized.filter((c) => c.deltaHat > 0).slice(0, 9);
  if (categorized.length === 0) {
    return `<svg viewBox="0 0 ${W} 60" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
      <text x="${W / 2}" y="35" font-size="10" fill="#6b7280" text-anchor="middle">Bozulan boyut yok — tüm Δ̂ = 0</text>
    </svg>`;
  }

  const rowH = 32;
  const maxW = W - 220;
  const maxDelta = Math.max(...categorized.map((c) => c.deltaHat), 0.1);

  const rows = categorized.map((c, i) => {
    const y = 20 + i * rowH;
    const catColor = c.category === "override" ? "#dc2626" : c.category === "major" ? "#ea580c" : "#ca8a04";
    const barW = (c.deltaHat / maxDelta) * maxW;
    return `
      <text x="18" y="${y + rowH / 2 + 3}" font-size="8" font-weight="700" fill="${catColor}" text-anchor="start">#${c.rank ?? "-"}</text>
      <text x="42" y="${y + rowH / 2 - 1}" font-size="9" font-weight="700" fill="#111" text-anchor="start">${c.code}</text>
      <text x="42" y="${y + rowH / 2 + 10}" font-size="7" fill="#6b7280" text-anchor="start">${esc(c.nameTR.slice(0, 22))}</text>
      <rect x="180" y="${y + 6}" width="${maxW}" height="14" rx="2" fill="#f3f4f6" />
      <rect x="180" y="${y + 6}" width="${barW.toFixed(1)}" height="14" rx="2" fill="${catColor}" />
      <text x="${180 + barW + 6}" y="${y + 17}" font-size="8" font-weight="700" fill="${catColor}" text-anchor="start">${num(c.deltaHat, 2)}</text>
    `;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${Math.max(H, categorized.length * rowH + 40)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${rows}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  Polar Area SVG — priority dağılımı alternatif görünüm              */
/* ------------------------------------------------------------------ */

function renderPolarSvg(result: RCAResult): string {
  const W = 220, H = 220;
  const cx = W / 2, cy = H / 2;
  const rMax = 82;

  const items = result.priorityRanking;
  if (items.length === 0) {
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
      <circle cx="${cx}" cy="${cy}" r="${rMax}" fill="none" stroke="#e5e7eb" stroke-width="1" />
      <text x="${cx}" y="${cy + 4}" font-size="9" fill="#6b7280" text-anchor="middle">Bozulan boyut yok</text>
    </svg>`;
  }

  const PI = Math.PI;
  const anglePerSlice = (2 * PI) / items.length;
  const maxDelta = Math.max(...items.map((i) => i.deltaHat), 0.1);

  // Grid halkalar
  const gridRings = [0.25, 0.5, 0.75, 1.0]
    .map((level) => `<circle cx="${cx}" cy="${cy}" r="${rMax * level}" fill="none" stroke="#e5e7eb" stroke-width="0.5" />`)
    .join("");

  const slices = items.map((item, i) => {
    const a0 = -PI / 2 + i * anglePerSlice;
    const a1 = a0 + anglePerSlice;
    const r = rMax * (item.deltaHat / maxDelta);
    const largeArc = anglePerSlice > PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const path = `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
    const aMid = (a0 + a1) / 2;
    const lx = cx + (rMax + 10) * Math.cos(aMid);
    const ly = cy + (rMax + 10) * Math.sin(aMid) + 3;
    return `
      <path d="${path}" fill="${deltaColor(item.deltaHat)}" opacity="0.75" stroke="#fff" stroke-width="1" />
      <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="7" font-weight="700" fill="#111" text-anchor="middle">${item.code}</text>
    `;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${gridRings}
    ${slices}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  Delta Radar SVG — 9 eksenli Δ̂ profili                              */
/* ------------------------------------------------------------------ */

function renderDeltaRadarSvg(deltaHat: number[]): string {
  const W = 220, H = 220;
  const cx = W / 2, cy = H / 2 + 4, r = 78;
  const N = 9;
  const PI = Math.PI;

  const maxDelta = Math.max(0.5, ...deltaHat);

  const point = (val: number, i: number) => {
    const a = -PI / 2 + (2 * PI * i) / N;
    const v = Math.max(0, Math.min(1, val / maxDelta));
    return [cx + r * v * Math.cos(a), cy + r * v * Math.sin(a)];
  };

  // Grid rings
  const gridRings = [0.25, 0.5, 0.75, 1.0]
    .map((level) => {
      const pts = Array.from({ length: N }, (_, i) => {
        const a = -PI / 2 + (2 * PI * i) / N;
        return `${(cx + r * level * Math.cos(a)).toFixed(2)},${(cy + r * level * Math.sin(a)).toFixed(2)}`;
      }).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="#e5e7eb" stroke-width="0.5" />`;
    })
    .join("");

  const axes = Array.from({ length: N }, (_, i) => {
    const a = -PI / 2 + (2 * PI * i) / N;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    const lx = cx + (r + 10) * Math.cos(a), ly = cy + (r + 10) * Math.sin(a) + 3;
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#e5e7eb" stroke-width="0.5" />
            <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" font-size="7" fill="#6b7280" text-anchor="middle" font-weight="600">${R2D_DIMENSIONS[i]}</text>`;
  }).join("");

  const poly = deltaHat
    .map((v, i) => point(v, i).map((n) => n.toFixed(2)).join(","))
    .join(" ");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">
    ${gridRings}
    ${axes}
    <polygon points="${poly}" fill="rgba(216,90,48,0.25)" stroke="#D85A30" stroke-width="1.5" />
    ${deltaHat.map((v, i) => {
      const [x, y] = point(v, i);
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.5" fill="#D85A30" />`;
    }).join("")}
  </svg>`;
}

/* ------------------------------------------------------------------ */
/*  Meta normalizer — string title veya tam meta'yı normalize eder      */
/* ------------------------------------------------------------------ */

type R2dRcaMetaInput = string | (Omit<PdfReportMeta, "reportTitle"> & Partial<Pick<PdfReportMeta, "reportTitle">>);

function normalizeR2dRcaMeta(metaOrTitle: R2dRcaMetaInput): PdfReportMeta {
  if (typeof metaOrTitle === "string") {
    return {
      reportTitle: "R₂D-RCA (C1-C9) Analiz Raporu",
      reportSubtitle: "9 boyutlu kompozit risk metriği · delta-tabanlı kök neden analizi",
      incidentTitle: metaOrTitle,
    };
  }
  return {
    reportTitle: metaOrTitle.reportTitle ?? "R₂D-RCA (C1-C9) Analiz Raporu",
    reportSubtitle: metaOrTitle.reportSubtitle ?? "9 boyutlu kompozit risk metriği · delta-tabanlı kök neden analizi",
    ...metaOrTitle,
  };
}

/* ------------------------------------------------------------------ */
/*  HTML builder — print/blob için ortak                               */
/* ------------------------------------------------------------------ */

/**
 * Tam HTML belgesi (DOCTYPE+html+body) string olarak döndürür.
 * Hem `exportR2dRcaPdf` (yazdırma) hem `exportR2dRcaPdfBlob` (paylaşım) bu helper'ı kullanır.
 */
export function buildR2dRcaPdfHtml(
  data: R2dRcaData,
  meta: PdfReportMeta,
  qrDataUrl: string,
): string {
  const result = computeR2DRCA(data.t0, data.t1);

  const calcModeLabel = result.calculationMode === "override"
    ? "Override Modu (max Δ̂ ≥ 0.40)"
    : "Base Score Modu (ağırlıklı toplam)";
  const modeBadgeColor = result.calculationMode === "override" ? "#dc2626" : "#d4a017";

  // 9 boyut tablosu
  const dimensionRows = R2D_DIMENSIONS.map((code, i) => {
    const meta = DIMENSION_META[code];
    const t0v = data.t0[i];
    const t1v = data.t1[i];
    const d = result.deltaHat[i];
    const priority = d * meta.weight;
    const isPrimary = result.primaryRootCauseIndices.includes(i);
    const deltaColor = d >= 0.40 ? "#dc2626" : d >= 0.15 ? "#ea580c" : d > 0 ? "#ca8a04" : "#6b7280";
    const rowBg = isPrimary ? "background:#fef3c7;" : "";
    const srcColor = SOURCE_COLORS[meta.sourceType];
    return `
      <tr style="${rowBg}">
        <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;${isPrimary ? "font-weight:700;" : ""}">
          <span style="display:inline-block;font-family:monospace;font-weight:700;margin-right:4px;">${code}</span>
          ${esc(meta.nameTR)}
          <span style="display:inline-block;margin-left:4px;padding:1px 5px;font-size:8px;border-radius:3px;background:${srcColor.bg};color:${srcColor.fg};">${esc(meta.source)}</span>
          ${isPrimary ? '<span style="color:#d4a017;margin-left:4px;">★</span>' : ""}
        </td>
        <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;">${num(t0v)}</td>
        <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;">${num(t1v)}</td>
        <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;color:${deltaColor};font-weight:600;">${num(d)}</td>
        <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;color:#6b7280;">${num(meta.weight, 3)}</td>
        <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;font-weight:600;">${num(priority, 4)}</td>
      </tr>
    `;
  }).join("");

  // Öncelik sıralaması
  const rankingRows = result.priorityRanking
    .map((item) => {
      const meta = DIMENSION_META[item.code];
      const isPrimary = result.primaryRootCauseIndices.includes(item.index);
      return `
        <tr ${isPrimary ? 'style="background:#fef3c7;"' : ""}>
          <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;font-weight:700;">${item.rank}</td>
          <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;">
            <span style="font-family:monospace;font-weight:700;">${item.code}</span> ${esc(meta.nameTR)}
          </td>
          <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;">${num(item.deltaHat)}</td>
          <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;">${num(item.weight, 3)}</td>
          <td style="padding:6px 8px;border:1px solid #9ca3af;font-size:10px;text-align:center;font-weight:600;color:#d4a017;">${num(item.priority, 4)}</td>
        </tr>
      `;
    })
    .join("");

  // Birincil kök neden rozetleri
  const primaryBadges = result.primaryRootCauseIndices
    .map((i) => {
      const code = R2D_DIMENSIONS[i];
      const meta = DIMENSION_META[code];
      return `<span style="display:inline-block;margin:2px 4px 2px 0;padding:3px 10px;background:#fef3c7;color:#92400e;border:1px solid #fbbf24;border-radius:12px;font-size:10px;font-weight:600;">★ ${code} ${esc(meta.nameTR)}</span>`;
    })
    .join("");

  // Stabil boyutlar
  const stabilList = result.categorized
    .filter((c) => c.category === "none")
    .map((c) => `${c.code} ${c.nameTR}`)
    .join(", ") || "Yok";

  return `<!DOCTYPE html>
    <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>${esc(meta.reportTitle)}</title>
        <style>
          ${SHARED_PDF_CSS}
          /* R2D-RCA spesifik ek stiller */
          h3 {
            margin: 14px 0 8px 0; padding: 5px 10px;
            background: #d4a017; color: #fff;
            font-size: 11px; font-weight: 700;
            letter-spacing: 0.5px; border-radius: 3px;
            page-break-after: avoid;
          }
          .score-box {
            display: inline-block; padding: 8px 16px;
            background: ${modeBadgeColor}; color: #fff;
            font-size: 22px; font-weight: 700;
            border-radius: 6px; font-family: monospace;
          }
          .mode-badge {
            display: inline-block; margin-left: 10px;
            padding: 4px 10px; background: ${modeBadgeColor}20;
            color: ${modeBadgeColor}; border: 1px solid ${modeBadgeColor};
            border-radius: 12px; font-size: 9px; font-weight: 600;
            letter-spacing: 0.3px; text-transform: uppercase;
          }
          .narrative {
            background: #f9fafb; border: 1px solid #d1d5db;
            border-left: 4px solid #d4a017;
            padding: 10px 14px; margin-top: 8px;
            font-size: 11px; line-height: 1.6;
          }
          .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
          .stat-card { padding: 10px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 4px; }
          .stat-card-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
          .stat-card-value { font-size: 14px; font-weight: 700; color: #111; margin-top: 4px; }
          .legend { font-size: 9px; color: #6b7280; margin-top: 6px; font-style: italic; }

          .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 14px;
            page-break-inside: avoid;
          }
          .chart-card {
            padding: 8px 10px 4px;
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            page-break-inside: avoid;
          }
          .chart-card-title {
            font-size: 9px; font-weight: 700; color: #111;
            text-transform: uppercase; letter-spacing: 0.4px;
            margin: 0 0 4px 0;
          }
          .chart-card-sub { font-size: 8px; color: #6b7280; margin-bottom: 6px; }
          .chart-legend {
            display: flex; gap: 10px; justify-content: center;
            font-size: 8px; color: #4b5563; margin-top: 4px;
          }
          .chart-legend span { display: inline-flex; align-items: center; gap: 4px; }
          .chart-legend i {
            display: inline-block; width: 10px; height: 6px; border-radius: 1px;
          }
        </style>
      </head>
      <body>
        ${renderReportHeader(meta)}

        <div style="margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">R₂D-RCA Skoru</div>
              <div class="score-box">${num(result.rRcaScore)}</div>
            </div>
            <div class="mode-badge">${calcModeLabel}</div>
            ${result.dualReportingRequired ? '<span class="mode-badge" style="background:#dc262620;color:#dc2626;border-color:#dc2626;">⚠ Dual Reporting Gerekli</span>' : ""}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-label">En Büyük Δ̂</div>
            <div class="stat-card-value">C${result.maxDeltaHatIndex + 1} ${esc(DIMENSION_META[R2D_DIMENSIONS[result.maxDeltaHatIndex]].nameTR)} · ${num(result.maxDeltaHat)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">Override</div>
            <div class="stat-card-value">${result.overrideTriggered ? "Tetiklendi" : "Tetiklenmedi"}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-label">Bozulan / Stabil</div>
            <div class="stat-card-value">${result.bozulanCount} / ${result.stabilCount}</div>
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Birincil Kök Neden(ler)</div>
          <div>${primaryBadges || '<span style="font-size:10px;color:#6b7280;">Belirlenmedi</span>'}</div>
        </div>

        <h3>Görsel Özet</h3>
        ${
          result.bozulanCount === 0
            ? `<div style="margin-bottom:10px;padding:10px 14px;background:#fef3c7;border-left:4px solid #d4a017;border-radius:4px;font-size:10px;line-height:1.5;color:#7c2d12;">
                <strong>⚠ Henüz analiz verisi yok.</strong> Tüm boyutlarda Δ̂ = 0 — olay öncesi ve olay anı skorları aynı.
                Anlamlı bir rapor için önce <strong>"AI ile Analiz Yap"</strong> butonuna basarak skorları üretin veya
                slider'lar ile manuel ayarlayın, ardından PDF'i tekrar oluşturun.
              </div>`
            : ""
        }
        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-card-title">R₂D-RCA Risk Şiddeti</div>
            <div class="chart-card-sub">Yarım daire gauge — 0 (yeşil) → 1 (kırmızı)</div>
            ${renderGaugeSvg(result.rRcaScore)}
          </div>
          <div class="chart-card">
            <div class="chart-card-title">Bozulma Şiddeti (Δ̂)</div>
            <div class="chart-card-sub">9 boyut için sapma çubukları, sıralı C1→C9</div>
            ${renderDeltaBarSvg(result.deltaHat)}
          </div>
          <div class="chart-card">
            <div class="chart-card-title">Risk Profili (t₀ vs t₁)</div>
            <div class="chart-card-sub">9-eksenli radar — olay öncesi vs olay anı</div>
            ${renderRadarSvg(data.t0, data.t1)}
            <div class="chart-legend">
              <span><i style="background:#1E2761;"></i>t₀ (öncesi)</span>
              <span><i style="background:#D85A30;"></i>t₁ (olay anı)</span>
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-card-title">Priority Katkı Dağılımı</div>
            <div class="chart-card-sub">P(C_i) = w_i · Δ̂_i — sadece bozulan boyutlar</div>
            ${renderDonutSvg(result)}
            <div class="chart-legend">
              <span><i style="background:#dc2626;"></i>Override</span>
              <span><i style="background:#ea580c;"></i>Major</span>
              <span><i style="background:#ca8a04;"></i>Sec.</span>
              <span><i style="background:#9ca3af;"></i>Minor</span>
            </div>
          </div>
        </div>

        <!-- EK SVG GRAFİKLER — Heatmap + Waterfall + Root Cause Chain + Polar + DeltaRadar -->
        <h3>Boyut Detayı · Isı Haritası ve Priority Birikimi</h3>
        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-card-title">9 Boyut Isı Haritası</div>
            <div class="chart-card-sub">Her boyut için t₀ · t₁ · Δ̂ renkli skala (yeşil→kırmızı)</div>
            ${renderHeatmapSvg(data.t0, data.t1, result.deltaHat)}
          </div>
          <div class="chart-card">
            <div class="chart-card-title">Priority Birikim (Waterfall)</div>
            <div class="chart-card-sub">Sıralı priority katkıları birikimi + toplam skor</div>
            ${renderWaterfallSvg(result)}
          </div>
        </div>

        <h3>Priority Polar Dağılımı + Δ̂ Radar Profili</h3>
        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-card-title">Polar Area — Priority Dağılımı</div>
            <div class="chart-card-sub">Her boyutun priority'si eşit açı, yarıçap = Δ̂ büyüklüğü</div>
            ${renderPolarSvg(result)}
            <div class="chart-legend">
              <span><i style="background:#dc2626;"></i>Override</span>
              <span><i style="background:#ea580c;"></i>Major</span>
              <span><i style="background:#ca8a04;"></i>Sec.</span>
              <span><i style="background:#9ca3af;"></i>Minor</span>
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-card-title">Δ̂ Radar Profili (9 eksen)</div>
            <div class="chart-card-sub">Sadece sapma miktarları — hangi boyutlarda artış var</div>
            ${renderDeltaRadarSvg(result.deltaHat)}
          </div>
        </div>

        <h3>Kök Neden Zinciri (Kategorize + Öncelikli)</h3>
        <div class="chart-card" style="page-break-inside:avoid;">
          <div class="chart-card-sub" style="margin-bottom:6px;">Bozulan boyutlar öncelik sırasıyla — Override / Major / Sec. kategorileri</div>
          ${renderRootCauseChainSvg(result)}
        </div>

        <h3>9 Boyutlu Skor Karşılaştırması</h3>
        <table>
          <thead>
            <tr>
              <th>Boyut</th>
              <th class="c">t₀</th>
              <th class="c">t₁</th>
              <th class="c">Δ̂</th>
              <th class="c">Ağırlık</th>
              <th class="c">Öncelik</th>
            </tr>
          </thead>
          <tbody>${dimensionRows}</tbody>
        </table>
        <p class="legend">
          Δ̂_i = max(0, t₁ - t₀) · Öncelik P(C_i) = w_i · Δ̂_i · Skorlar [0,1] sürekli skala · Yüksek = yüksek risk
        </p>

        ${rankingRows ? `
          <h3>Öncelik Sıralaması</h3>
          <table>
            <thead>
              <tr>
                <th class="c" style="width:40px;">#</th>
                <th>Boyut</th>
                <th class="c">Δ̂</th>
                <th class="c">Ağırlık</th>
                <th class="c">Öncelik</th>
              </tr>
            </thead>
            <tbody>${rankingRows}</tbody>
          </table>
        ` : ""}

        <h3>Stabil Boyutlar (Δ̂ = 0)</h3>
        <div style="padding:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;font-size:10px;">
          ${esc(stabilList)}
        </div>

        ${data.narrative ? `
          <h3>AI Değerlendirmesi</h3>
          <div class="narrative">${esc(data.narrative)}</div>
        ` : ""}

        ${renderReportFooter(meta, qrDataUrl)}
      </body>
    </html>`;
}

/* ------------------------------------------------------------------ */
/*  Public API — Print (window.open + print)                           */
/* ------------------------------------------------------------------ */

/**
 * R₂D-RCA PDF'ini yazdırma penceresinde açar.
 * Kullanıcı tarayıcının Save as PDF dialog'undan kaydeder.
 *
 * @see exportR2dRcaPdfBlob — Blob döndüren async versiyon (paylaşım için)
 */
export async function exportR2dRcaPdf(
  data: R2dRcaData,
  metaOrTitle: R2dRcaMetaInput,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!Array.isArray(data.t0) || !Array.isArray(data.t1) || data.t0.length !== 9 || data.t1.length !== 9) {
    console.warn("exportR2dRcaPdf: invalid data", data);
    return;
  }

  const meta = normalizeR2dRcaMeta(metaOrTitle);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildR2dRcaPdfHtml(data, meta, qrDataUrl);

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

/**
 * R₂D-RCA PDF'ini Blob olarak üretir (paylaşım için).
 *
 * Kullanım:
 *   const blob = await exportR2dRcaPdfBlob(data, meta);
 *   const file = new File([blob], "r2d-rca-rapor.pdf", { type: "application/pdf" });
 *   await navigator.share({ files: [file] }); // mobile native share
 */
export async function exportR2dRcaPdfBlob(
  data: R2dRcaData,
  metaOrTitle: R2dRcaMetaInput,
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("exportR2dRcaPdfBlob: client-side only");
  }
  if (!Array.isArray(data.t0) || !Array.isArray(data.t1) || data.t0.length !== 9 || data.t1.length !== 9) {
    throw new Error("exportR2dRcaPdfBlob: invalid data (t0/t1 must be 9-element arrays)");
  }

  const meta = normalizeR2dRcaMeta(metaOrTitle);
  const qrDataUrl = await generateQrDataUrl(meta.shareUrl);
  const html = buildR2dRcaPdfHtml(data, meta, qrDataUrl);

  // Lazy import — bundle boyutunu artırmasın diye sadece çağrıldığında yüklenir
  const { generatePdfBlob } = await import("@/lib/pdf-generator");
  return generatePdfBlob(html, { title: meta.reportTitle, scale: 2 });
}
