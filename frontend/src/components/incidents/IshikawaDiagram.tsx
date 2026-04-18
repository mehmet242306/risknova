"use client";

/* ------------------------------------------------------------------ */
/*  Shared types & constants                                           */
/* ------------------------------------------------------------------ */

export type IshikawaData = {
  problemStatement: string;
  manCauses: string[];
  machineCauses: string[];
  methodCauses: string[];
  materialCauses: string[];
  environmentCauses: string[];
  measurementCauses: string[];
};

type CausesNormalized = { label: string; color: string; side: "top" | "bottom"; causes: string[] };

const W = 1380;
const MIN_H = 580;
const BRANCH_LEN_BASE = 170;
const BONE_LEN = 85;
const BRANCH_XS = [155, 475, 800];
const BOX_GAP = 6; // Kutular arası minimum dikey boşluk

const CATS: { field: keyof IshikawaData; label: string; color: string; side: "top" | "bottom" }[] = [
  { field: "manCauses",         label: "İnsan",          color: "#e05a5a", side: "top" },
  { field: "machineCauses",     label: "Makine/Ekipman", color: "#5a9ee0", side: "top" },
  { field: "methodCauses",      label: "Yöntem",         color: "#5ae0a0", side: "top" },
  { field: "materialCauses",    label: "Malzeme",        color: "#e0a05a", side: "bottom" },
  { field: "environmentCauses", label: "Çevre",          color: "#a05ae0", side: "bottom" },
  { field: "measurementCauses", label: "Ölçüm",          color: "#5ae0e0", side: "bottom" },
];

/* ------------------------------------------------------------------ */
/*  wrapText — satır kaydırma                                          */
/* ------------------------------------------------------------------ */

