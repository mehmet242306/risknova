import { z } from "zod";

export const INCIDENT_AI_MODEL = "claude-sonnet-4-20250514";
export const INCIDENT_AI_MAX_TOKENS = 2000;

export const ishikawaCategorySchema = z.object({
  insan: z.array(z.string().min(1)).default([]),
  makine: z.array(z.string().min(1)).default([]),
  metot: z.array(z.string().min(1)).default([]),
  malzeme: z.array(z.string().min(1)).default([]),
  olcum: z.array(z.string().min(1)).default([]),
  cevre: z.array(z.string().min(1)).default([]),
});

export const ishikawaResponseSchema = z.object({
  analysis_summary: z.string().min(1),
  categories: ishikawaCategorySchema,
  primary_root_cause: z.string().min(1),
  severity_assessment: z.enum(["Düşük", "Orta", "Yüksek", "Kritik"]),
});

export type IshikawaAiResponse = z.infer<typeof ishikawaResponseSchema>;

export const correctiveActionSuggestionSchema = z.object({
  root_cause: z.string().min(1),
  category: z.enum(["insan", "makine", "metot", "malzeme", "olcum", "cevre"]),
  corrective_action: z.string().min(1),
  preventive_action: z.string().min(1),
  suggested_role: z.enum([
    "İSG Uzmanı",
    "İşveren Vekili",
    "Birim Müdürü",
    "İK",
    "Bakım Sorumlusu",
  ]),
  suggested_deadline_days: z.number().int().min(7).max(90),
  priority: z.enum(["Düşük", "Orta", "Yüksek", "Kritik"]),
  estimated_effort: z.string().min(1),
});

export const correctiveActionResponseSchema = z.array(correctiveActionSuggestionSchema);

export type CorrectiveActionAiSuggestion = z.infer<typeof correctiveActionSuggestionSchema>;

export const ishikawaRequestSchema = z.object({
  incidentType: z.enum(["accident", "occupational_disease", "near_miss", "other"]),
  companyWorkspaceId: z.string().trim().min(1).max(120).optional().nullable(),
  companySector: z.string().trim().max(250).optional().default(""),
  location: z.string().trim().max(250).optional().default(""),
  narrative: z.string().trim().min(20).max(8000),
  affectedCount: z.number().int().min(0).max(1000).optional().default(0),
  witnesses: z.string().trim().max(4000).optional().default(""),
});

export const correctiveActionsRequestSchema = z.object({
  incidentType: z.enum(["accident", "occupational_disease", "near_miss", "other"]),
  companyWorkspaceId: z.string().trim().min(1).max(120).optional().nullable(),
  rootCauses: z
    .array(
      z.object({
        category: z.enum(["insan", "makine", "metot", "malzeme", "olcum", "cevre"]),
        cause: z.string().min(1).max(1000),
      }),
    )
    .min(1)
    .max(48),
});

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .trim();
}

function normalizeSeverity(value: unknown): "Düşük" | "Orta" | "Yüksek" | "Kritik" {
  const text = normalizeText(value);
  if (text.includes("krit")) return "Kritik";
  if (text.includes("yuksek")) return "Yüksek";
  if (text.includes("dusuk")) return "Düşük";
  return "Orta";
}

function normalizeCategory(value: unknown): "insan" | "makine" | "metot" | "malzeme" | "olcum" | "cevre" {
  const text = normalizeText(value);
  if (text.includes("machine") || text.includes("makin")) return "makine";
  if (text.includes("method") || text.includes("metot") || text.includes("yontem")) return "metot";
  if (text.includes("material") || text.includes("malzem")) return "malzeme";
  if (text.includes("measure") || text.includes("olcum") || text.includes("ölç")) return "olcum";
  if (text.includes("env") || text.includes("cevr")) return "cevre";
  return "insan";
}

function normalizeRole(value: unknown): "İSG Uzmanı" | "İşveren Vekili" | "Birim Müdürü" | "İK" | "Bakım Sorumlusu" {
  const text = normalizeText(value);
  if (text.includes("bakim") || text.includes("maintenance")) return "Bakım Sorumlusu";
  if (text === "ik" || text.includes("insan kaynak") || text.includes("human resources")) return "İK";
  if (text.includes("isveren") || text.includes("employer")) return "İşveren Vekili";
  if (text.includes("mudur") || text.includes("manager")) return "Birim Müdürü";
  return "İSG Uzmanı";
}

function normalizeDeadlineDays(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  if (Number.isFinite(parsed)) {
    return Math.max(7, Math.min(90, Math.round(parsed)));
  }
  return 30;
}

function normalizeCategories(input: unknown) {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const next: Record<"insan" | "makine" | "metot" | "malzeme" | "olcum" | "cevre", string[]> = {
    insan: [],
    makine: [],
    metot: [],
    malzeme: [],
    olcum: [],
    cevre: [],
  };

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = normalizeCategory(rawKey);
    const values = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
    next[key] = values.map((item) => String(item).trim()).filter(Boolean);
  }

  return next;
}

