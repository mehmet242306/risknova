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

/* ================================================================== */
/* FMEA (Failure Mode & Effects Analysis)                              */
/* RPN = Severity × Occurrence × Detection                             */
/* ================================================================== */

export interface FMEAValues {
  severity: number;   // 1-10
  occurrence: number; // 1-10
  detection: number;  // 1-10
}

export interface FMEAResult extends RiskResult {
  severity: number;
  occurrence: number;
  detection: number;
  rpn: number;
}

export const FMEA_SEVERITY_OPTIONS: FKOption[] = [
  { value: 1, label: "1", description: "Etkisiz — fark edilmez" },
  { value: 2, label: "2", description: "Çok küçük — ihmal edilebilir etki" },
  { value: 3, label: "3", description: "Küçük — hafif rahatsızlık" },
  { value: 4, label: "4", description: "Düşük — performans düşüşü" },
  { value: 5, label: "5", description: "Orta — önemli performans kaybı" },
  { value: 6, label: "6", description: "Yüksek — sistem işlevi bozulur" },
  { value: 7, label: "7", description: "Çok yüksek — çalışamaz duruma gelir" },
  { value: 8, label: "8", description: "Tehlikeli (uyarılı) — yaralanma riski" },
  { value: 9, label: "9", description: "Tehlikeli (uyarısız) — ciddi yaralanma" },
  { value: 10, label: "10", description: "Felaket — ölüm/toplu kaza" },
];

export const FMEA_OCCURRENCE_OPTIONS: FKOption[] = [
  { value: 1, label: "1", description: "Neredeyse imkansız (< 1/1.000.000)" },
  { value: 2, label: "2", description: "Uzak ihtimal (1/20.000)" },
  { value: 3, label: "3", description: "Çok düşük (1/4.000)" },
  { value: 4, label: "4", description: "Düşük (1/1.000)" },
  { value: 5, label: "5", description: "Orta-düşük (1/400)" },
  { value: 6, label: "6", description: "Orta (1/80)" },
  { value: 7, label: "7", description: "Orta-yüksek (1/40)" },
  { value: 8, label: "8", description: "Yüksek (1/20)" },
  { value: 9, label: "9", description: "Çok yüksek (1/8)" },
  { value: 10, label: "10", description: "Neredeyse kesin (≥ 1/2)" },
];

export const FMEA_DETECTION_OPTIONS: FKOption[] = [
  { value: 1, label: "1", description: "Neredeyse kesin tespit" },
  { value: 2, label: "2", description: "Çok yüksek tespit şansı" },
  { value: 3, label: "3", description: "Yüksek tespit şansı" },
  { value: 4, label: "4", description: "Orta-yüksek tespit" },
  { value: 5, label: "5", description: "Orta tespit" },
  { value: 6, label: "6", description: "Düşük-orta tespit" },
  { value: 7, label: "7", description: "Düşük tespit" },
  { value: 8, label: "8", description: "Çok düşük tespit" },
  { value: 9, label: "9", description: "Uzak ihtimal tespit" },
  { value: 10, label: "10", description: "Tespit edilemez" },
];

export function calculateFMEA(values: FMEAValues): FMEAResult {
  const rpn = values.severity * values.occurrence * values.detection;
  const { riskClass, label, action, color } = classifyFMEA(rpn);
  return { score: rpn, rpn, riskClass, label, action, color, ...values };
}

function classifyFMEA(rpn: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (rpn < 50) return { riskClass: "follow_up", label: "Kabul Edilebilir", action: "Mevcut kontroller yeterli, izleme sürdürülmeli", color: "#10B981" };
  if (rpn < 100) return { riskClass: "low", label: "Düşük Risk", action: "İyileştirme planlanmalı", color: "#F59E0B" };
  if (rpn < 200) return { riskClass: "medium", label: "Orta Risk", action: "Önlem alınmalı, kontroller güçlendirilmeli", color: "#F97316" };
  if (rpn < 500) return { riskClass: "high", label: "Yüksek Risk", action: "Acil önlem gerekli, tasarım değişikliği değerlendirilmeli", color: "#DC2626" };
  return { riskClass: "critical", label: "Kritik Risk", action: "İş durdurulmalı, kök neden analizi yapılmalı", color: "#7F1D1D" };
}