function wrapText(text: string, maxChars = 18): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + (cur ? " " : "") + w).length <= maxChars) {
      cur = cur ? cur + " " + w : w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

/* ------------------------------------------------------------------ */
/*  Box metrics — wrapText ile satır sayısını hesapla, box H döndür    */
/* ------------------------------------------------------------------ */

function measureBox(cause: string): { lines: string[]; boxH: number; boxW: number } {
  const lines = wrapText(cause, 18);
  const boxH = lines.length * 13 + 8;
  const maxLineLen = Math.max(...lines.map((l) => l.length));
  const boxW = maxLineLen * 6.2 + 16;
  return { lines, boxH, boxW };
}

/**
 * Her kategori için çakışma-farkındalığı olan dikey dağılım:
 * - Kutular arası minimum boşluk BOX_GAP garantilenir
 * - Toplam gerekli yükseklik branch uzunluğunu aşarsa branch uzar
 * Dönüş: her kutu için center-Y offseti (spine'dan itibaren, pozitif = branch yönünde)
 */
function computeBranchLayout(causes: string[]): { offsets: number[]; requiredLen: number; metrics: ReturnType<typeof measureBox>[] } {
  if (causes.length === 0) return { offsets: [], requiredLen: 0, metrics: [] };
  const metrics = causes.map(measureBox);
  const totalH = metrics.reduce((sum, m) => sum + m.boxH, 0) + BOX_GAP * (causes.length - 1);
  const startOffset = 28; // Branch başlangıcından itibaren ilk kutu merkezine minimum mesafe (kategori label için yer)
  const requiredLen = Math.max(BRANCH_LEN_BASE, startOffset + totalH + 20);

  // Kutu merkezlerini pozisyonla
  const offsets: number[] = [];
  let cursor = startOffset;
  metrics.forEach((m) => {
    offsets.push(cursor + m.boxH / 2);
    cursor += m.boxH + BOX_GAP;
  });
  return { offsets, requiredLen, metrics };
}

/* ------------------------------------------------------------------ */
/*  Branch renderer                                                    */
/* ------------------------------------------------------------------ */

function renderBranch(
  branchX: number,
  cat: CausesNormalized,
  spineY: number,
  branchLen: number,
  metrics: ReturnType<typeof measureBox>[],
  offsets: number[],
) {
  const dir = cat.side === "top" ? -1 : 1;
  const branchEndY = spineY + dir * branchLen;
  const { causes, color, label } = cat;

  // Label metrics (branch ucunda)
  const labelW = Math.max(label.length * 7.5 + 20, 70);
  const labelH = 22;
  const labelY = cat.side === "top" ? branchEndY - labelH - 6 : branchEndY + 6;

  return (
    <g key={`${cat.side}-${label}`}>
      {/* Vertical branch line */}
      <line x1={branchX} y1={spineY} x2={branchX} y2={branchEndY}
        stroke={color} strokeWidth={2.5} />

      {/* Category label box */}
      <rect x={branchX - labelW / 2} y={labelY} width={labelW} height={labelH}
        rx={4} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={0.8} strokeOpacity={0.4} />
      <text x={branchX} y={labelY + labelH / 2 + 4}
        textAnchor="middle" fill={color}
        fontSize={10} fontWeight={700} fontFamily="monospace" letterSpacing="0.06em">
        {label}
      </text>

      {/* Cause bones — collision-aware absolute offsets */}
      {causes.map((cause, ci) => {
        const m = metrics[ci];
        if (!m) return null;
        const offset = offsets[ci];
        const nodeY = spineY + dir * offset;
        const { lines, boxH, boxW } = m;

        return (
          <g key={ci}>
            <circle cx={branchX} cy={nodeY} r={3} fill={color} />
            <line x1={branchX} y1={nodeY} x2={branchX + BONE_LEN} y2={nodeY}
              stroke={color} strokeWidth={1.5} opacity={0.65} />
            <rect x={branchX + BONE_LEN + 3} y={nodeY - boxH / 2}
              width={boxW} height={boxH} rx={3}
              fill="#0b1018" stroke={color} strokeWidth={0.5} strokeOpacity={0.25} />
            {lines.map((line, li) => (
              <text key={li}
                x={branchX + BONE_LEN + 11}
                y={nodeY - boxH / 2 + 13 + li * 13}
                fill="#cdd2e8" fontSize={10} fontFamily="monospace">
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Head box (event title)                                             */
/* ------------------------------------------------------------------ */

function renderHead(text: string, spineY: number) {
  // Daha geniş wrap + max 5 satır, fazlası "…" ile kesilir
  const allLines = wrapText(text || "Problem", 22);
  const MAX_LINES = 5;
  const lines = allLines.length <= MAX_LINES
    ? allLines
    : [...allLines.slice(0, MAX_LINES - 1), allLines[MAX_LINES - 1].slice(0, 18) + "…"];
  const lineH = 15;
  const padY = 12;
  const headW = 200; // Genişletildi 158 → 200
  const headH = Math.max(84, lines.length * lineH + padY * 2);
  const headCX = 1187;
  const headX = headCX - headW / 2;
  const headY = spineY - headH / 2;

  return (
    <g>
      <rect x={headX} y={headY} width={headW} height={headH}
        rx={10} fill="#d4a017" />
      {lines.map((line, i) => (
        <text key={i}
          x={headCX}
          y={headY + padY + 12 + i * lineH}
          textAnchor="middle" fill="#0a0e1a"
          fontSize={12} fontWeight={700} fontFamily="monospace">
          {line}
        </text>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function IshikawaDiagram({ data, id }: { data: IshikawaData; id?: string }) {
  const topCats = CATS.filter((c) => c.side === "top");
  const bottomCats = CATS.filter((c) => c.side === "bottom");

  function resolve(cat: typeof CATS[0]): CausesNormalized {
    return { label: cat.label, color: cat.color, side: cat.side, causes: (data[cat.field] as string[] ?? []).filter(Boolean) };
  }

  const topResolved = topCats.map(resolve);
  const bottomResolved = bottomCats.map(resolve);
  const topLayouts = topResolved.map((c) => computeBranchLayout(c.causes));
  const bottomLayouts = bottomResolved.map((c) => computeBranchLayout(c.causes));

  // Her yönün en uzun branch'ini al → SVG yüksekliğini hesapla
  const maxTopLen = Math.max(BRANCH_LEN_BASE, ...topLayouts.map((l) => l.requiredLen));
  const maxBottomLen = Math.max(BRANCH_LEN_BASE, ...bottomLayouts.map((l) => l.requiredLen));
  const labelSpace = 40; // kategori etiketleri için ekstra alan (altta/üstte)
  const H = Math.max(MIN_H, maxTopLen + maxBottomLen + labelSpace * 2);
  const spineY = maxTopLen + labelSpace;

  return (
    <div id={id} className="w-full overflow-x-auto" style={{ background: "#0a0e1a", borderRadius: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{
          background: "linear-gradient(135deg,#d4a017,#f0c040)", color: "#0a0e1a",
          fontFamily: "monospace", fontSize: 10, fontWeight: 700,
          padding: "4px 10px", borderRadius: 4, letterSpacing: "1px",
        }}>
          RiskNova
        </span>
        <span style={{ fontSize: 13, color: "#7c8299", fontFamily: "monospace" }}>
          AI Destekli Ishikawa / Balik Kilcigi Analizi
        </span>
      </div>

      {/* SVG Diagram */}
      <div style={{ background: "#0d1220", border: "1px solid #1e2a45", borderRadius: 12, padding: 24, minHeight: 520 }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 800, display: "block" }}>
          {/* Defs */}
          <defs>
            <marker id="ishikawa-arrow" viewBox="0 0 12 12" refX="10" refY="6"
              markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <path d="M 0 0 L 12 6 L 0 12 z" fill="#d4a017" />
            </marker>
          </defs>

          {/* Solid background — export/print icin zorunlu */}
          <rect width={W} height={H} fill="#0d1220" />

          {/* Background grid */}
          {Array.from({ length: Math.floor(W / 60) + 1 }, (_, i) => (
            <line key={i} x1={i * 60} y1={0} x2={i * 60} y2={H}
              stroke="#12182e" strokeWidth={1} />
          ))}

          {/* Spine — horizontal gold line */}
          <line x1={50} y1={spineY} x2={1095} y2={spineY}
            stroke="#d4a017" strokeWidth={3.5} markerEnd="url(#ishikawa-arrow)" />

          {/* Head box */}
          {renderHead(data.problemStatement, spineY)}

          {/* Top branches */}
          {topResolved.map((cat, i) => renderBranch(BRANCH_XS[i], cat, spineY, maxTopLen, topLayouts[i].metrics, topLayouts[i].offsets))}

          {/* Bottom branches */}
          {bottomResolved.map((cat, i) => renderBranch(BRANCH_XS[i], cat, spineY, maxBottomLen, bottomLayouts[i].metrics, bottomLayouts[i].offsets))}
        </svg>
      </div>

      {/* AI warning footer */}
      <div style={{
        marginTop: 14, background: "#0a1020", border: "1px solid #1e2a45",
        borderRadius: 6, padding: "10px 16px", fontSize: 11, color: "#5a6480",
        display: "flex", gap: 8, alignItems: "center", fontFamily: "monospace",
      }}>
        <span style={{ color: "#d4a017" }}>&#x26A0;</span>
        <span>Bu analiz yapay zeka tarafindan olusturulmustur. Nihai karar yetkili ISG uzmaninin sorumluluğundadir.</span>
      </div>
    </div>
  );
}