function normalizeIshikawaPayload(parsed: unknown) {
  const source = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  return {
    analysis_summary: String(source.analysis_summary ?? source.summary ?? source.analysis ?? "").trim(),
    categories: normalizeCategories(source.categories),
    primary_root_cause: String(source.primary_root_cause ?? source.root_cause ?? source.primaryCause ?? "").trim(),
    severity_assessment: normalizeSeverity(source.severity_assessment ?? source.severity ?? source.risk_level),
  };
}

function normalizeCorrectiveActionPayload(parsed: unknown) {
  const source = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null
      ? ((parsed as Record<string, unknown>).suggestions as unknown[]) ??
        ((parsed as Record<string, unknown>).actions as unknown[]) ??
        ((parsed as Record<string, unknown>).items as unknown[]) ??
        ((parsed as Record<string, unknown>).corrective_actions as unknown[]) ??
        []
      : [];
  return source.map((item) => {
    const row = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    return {
      root_cause: String(row.root_cause ?? row.cause ?? row.reason ?? "Belirtilmeyen kök neden").trim() || "Belirtilmeyen kök neden",
      category: normalizeCategory(row.category),
      corrective_action:
        String(row.corrective_action ?? row.corrective ?? row.action ?? "Düzeltici faaliyet manuel olarak tanımlanmalıdır.").trim() ||
        "Düzeltici faaliyet manuel olarak tanımlanmalıdır.",
      preventive_action:
        String(row.preventive_action ?? row.preventive ?? "Önleyici faaliyet manuel olarak tanımlanmalıdır.").trim() ||
        "Önleyici faaliyet manuel olarak tanımlanmalıdır.",
      suggested_role: normalizeRole(row.suggested_role ?? row.role),
      suggested_deadline_days: normalizeDeadlineDays(row.suggested_deadline_days ?? row.deadline_days ?? row.deadline),
      priority: normalizeSeverity(row.priority),
      estimated_effort: String(row.estimated_effort ?? row.effort ?? "4 saat").trim() || "4 saat",
    };
  });
}

export function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const candidateIndex =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);

  if (candidateIndex === -1) {
    throw new Error("AI yanıtı içinde JSON bulunamadı.");
  }

  return trimmed.slice(candidateIndex).trim();
}

function normalizeJsonText(rawText: string) {
  return rawText
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function stripTrailingCommas(rawText: string) {
  return rawText.replace(/,\s*([}\]])/g, "$1");
}

function tryParseRecoveredJson(rawText: string) {
  const extracted = extractJsonPayload(rawText);
  const normalized = normalizeJsonText(extracted);
  const candidates = [
    normalized,
    stripTrailingCommas(normalized),
    stripTrailingCommas(normalized.replace(/^\s*[\w-]+\s*:\s*/, "")),
  ];

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("JSON parse edilemedi.");
}

export function parseIshikawaResponse(rawText: string) {
  const parsed = tryParseRecoveredJson(rawText);
  return ishikawaResponseSchema.parse(normalizeIshikawaPayload(parsed));
}

export function parseCorrectiveActionsResponse(rawText: string) {
  const parsed = tryParseRecoveredJson(rawText);
  return correctiveActionResponseSchema.parse(normalizeCorrectiveActionPayload(parsed));
}

export function calculateBusinessDayDeadline(fromDate: Date, businessDays: number) {
  const result = new Date(fromDate);
  let remaining = Math.max(0, businessDays);

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return result;
}

export function ishikawaToMermaid(data: IshikawaAiResponse) {
  const esc = (value: string) =>
    value.replaceAll('"', "'").replaceAll("[", "(").replaceAll("]", ")");

  return `graph LR
  Problem["${esc(data.analysis_summary)}"]

  Insan["İnsan"] --> Problem
  ${data.categories.insan.map((c, i) => `I${i}["${esc(c)}"] --> Insan`).join("\n  ")}

  Makine["Makine"] --> Problem
  ${data.categories.makine.map((c, i) => `M${i}["${esc(c)}"] --> Makine`).join("\n  ")}

  Metot["Metot"] --> Problem
  ${data.categories.metot.map((c, i) => `Me${i}["${esc(c)}"] --> Metot`).join("\n  ")}

  Malzeme["Malzeme"] --> Problem
  ${data.categories.malzeme.map((c, i) => `Ma${i}["${esc(c)}"] --> Malzeme`).join("\n  ")}

  Olcum["Ölçüm"] --> Problem
  ${data.categories.olcum.map((c, i) => `O${i}["${esc(c)}"] --> Olcum`).join("\n  ")}

  Cevre["Çevre"] --> Problem
  ${data.categories.cevre.map((c, i) => `C${i}["${esc(c)}"] --> Cevre`).join("\n  ")}`;
}