/* ================================================================== */
/* HAZOP (Hazard and Operability Study)                                */
/* Risk = Severity × Likelihood × (6 - Detectability)                  */
/* ================================================================== */

export interface HAZOPValues {
  severity: number;      // 1-5
  likelihood: number;    // 1-5
  detectability: number; // 1-5 (1=kolay tespit, 5=zor tespit)
  guideWord: string;     // kilavuz kelime
  parameter: string;     // proses parametresi
  deviation: string;     // sapma aciklamasi
}

export interface HAZOPResult extends RiskResult {
  severity: number;
  likelihood: number;
  detectability: number;
}

export const HAZOP_GUIDE_WORDS = [
  "Yok (No/Not)", "Az (Less)", "Çok (More)", "Kısmen (Part of)",
  "Tersi (Reverse)", "Başka (Other than)", "Erken (Early)", "Geç (Late)",
  "Önce (Before)", "Sonra (After)",
];

export const HAZOP_PARAMETERS = [
  "Akış (Flow)", "Basınç (Pressure)", "Sıcaklık (Temperature)", "Seviye (Level)",
  "Zaman (Time)", "Kompozisyon (Composition)", "pH", "Hız (Speed)",
  "Karıştırma (Mixing)", "Reaksiyon (Reaction)",
];

export function calculateHAZOP(values: HAZOPValues): HAZOPResult {
  const score = values.severity * values.likelihood * (6 - values.detectability);
  const { riskClass, label, action, color } = classifyHAZOP(score);
  return { score, riskClass, label, action, color, severity: values.severity, likelihood: values.likelihood, detectability: values.detectability };
}

function classifyHAZOP(score: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (score <= 10) return { riskClass: "follow_up", label: "Kabul Edilebilir", action: "Mevcut kontroller yeterli", color: "#10B981" };
  if (score <= 25) return { riskClass: "low", label: "Düşük", action: "İzleme ve iyileştirme planlanmalı", color: "#F59E0B" };
  if (score <= 50) return { riskClass: "medium", label: "Orta", action: "Ek koruma katmanları değerlendirilmeli", color: "#F97316" };
  if (score <= 75) return { riskClass: "high", label: "Yüksek", action: "Proses değişikliği veya ek bariyer gerekli", color: "#DC2626" };
  return { riskClass: "critical", label: "Tolere Edilemez", action: "Proses durdurulmalı, tasarım revizyonu yapılmalı", color: "#7F1D1D" };
}

/* ================================================================== */
/* Bow-Tie (Papyon Analizi)                                            */
/* Risk = (Threat × Severity) / (1 + Prevention + Mitigation)          */
/* ================================================================== */

export interface BowTieValues {
  threatProbability: number;     // 1-5
  consequenceSeverity: number;   // 1-5
  preventionBarriers: number;    // 0-5 (önleyici bariyer sayısı)
  mitigationBarriers: number;    // 0-5 (azaltıcı bariyer sayısı)
}

export interface BowTieResult extends RiskResult {
  threatProbability: number;
  consequenceSeverity: number;
  preventionBarriers: number;
  mitigationBarriers: number;
  rawRisk: number;
  residualRisk: number;
}

export function calculateBowTie(values: BowTieValues): BowTieResult {
  const rawRisk = values.threatProbability * values.consequenceSeverity;
  const divisor = 1 + values.preventionBarriers + values.mitigationBarriers;
  const residualRisk = rawRisk / divisor;
  const normalized = Math.min(1, residualRisk / 25); // 0-1 arasi normalize
  const { riskClass, label, action, color } = classifyBowTie(normalized);
  return { score: normalized, rawRisk, residualRisk, riskClass, label, action, color, ...values };
}

