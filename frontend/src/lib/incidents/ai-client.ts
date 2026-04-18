import type { CorrectiveActionAiSuggestion, IshikawaAiResponse } from "@/lib/incidents/ai";
import type { IncidentType } from "@/lib/supabase/incident-api";

type AiIncidentType = "accident" | "occupational_disease" | "near_miss" | "other";
type RootCauseCategory = "insan" | "makine" | "metot" | "malzeme" | "olcum" | "cevre";

export function mapIncidentTypeForAi(incidentType: IncidentType | "other"): AiIncidentType {
  switch (incidentType) {
    case "work_accident":
      return "accident";
    case "occupational_disease":
      return "occupational_disease";
    case "near_miss":
      return "near_miss";
    default:
      return "other";
  }
}

async function parseAiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "AI şu an meşgul, manuel doldurabilirsiniz.";
    throw new Error(message);
  }

  return payload as T;
}

export async function requestIshikawaAnalysis(input: {
  incidentType: IncidentType | "other";
  companyWorkspaceId?: string | null;
  companySector?: string;
  location?: string;
  narrative: string;
  affectedCount?: number;
  witnesses?: string;
}) {
  const response = await fetch("/api/ai/ishikawa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentType: mapIncidentTypeForAi(input.incidentType),
      companyWorkspaceId: input.companyWorkspaceId ?? null,
      companySector: input.companySector ?? "",
      location: input.location ?? "",
      narrative: input.narrative,
      affectedCount: input.affectedCount ?? 0,
      witnesses: input.witnesses ?? "",
    }),
  });

  return parseAiResponse<IshikawaAiResponse>(response);
}

export async function requestCorrectiveActions(input: {
  incidentType: IncidentType | "other";
  companyWorkspaceId?: string | null;
  rootCauses: { category: RootCauseCategory; cause: string }[];
}) {
  const response = await fetch("/api/ai/generate-corrective-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentType: mapIncidentTypeForAi(input.incidentType),
      companyWorkspaceId: input.companyWorkspaceId ?? null,
      rootCauses: input.rootCauses,
    }),
  });

  return parseAiResponse<CorrectiveActionAiSuggestion[]>(response);
}
