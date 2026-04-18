import { createClient } from "@/lib/supabase/client";
import { resolveOrganizationId } from "@/lib/supabase/incident-api";
import type { AnalysisMethod, RootCauseAnalysis } from "./types";
import { mapRcaRow } from "./types";

/* ------------------------------------------------------------------ */
/*  CRUD                                                               */
/* ------------------------------------------------------------------ */

export async function fetchAnalyses(filters?: {
  method?: AnalysisMethod;
  incidentId?: string;
}): Promise<RootCauseAnalysis[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from("root_cause_analyses")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.method) query = query.eq("method", filters.method);
  if (filters?.incidentId) query = query.eq("incident_id", filters.incidentId);

  const { data, error } = await query;
  if (error) { console.warn("fetchAnalyses:", error.message); return []; }
  return (data ?? []).map(mapRcaRow);
}

export async function fetchAnalysisById(id: string): Promise<RootCauseAnalysis | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("root_cause_analyses")
    .select("*")
    .eq("id", id)
    .single();

  if (error) { console.warn("fetchAnalysisById:", error.message); return null; }
  return mapRcaRow(data);
}

export async function createAnalysis(params: {
  incidentId?: string | null;
  incidentTitle: string;
  method: AnalysisMethod;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  isFreeMode?: boolean;
}): Promise<RootCauseAnalysis | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const auth = await resolveOrganizationId();
  if (!auth) return null;

  const { data, error } = await supabase
    .from("root_cause_analyses")
    .insert({
      organization_id: auth.orgId,
      incident_id: params.incidentId || null,
      incident_title: params.incidentTitle,
      method: params.method,
      data: params.data,
      is_free_mode: params.isFreeMode ?? false,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error) { console.warn("createAnalysis:", error.message); return null; }
  return mapRcaRow(data);
}

export async function updateAnalysis(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newData: any,
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  // Versiyon kaydet
  const { data: current } = await supabase
    .from("root_cause_analyses")
    .select("data, organization_id")
    .eq("id", id)
    .single();

  if (current) {
    const { count } = await supabase
      .from("root_cause_versions")
      .select("*", { count: "exact", head: true })
      .eq("analysis_id", id);

    const auth = await resolveOrganizationId();
    await supabase.from("root_cause_versions").insert({
      analysis_id: id,
      organization_id: current.organization_id,
      data: current.data,
      version_number: (count || 0) + 1,
      created_by: auth?.userId ?? null,
    });
  }

  const { error } = await supabase
    .from("root_cause_analyses")
    .update({ data: newData, is_edited: true })
    .eq("id", id);

  if (error) { console.warn("updateAnalysis:", error.message); return false; }
  return true;
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("root_cause_analyses")
    .delete()
    .eq("id", id);

  if (error) { console.warn("deleteAnalysis:", error.message); return false; }
  return true;
}

/* ------------------------------------------------------------------ */
/*  AI analiz istegi                                                   */
/* ------------------------------------------------------------------ */

export async function requestAiAnalysis(params: {
  method: AnalysisMethod;
  incidentTitle: string;
  incidentDescription?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  const res = await fetch("/api/ai/analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "AI analiz hatasi" }));
    throw new Error(err.error || "AI analiz hatasi");
  }

  return res.json();
}
