/**
 * R₂D-RCA Engine — C1-C9 composite risk dimensions
 *
 * 9 boyutlu R₂D risk metriğinin kök neden analizine uzantısı.
 * Bir olay olduğunda, olay öncesi (t₀) ve olay anı (t₁) skorlarının farkını
 * hesaplayarak hangi boyutun ne kadar bozulduğunu belirler.
 *
 * Pure functions — server ve client'ta çalışır.
 */

/* ------------------------------------------------------------------ */
/*  9 Boyut — C1-C9                                                    */
/* ------------------------------------------------------------------ */

export const R2D_DIMENSIONS = [
  "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9",
] as const;

export type R2DDimension = typeof R2D_DIMENSIONS[number];
export type R2DSourceType = "visual" | "sensor" | "scada" | "record";

export interface DimensionMetadata {
  code: R2DDimension;
  name: string;           // English
  nameTR: string;         // Turkish
  source: string;         // Multi-source display
  sourceType: R2DSourceType;
  weight: number;
}

export const DIMENSION_META: Record<R2DDimension, DimensionMetadata> = {
  C1: { code: "C1", name: "Hazard Intensity",       nameTR: "Tehlike Yoğunluğu",         source: "Görsel (YOLO)",     sourceType: "visual", weight: 0.120 },
  C2: { code: "C2", name: "PPE Non-Conformance",    nameTR: "KKD Uygunsuzluğu",          source: "Görsel + Kayıt",    sourceType: "visual", weight: 0.085 },
  C3: { code: "C3", name: "Behavioral Risk",        nameTR: "Davranış Riski",            source: "Görsel + Bölge",    sourceType: "visual", weight: 0.145 },
  C4: { code: "C4", name: "Environmental Stress",   nameTR: "Çevresel Stres",            source: "Sensör",            sourceType: "sensor", weight: 0.085 },
  C5: { code: "C5", name: "Chemical/Atmospheric",   nameTR: "Kimyasal/Atmosferik",       source: "Sensör + SCADA",    sourceType: "scada",  weight: 0.145 },
  C6: { code: "C6", name: "Access/Barrier Risk",    nameTR: "Erişim/Engel Riski",        source: "Görsel + Sensör",   sourceType: "sensor", weight: 0.075 },
  C7: { code: "C7", name: "Machine/Process Risk",   nameTR: "Makine/Proses Riski",       source: "Sensör + CMMS",     sourceType: "sensor", weight: 0.165 },
  C8: { code: "C8", name: "Vehicle/Traffic Risk",   nameTR: "Araç-Trafik Riski",         source: "Görsel + RTLS",     sourceType: "visual", weight: 0.105 },
  C9: { code: "C9", name: "Organizational Load",    nameTR: "Örgütsel Yük/Yorgunluk",    source: "Kayıt + Sensör",    sourceType: "record", weight: 0.075 },
};

/* ------------------------------------------------------------------ */
/*  Eşikler                                                            */
/* ------------------------------------------------------------------ */

export const TAU_PRIMARY = 0.40;    // Override mod tetikleme
export const TAU_SECONDARY = 0.15;  // Kök neden kümesi filtresi

/* ------------------------------------------------------------------ */
/*  Tipler                                                             */
/* ------------------------------------------------------------------ */

export type CategoryLevel = "override" | "major" | "minor" | "none";

export interface PriorityItem {
  index: number;             // 0..8
  code: R2DDimension;
  nameTR: string;
  deltaHat: number;
  weight: number;
  priority: number;          // w_i · Δ̂_i
  rank: number;              // 1-based
}

export interface CategorizedDimension extends DimensionMetadata {
  index: number;
  t0: number;
  t1: number;
  deltaHat: number;
  priority: number;
  category: CategoryLevel;
  rank: number | null;       // null → etkisiz boyutlar için
}

export interface RCAResult {
  deltaHat: number[];
  maxDeltaHat: number;
  maxDeltaHatIndex: number;
  maxWeightedIndex: number;
  overrideTriggered: boolean;
  calculationMode: "override" | "base_score";
  rRcaScore: number;
  priorityRanking: PriorityItem[];
  isStable: boolean;
  dualReportingRequired: boolean;
  bozulanCount: number;
  stabilCount: number;
  categorized: CategorizedDimension[];
  primaryRootCauseIndices: number[];
}

/* ------------------------------------------------------------------ */
/*  Hesaplama                                                          */
/* ------------------------------------------------------------------ */

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * R2D-RCA hesaplaması.
 *
 * @param t0 - Olay öncesi skorlar (9 elemanlı, [0,1] aralığında)
 * @param t1 - Olay anı skorlar (9 elemanlı, [0,1] aralığında)
 * @returns RCAResult — hesaplama sonuçları
 *
 * Δ̂_i = max(0, C_i(t₁) - C_i(t₀))  // Risk artışı
 * R_RCA = max_i Δ̂_i                   (override: max Δ̂ ≥ τ)
 * R_RCA = Σ_i w_i · Δ̂_i               (base)
 * P(C_i) = w_i · Δ̂_i
 * K = { C_i : Δ̂_i ≥ τ_sec }
 */
