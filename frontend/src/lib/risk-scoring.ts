/**
 * RiskNova Risk Scoring Engine
 * 3 method: R-SKOR 2D, Fine-Kinney, 5x5 L-Tipi Matris
 */

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

export type RiskClass = "follow_up" | "low" | "medium" | "high" | "critical";

export interface RiskResult {
  score: number;
  riskClass: RiskClass;
  label: string;
  action: string;
  color: string;
}

/* ================================================================== */
/* R-SKOR 2D                                                           */
/* ================================================================== */

export interface R2DParam {
  key: string;
  code: string;
  label: string;
  description: string;
  source: string;
  weight: number;
  /** Override katsayisi (sadece C3, C5, C7, C8 icin) */
  overrideCoeff: number | null;
}

export const R2D_PARAMS: R2DParam[] = [
  { key: "c1", code: "C1", label: "Tehlike Yoğunluğu", description: "Sahada tespit edilen tehlikeli nesne sayısı / yoğunluğu", source: "Görsel Analiz", weight: 0.16, overrideCoeff: null },
  { key: "c2", code: "C2", label: "KKD Eksikliği", description: "Baret, eldiven, gözlük gibi KKD takılmamış durumlar", source: "Görsel Analiz", weight: 0.12, overrideCoeff: null },
  { key: "c3", code: "C3", label: "Davranış Riski", description: "Yasak bölgeye giriş, korumasız çalışma, yüksekten düşme tehlikesi", source: "Görsel Analiz", weight: 0.12, overrideCoeff: 1.40 },
  { key: "c4", code: "C4", label: "Çevresel Stres", description: "Aşırı sıcaklık, gürültü, titreşim gibi çevresel faktörler", source: "Görsel Analiz", weight: 0.10, overrideCoeff: null },
  { key: "c5", code: "C5", label: "Kimyasal/Elektrik Tehlike", description: "Gaz kaçağı, kimyasal madde, elektrik tehlikesi", source: "Görsel Analiz", weight: 0.12, overrideCoeff: 1.60 },
  { key: "c6", code: "C6", label: "Erişim / Engel", description: "Kaçış yolu tıkalı, ıslak zemin, geçiş engeli", source: "Görsel Analiz", weight: 0.10, overrideCoeff: null },
  { key: "c7", code: "C7", label: "Makine / Proses", description: "Makine koruması devre dışı, bakım gecikmesi", source: "Görsel Analiz", weight: 0.14, overrideCoeff: 1.50 },
  { key: "c8", code: "C8", label: "Araç Trafiği", description: "Forklift yoğunluğu, hat kesişimi, yaya-araç çatışması", source: "Görsel Analiz", weight: 0.10, overrideCoeff: 1.30 },
  { key: "c9", code: "C9", label: "Örgütsel Yük", description: "Eğitim eksikliği, uyarı levhası eksikliği", source: "Görsel Analiz", weight: 0.08, overrideCoeff: null },
];

export type R2DValues = Record<string, number>; // c1..c9 -> [0,1]

export interface R2DResult extends RiskResult {
  sBase: number;
  sPeak: number;
  dominantParam: string;
  paramContributions: { code: string; contribution: number }[];
}

export function calculateR2D(values: R2DValues): R2DResult {
  // 1. Taban skor
  let sBase = 0;
  const contributions: { code: string; contribution: number }[] = [];
  for (const p of R2D_PARAMS) {
    const v = values[p.key] ?? 0;
    const contrib = p.weight * v;
    sBase += contrib;
    contributions.push({ code: p.code, contribution: contrib });
  }

  // 2. Override (tepe-risk)
  const overrideCandidates: number[] = [];
  for (const p of R2D_PARAMS) {
    if (p.overrideCoeff !== null) {
      overrideCandidates.push(p.overrideCoeff * (values[p.key] ?? 0));
    }
  }
  const sPeak = 0.25 * Math.max(0, ...overrideCandidates);

  // 3. Bilesik skor
  const score = Math.min(1, sBase + sPeak);

  // 4. Dominant parametre
  contributions.sort((a, b) => b.contribution - a.contribution);
  const dominantParam = contributions[0]?.code ?? "C1";

  // 5. Siniflandirma
  const { riskClass, label, action, color } = classifyR2D(score);

  return { score, sBase, sPeak, riskClass, label, action, color, dominantParam, paramContributions: contributions };
}