function classifyBowTie(score: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (score <= 0.20) return { riskClass: "follow_up", label: "Kabul Edilebilir", action: "Bariyerler yeterli, izleme sürdürülmeli", color: "#10B981" };
  if (score <= 0.40) return { riskClass: "low", label: "Düşük", action: "Bariyer etkinliği gözden geçirilmeli", color: "#F59E0B" };
  if (score <= 0.60) return { riskClass: "medium", label: "Orta", action: "Ek bariyer eklenmeli", color: "#F97316" };
  if (score <= 0.80) return { riskClass: "high", label: "Yüksek", action: "Acil bariyer takviyesi, proses gözden geçirilmeli", color: "#DC2626" };
  return { riskClass: "critical", label: "Kritik", action: "İş durdurulmalı, tüm bariyerler yeniden tasarlanmalı", color: "#7F1D1D" };
}

/* ================================================================== */
/* FTA (Fault Tree Analysis — Hata Ağacı)                              */
/* P_system = f(component probabilities, gate type)                    */
/* ================================================================== */

export interface FTAValues {
  components: { name: string; failureRate: number }[]; // failureRate: 0-1
  gateType: "AND" | "OR";
  systemCriticality: number; // 1-5
}

export interface FTAResult extends RiskResult {
  systemProbability: number;
  gateType: "AND" | "OR";
  systemCriticality: number;
  componentCount: number;
}

export function calculateFTA(values: FTAValues): FTAResult {
  const probs = values.components.map(c => Math.max(0.001, Math.min(1, c.failureRate)));
  let systemProbability: number;

  if (values.gateType === "AND") {
    systemProbability = probs.reduce((acc, p) => acc * p, 1);
  } else {
    systemProbability = 1 - probs.reduce((acc, p) => acc * (1 - p), 1);
  }

  const finalScore = Math.min(1, systemProbability * (values.systemCriticality / 5));
  const { riskClass, label, action, color } = classifyFTA(finalScore);
  return {
    score: finalScore, systemProbability, gateType: values.gateType,
    systemCriticality: values.systemCriticality,
    componentCount: values.components.length,
    riskClass, label, action, color,
  };
}

function classifyFTA(score: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (score < 0.10) return { riskClass: "follow_up", label: "Kabul Edilebilir", action: "Sistem güvenilirliği yeterli", color: "#10B981" };
  if (score < 0.30) return { riskClass: "low", label: "Düşük", action: "Yedekleme sistemleri değerlendirilmeli", color: "#F59E0B" };
  if (score < 0.50) return { riskClass: "medium", label: "Orta", action: "Kritik bileşenlere yedek eklenmeli", color: "#F97316" };
  if (score < 0.75) return { riskClass: "high", label: "Yüksek", action: "Sistem yeniden tasarlanmalı", color: "#DC2626" };
  return { riskClass: "critical", label: "Kritik", action: "Sistem kullanılmamalı, kök neden giderilmeli", color: "#7F1D1D" };
}

/* ================================================================== */
/* Checklist (Kontrol Listesi)                                         */
/* Uygunluk % = Σ(puan×ağırlık) / Σ(max×ağırlık) × 100               */
/* ================================================================== */

export interface ChecklistItem {
  id: string;
  text: string;
  status: "uygun" | "uygun_degil" | "kismi" | "na";
  weight: number; // 1-3
}

export interface ChecklistValues {
  items: ChecklistItem[];
  category: string;
}

export interface ChecklistResult extends RiskResult {
  compliancePercent: number;
  totalItems: number;
  compliantCount: number;
  nonCompliantCount: number;
  partialCount: number;
}

export function calculateChecklist(values: ChecklistValues): ChecklistResult {
  const applicable = values.items.filter(i => i.status !== "na");
  let earnedPoints = 0;
  let maxPoints = 0;
  let compliant = 0;
  let nonCompliant = 0;
  let partial = 0;

  for (const item of applicable) {
    maxPoints += 2 * item.weight;
    if (item.status === "uygun") { earnedPoints += 2 * item.weight; compliant++; }
    else if (item.status === "kismi") { earnedPoints += 1 * item.weight; partial++; }
    else { nonCompliant++; }
  }

  const compliancePercent = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 100;
  const { riskClass, label, action, color } = classifyChecklist(compliancePercent);
  return {
    score: 100 - compliancePercent, // yuksek risk = dusuk uygunluk
    compliancePercent, totalItems: applicable.length,
    compliantCount: compliant, nonCompliantCount: nonCompliant, partialCount: partial,
    riskClass, label, action, color,
  };
}