export function computeR2DRCA(t0: number[], t1: number[]): RCAResult {
  if (t0.length !== 9 || t1.length !== 9) {
    throw new Error("R2D-RCA: t0 ve t1 tam olarak 9 elemanlı olmalı");
  }

  const dims = R2D_DIMENSIONS.map((code) => DIMENSION_META[code]);
  const weights = dims.map((d) => d.weight);

  // Δ̂ = max(0, t1 - t0) — risk artışı pozitif, düşüş 0'a sıkışır
  const deltaHat = t0.map((v0, i) => {
    const v1 = clamp01(t1[i]);
    const v0c = clamp01(v0);
    return round3(Math.max(0, v1 - v0c));
  });

  // Max Δ̂ ve argmax
  let maxDeltaHat = 0;
  let maxDeltaHatIndex = 0;
  deltaHat.forEach((d, i) => {
    if (d > maxDeltaHat) { maxDeltaHat = d; maxDeltaHatIndex = i; }
  });

  // Weighted priorities
  const priorities = deltaHat.map((d, i) => d * weights[i]);
  let maxWeighted = 0;
  let maxWeightedIndex = 0;
  priorities.forEach((p, i) => {
    if (p > maxWeighted) { maxWeighted = p; maxWeightedIndex = i; }
  });

  // Calculation mode
  const overrideTriggered = maxDeltaHat >= TAU_PRIMARY;
  const calculationMode: "override" | "base_score" = overrideTriggered ? "override" : "base_score";

  const baseScore = priorities.reduce((sum, p) => sum + p, 0);
  const rRcaScore = round3(overrideTriggered ? maxDeltaHat : baseScore);

  // Stability theorem
  const isStable = maxDeltaHatIndex === maxWeightedIndex;
  const dualReportingRequired = !isStable && maxDeltaHat > 0;

  // Priority ranking (sorted desc by priority, only items with deltaHat > 0)
  const ranked = priorities
    .map((priority, index) => ({
      index,
      code: R2D_DIMENSIONS[index],
      nameTR: dims[index].nameTR,
      deltaHat: deltaHat[index],
      weight: weights[index],
      priority: round3(priority),
    }))
    .filter((item) => item.deltaHat > 0)
    .sort((a, b) => b.priority - a.priority)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // Primary root causes — over secondary threshold
  const primaryRootCauseIndices = deltaHat
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d >= TAU_SECONDARY)
    .map(({ i }) => i);

  // Categorization
  const rankByIndex = new Map<number, number>(ranked.map((r) => [r.index, r.rank]));

  const categorized: CategorizedDimension[] = dims.map((meta, index) => {
    const d = deltaHat[index];
    const priority = round3(priorities[index]);
    let category: CategoryLevel;
    if (d === 0) category = "none";
    else if (d >= TAU_PRIMARY) category = "override";
    else if (d >= 0.20) category = "major";
    else category = "minor";

    return {
      ...meta,
      index,
      t0: round3(clamp01(t0[index])),
      t1: round3(clamp01(t1[index])),
      deltaHat: d,
      priority,
      category,
      rank: rankByIndex.get(index) ?? null,
    };
  });

  const bozulanCount = categorized.filter((c) => c.category !== "none").length;
  const stabilCount = 9 - bozulanCount;

  return {
    deltaHat,
    maxDeltaHat,
    maxDeltaHatIndex,
    maxWeightedIndex,
    overrideTriggered,
    calculationMode,
    rRcaScore,
    priorityRanking: ranked,
    isStable,
    dualReportingRequired,
    bozulanCount,
    stabilCount,
    categorized,
    primaryRootCauseIndices,
  };
}

/* ------------------------------------------------------------------ */
/*  Renk paleti — kategori + veri kaynağına göre                      */
/* ------------------------------------------------------------------ */

export const CATEGORY_COLORS: Record<CategoryLevel, { bg: string; fg: string; border: string }> = {
  override: { bg: "#FCEBEB", fg: "#791F1F", border: "#D85A30" },
  major:    { bg: "#FAEEDA", fg: "#633806", border: "#EF9F27" },
  minor:    { bg: "#F5F4EF", fg: "#57564D", border: "#B4B2A9" },
  none:     { bg: "#F9F9F6", fg: "#9A988F", border: "#D3D1C7" },
};

export const SOURCE_COLORS: Record<R2DSourceType, { bg: string; fg: string }> = {
  visual: { bg: "#EAF3DE", fg: "#27500A" },
  sensor: { bg: "#E6F1FB", fg: "#0C447C" },
  scada:  { bg: "#EEEDFE", fg: "#3C3489" },
  record: { bg: "#FAEEDA", fg: "#633806" },
};

/* ------------------------------------------------------------------ */
/*  Test verisi                                                        */
/* ------------------------------------------------------------------ */

export const DEMO_T0 = [0.25, 0.15, 0.30, 0.20, 0.35, 0.10, 0.20, 0.30, 0.15];
export const DEMO_T1 = [0.25, 0.15, 0.45, 0.35, 0.65, 0.10, 0.75, 0.30, 0.40];