function classifyR2D(score: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (score < 0.20) return { riskClass: "follow_up", label: "İzleme", action: "Rutin izleme yeterli", color: "#10B981" };
  if (score < 0.40) return { riskClass: "low", label: "Düşük", action: "Planlı değerlendirme yapılmalı", color: "#F59E0B" };
  if (score < 0.60) return { riskClass: "medium", label: "Orta", action: "Artırılmış gözetim gerekli", color: "#F97316" };
  if (score < 0.80) return { riskClass: "high", label: "Yüksek", action: "Öncelikli müdahale gerekli", color: "#DC2626" };
  return { riskClass: "critical", label: "Kritik", action: "İş durdurma değerlendirmesi yapılmalı", color: "#7F1D1D" };
}

/* ================================================================== */
/* Fine-Kinney                                                         */
/* ================================================================== */

export interface FKOption {
  value: number;
  label: string;
  description: string;
}

export const FK_LIKELIHOOD: FKOption[] = [
  { value: 0.1, label: "0.1", description: "Neredeyse imkansız" },
  { value: 0.2, label: "0.2", description: "Çok düşük ihtimal" },
  { value: 0.5, label: "0.5", description: "Beklenmeyen ama mümkün" },
  { value: 1, label: "1", description: "Düşük ihtimal, olasılık dışı değil" },
  { value: 3, label: "3", description: "Nadir ama mümkün" },
  { value: 6, label: "6", description: "Oldukça olası" },
  { value: 10, label: "10", description: "Çok olası / beklenen" },
];

export const FK_SEVERITY: FKOption[] = [
  { value: 1, label: "1", description: "Dikkate değer, ilk yardım gerektiren" },
  { value: 3, label: "3", description: "Önemli, dış tedavi gerektiren" },
  { value: 7, label: "7", description: "Ciddi, kalıcı hasar" },
  { value: 15, label: "15", description: "Çok ciddi, uzuv kaybı" },
  { value: 40, label: "40", description: "Felaket, bir ölüm" },
  { value: 100, label: "100", description: "Kitlesel felaket, çoklu ölüm" },
];

export const FK_EXPOSURE: FKOption[] = [
  { value: 0.5, label: "0.5", description: "Çok nadir (yılda bir)" },
  { value: 1, label: "1", description: "Nadir (ayda bir)" },
  { value: 2, label: "2", description: "Ara sıra (haftada bir)" },
  { value: 3, label: "3", description: "Bazen (haftada birkaç)" },
  { value: 6, label: "6", description: "Sıklıkla (her gün)" },
  { value: 10, label: "10", description: "Sürekli (günün büyük bölümü)" },
];

export interface FKValues {
  likelihood: number;
  severity: number;
  exposure: number;
}

export interface FKResult extends RiskResult {
  likelihood: number;
  severity: number;
  exposure: number;
}

export function calculateFK(values: FKValues): FKResult {
  const score = values.likelihood * values.severity * values.exposure;
  const { riskClass, label, action, color } = classifyFK(score);
  return { score, riskClass, label, action, color, ...values };
}

function classifyFK(score: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (score < 20) return { riskClass: "follow_up", label: "Kabul Edilebilir", action: "Önlem önerisi gerekebilir, acil önlem gerekmez", color: "#10B981" };
  if (score < 70) return { riskClass: "low", label: "Dikkate Değer", action: "Gözetim altında tutulmalı, iyileştirme planlanmalı", color: "#F59E0B" };
  if (score < 200) return { riskClass: "medium", label: "Önemli", action: "Kısa vadede önlem alınmalı", color: "#F97316" };
  if (score < 400) return { riskClass: "high", label: "Yüksek Risk", action: "Hemen önlem alınmalı, iş durdurulmalı", color: "#DC2626" };
  return { riskClass: "critical", label: "Çok Yüksek Risk", action: "Çalışma derhal durdurulmalı", color: "#7F1D1D" };
}