function classifyChecklist(percent: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (percent >= 90) return { riskClass: "follow_up", label: "Uygun", action: "Mevcut durum sürdürülmeli", color: "#10B981" };
  if (percent >= 75) return { riskClass: "low", label: "Kabul Edilebilir", action: "Eksiklikler kısa vadede giderilmeli", color: "#F59E0B" };
  if (percent >= 50) return { riskClass: "medium", label: "İyileştirme Gerekli", action: "Kapsamlı iyileştirme planı hazırlanmalı", color: "#F97316" };
  if (percent >= 25) return { riskClass: "high", label: "Yetersiz", action: "Acil düzeltici faaliyet başlatılmalı", color: "#DC2626" };
  return { riskClass: "critical", label: "Kritik Yetersizlik", action: "Faaliyet durdurulmalı, tam revizyon yapılmalı", color: "#7F1D1D" };
}

/* ================================================================== */
/* JSA (Job Safety Analysis — İş Güvenliği Analizi)                    */
/* Adım Risk = Şiddet × Olasılık / Kontrol Etkinliği                   */
/* ================================================================== */

export interface JSAStep {
  id: string;
  stepDescription: string;
  hazard: string;
  severity: number;       // 1-5
  likelihood: number;     // 1-5
  controlEffectiveness: number; // 1-5 (5=cok etkili)
  controlMeasures: string;
}

export interface JSAValues {
  jobTitle: string;
  steps: JSAStep[];
}

export interface JSAResult extends RiskResult {
  stepScores: { stepId: string; score: number; riskClass: RiskClass }[];
  maxStepScore: number;
  avgStepScore: number;
  highRiskStepCount: number;
}

export function calculateJSA(values: JSAValues): JSAResult {
  const stepScores = values.steps.map(s => {
    const raw = (s.severity * s.likelihood) / Math.max(1, s.controlEffectiveness);
    return { stepId: s.id, score: raw, riskClass: classifyJSAStep(raw) };
  });

  const scores = stepScores.map(s => s.score);
  const maxStepScore = Math.max(0, ...scores);
  const avgStepScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const overallScore = (maxStepScore + avgStepScore) / 2;
  const highRiskStepCount = stepScores.filter(s => s.riskClass === "high" || s.riskClass === "critical").length;

  const { riskClass, label, action, color } = classifyMatrix(Math.round(overallScore)); // L-Matris siniflandirmasi
  return { score: overallScore, stepScores, maxStepScore, avgStepScore, highRiskStepCount, riskClass, label, action, color };
}

function classifyJSAStep(score: number): RiskClass {
  if (score <= 1) return "follow_up";
  if (score <= 2) return "low";
  if (score <= 5) return "medium";
  if (score <= 10) return "high";
  return "critical";
}

/* ================================================================== */
/* LOPA (Layer of Protection Analysis)                                 */
/* Mitigated_Freq = Init_Freq × Π(PFD_i)                              */
/* ================================================================== */

export interface LOPALayer {
  id: string;
  name: string;
  pfd: number; // Probability of Failure on Demand (10^-1 to 10^-3)
}

export interface LOPAValues {
  initiatingEventFreq: number;  // yil bazinda frekans (ör: 0.1, 0.01, 0.001)
  consequenceSeverity: number;  // 1-5
  layers: LOPALayer[];
}

export interface LOPAResult extends RiskResult {
  initiatingEventFreq: number;
  mitigatedFreq: number;
  riskReductionFactor: number;
  consequenceSeverity: number;
  layerCount: number;
  meetsTarget: boolean; // tolere edilebilir seviyeye ulasildi mi
}

export const LOPA_INIT_FREQ_OPTIONS: FKOption[] = [
  { value: 1, label: "1", description: "Yılda 1 kez — çok sık" },
  { value: 0.1, label: "10⁻¹", description: "10 yılda 1 — sık" },
  { value: 0.01, label: "10⁻²", description: "100 yılda 1 — ara sıra" },
  { value: 0.001, label: "10⁻³", description: "1000 yılda 1 — nadir" },
  { value: 0.0001, label: "10⁻⁴", description: "10.000 yılda 1 — çok nadir" },
  { value: 0.00001, label: "10⁻⁵", description: "100.000 yılda 1 — son derece nadir" },
];

export const LOPA_PFD_OPTIONS: FKOption[] = [
  { value: 0.1, label: "10⁻¹", description: "Basit idari kontrol" },
  { value: 0.01, label: "10⁻²", description: "Eğitimli operatör yanıtı / alarm" },
  { value: 0.001, label: "10⁻³", description: "Otomatik güvenlik sistemi (SIL-1)" },
];

export function calculateLOPA(values: LOPAValues): LOPAResult {
  const totalPFD = values.layers.reduce((acc, l) => acc * l.pfd, 1);
  const mitigatedFreq = values.initiatingEventFreq * totalPFD;
  const riskReductionFactor = totalPFD > 0 ? 1 / totalPFD : 1;
  const severityFactor = values.consequenceSeverity / 5;
  const riskScore = mitigatedFreq * severityFactor;

  // Tolere edilebilir frekans: 10^-5 (yilda)
  const targetFreq = 1e-5;
  const meetsTarget = mitigatedFreq <= targetFreq;

  const { riskClass, label, action, color } = classifyLOPA(mitigatedFreq);
  return {
    score: riskScore,
    initiatingEventFreq: values.initiatingEventFreq,
    mitigatedFreq, riskReductionFactor,
    consequenceSeverity: values.consequenceSeverity,
    layerCount: values.layers.length,
    meetsTarget,
    riskClass, label, action, color,
  };
}

function classifyLOPA(freq: number): { riskClass: RiskClass; label: string; action: string; color: string } {
  if (freq <= 1e-6) return { riskClass: "follow_up", label: "Kabul Edilebilir", action: "Mevcut koruma katmanları yeterli", color: "#10B981" };
  if (freq <= 1e-5) return { riskClass: "low", label: "ALARP", action: "Makul derecede uygulanabilir en düşük risk", color: "#F59E0B" };
  if (freq <= 1e-4) return { riskClass: "medium", label: "İyileştirme Gerekli", action: "Ek koruma katmanı eklenmeli", color: "#F97316" };
  if (freq <= 1e-3) return { riskClass: "high", label: "Yüksek Risk", action: "Birden fazla ek katman veya proses değişikliği gerekli", color: "#DC2626" };
  return { riskClass: "critical", label: "Tolere Edilemez", action: "Proses durdurulmalı, tasarım revizyonu yapılmalı", color: "#7F1D1D" };
}

/* ================================================================== */
/* Yontem Metadata (UI icin)                                           */
/* ================================================================== */

export type AnalysisMethodId = "r_skor" | "fine_kinney" | "l_matrix" | "fmea" | "hazop" | "bow_tie" | "fta" | "checklist" | "jsa" | "lopa";

export interface MethodInfo {
  id: AnalysisMethodId;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  description: string;
  tooltip: string;
  paramCount: number;
  scoreRange: string;
}