/* ================================================================== */
/* 5x5 L-Tipi Matris                                                   */
/* ================================================================== */

export const MATRIX_LIKELIHOOD_LABELS = [
  "Çok düşük (Hemen hemen imkansız)",
  "Düşük (Çok az, beklenmiyor)",
  "Orta (Az ama mümkün)",
  "Yüksek (Muhtemel, şaşırtmaz)",
  "Çok yüksek (Beklenen, kaçınılamaz)",
];

export const MATRIX_SEVERITY_LABELS = [
  "Çok hafif (İş günü kaybı yok)",
  "Hafif (İş günü kaybına yol açmayan)",
  "Orta (İş günü kaybı gerektiren)",
  "Ciddi (Uzuv kaybı, kalıcı hasar)",
  "Çok ciddi (Ölüm, toplu ölüm)",
];

export interface MatrixValues {
  likelihood: number; // 1-5
  severity: number;   // 1-5
}

export interface MatrixResult extends RiskResult {
  likelihood: number;
  severity: number;
  cellColor: string;
}

/** 5x5 renk matrisi: [olasilik-1][siddet-1] */
const MATRIX_COLORS: string[][] = [
  /* O=1 */ ["#10B981", "#10B981", "#F59E0B", "#F59E0B", "#F97316"],
  /* O=2 */ ["#10B981", "#F59E0B", "#F59E0B", "#F97316", "#F97316"],
  /* O=3 */ ["#F59E0B", "#F59E0B", "#F97316", "#F97316", "#DC2626"],
  /* O=4 */ ["#F59E0B", "#F97316", "#F97316", "#DC2626", "#DC2626"],
  /* O=5 */ ["#F97316", "#F97316", "#DC2626", "#DC2626", "#7F1D1D"],
];

export function calculateMatrix(values: MatrixValues): MatrixResult {
  const score = values.likelihood * values.severity;
  const cellColor = MATRIX_COLORS[values.likelihood - 1]?.[values.severity - 1] ?? "#64748B";
  const { riskClass, label, action, color } = classifyMatrix(score);
  return { score, riskClass, label, action, color: cellColor, cellColor, ...values };
}

function classifyMatrix(score: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (score <= 2) return { riskClass: "follow_up", label: "Kabul Edilebilir", action: "Ek önlem gerekmeyebilir, izleme yeterli", color: "#10B981" };
  if (score <= 4) return { riskClass: "low", label: "Düşük Risk", action: "Mevcut kontroller yeterli, gözlem sürdürülmeli", color: "#F59E0B" };
  if (score <= 9) return { riskClass: "medium", label: "Orta Risk", action: "İyileştirme çalışmaları planlanmalı", color: "#F97316" };
  if (score <= 15) return { riskClass: "high", label: "Yüksek Risk", action: "Kısa sürede önlem alınmalı", color: "#DC2626" };
  return { riskClass: "critical", label: "Tolere Edilemez", action: "İş derhal durdurulmalı, acil önlem", color: "#7F1D1D" };
}

/* ================================================================== */
/* Matris hucre verileri (5x5 grid render icin)                        */
/* ================================================================== */

export function getMatrixGrid(): { likelihood: number; severity: number; score: number; color: string }[] {
  const cells: { likelihood: number; severity: number; score: number; color: string }[] = [];
  for (let l = 5; l >= 1; l--) {
    for (let s = 1; s <= 5; s++) {
      cells.push({ likelihood: l, severity: s, score: l * s, color: MATRIX_COLORS[l - 1][s - 1] });
    }
  }
  return cells;
}