export const METHOD_CATALOG: MethodInfo[] = [
  {
    id: "r_skor", name: "R-SKOR 2D", shortName: "R₂D", icon: "🎯", color: "#6366F1",
    description: "9 parametreli ağırlıklı saha tarama skoru",
    tooltip: "RiskNova'nın özgün yöntemi. 9 parametre (C1-C9) ile sahadan toplanan verileri ağırlıklı olarak değerlendirir. Görsel analiz ile otomatik skorlama yapılabilir.",
    paramCount: 9, scoreRange: "0–1",
  },
  {
    id: "fine_kinney", name: "Fine-Kinney", shortName: "FK", icon: "⚖️", color: "#8B5CF6",
    description: "Olasılık × Şiddet × Maruziyet çarpımı",
    tooltip: "En yaygın kullanılan nicel risk değerlendirme yöntemi. Olasılık (0.1-10), Şiddet (1-100) ve Maruziyet (0.5-10) çarpılarak risk skoru elde edilir. ISO 31000 uyumlu.",
    paramCount: 3, scoreRange: "0.05–10.000",
  },
  {
    id: "l_matrix", name: "L-Tipi Matris", shortName: "5×5", icon: "📊", color: "#EC4899",
    description: "5×5 olasılık-şiddet risk matrisi",
    tooltip: "Basit ve anlaşılır matris yöntemi. Olasılık (1-5) ve Şiddet (1-5) seçilerek 25 hücreli renkli matris üzerinden risk seviyesi belirlenir. 6331 İSG Kanunu uyumlu.",
    paramCount: 2, scoreRange: "1–25",
  },
  {
    id: "fmea", name: "FMEA", shortName: "FMEA", icon: "🔧", color: "#F59E0B",
    description: "Hata Türü ve Etkileri Analizi — RPN hesaplama",
    tooltip: "Failure Mode & Effects Analysis. Şiddet (1-10) × Oluşma Olasılığı (1-10) × Tespit Edilebilirlik (1-10) = RPN. Üretim, bakım ve proses güvenliği için ideal. IEC 60812 standardı.",
    paramCount: 3, scoreRange: "1–1000",
  },
  {
    id: "hazop", name: "HAZOP", shortName: "HAZOP", icon: "🏭", color: "#EF4444",
    description: "Tehlike ve İşletilebilirlik Çalışması",
    tooltip: "Hazard and Operability Study. Kılavuz kelimeler (Yok, Az, Çok, Tersi) ile proses sapmalarını analiz eder. Kimya, petrokimya ve enerji sektörü için zorunlu. IEC 61882.",
    paramCount: 3, scoreRange: "1–125",
  },
  {
    id: "bow_tie", name: "Bow-Tie", shortName: "BT", icon: "🎀", color: "#14B8A6",
    description: "Papyon analizi — tehdit-bariyer-sonuç modeli",
    tooltip: "Tehdit olasılığı ve sonuç şiddeti arasındaki önleyici ve azaltıcı bariyerleri değerlendirir. Bariyer etkinliğine göre residüel risk hesaplanır. Körfez/petrol sektöründe yaygın.",
    paramCount: 4, scoreRange: "0–1",
  },
  {
    id: "fta", name: "FTA", shortName: "FTA", icon: "🌳", color: "#6366F1",
    description: "Hata Ağacı Analizi — sistem güvenilirliği",
    tooltip: "Fault Tree Analysis. Sistem arızasını bileşen hatalarına ayırır. AND/OR kapıları ile sistem arıza olasılığı hesaplanır. Havacılık, nükleer ve kritik sistemlerde kullanılır. IEC 61025.",
    paramCount: -1, scoreRange: "0–1",
  },
  {
    id: "checklist", name: "Checklist", shortName: "CL", icon: "✅", color: "#22C55E",
    description: "Kontrol listesi — uygunluk yüzdesi",
    tooltip: "Standart kontrol maddelerinin Uygun/Uygun Değil/Kısmi olarak değerlendirilmesi. Ağırlıklı uygunluk yüzdesi hesaplanır. Denetim, teftiş ve periyodik kontroller için ideal.",
    paramCount: -1, scoreRange: "0–100%",
  },
  {
    id: "jsa", name: "JSA", shortName: "JSA", icon: "👷", color: "#F97316",
    description: "İş Güvenliği Analizi — adım bazlı tehlike değerlendirme",
    tooltip: "Job Safety Analysis. İş adımları tek tek analiz edilerek her adımda Şiddet × Olasılık / Kontrol Etkinliği hesaplanır. İnşaat, üretim ve saha işleri için vazgeçilmez.",
    paramCount: -1, scoreRange: "1–25",
  },
  {
    id: "lopa", name: "LOPA", shortName: "LOPA", icon: "🛡️", color: "#3B82F6",
    description: "Koruma Katmanı Analizi — frekans azaltma",
    tooltip: "Layer of Protection Analysis. Başlangıç olay frekansını koruma katmanlarının PFD değerleri ile çarparak azaltılmış frekans hesaplar. Proses güvenliği için SIL değerlendirmesi ile birlikte kullanılır.",
    paramCount: -1, scoreRange: "Logaritmik",
  },
];
