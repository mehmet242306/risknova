"use client";

import { createClient } from "@/lib/supabase/client";

export type NovaFollowUpAction = {
  id: string;
  label: string;
  description?: string | null;
  kind: "navigate" | "prompt";
  url?: string | null;
  prompt?: string | null;
  workflow_run_id?: string | null;
  workflow_step_id?: string | null;
  status?: string | null;
};

export type NovaWorkflowSummary = {
  id: string;
  title: string;
  summary?: string | null;
  status: "active" | "completed" | "cancelled" | "failed";
  current_step: number;
  total_steps: number;
  next_step_label?: string | null;
};

export async function markNovaWorkflowStep(stepId: string, status: "completed" | "skipped" | "cancelled" = "completed") {
  const supabase = createClient();
  if (!supabase || !stepId) return null;

  const { data, error } = await supabase.rpc("update_nova_workflow_step", {
    p_step_id: stepId,
    p_status: status,
  });

  if (error) {
    return null;
  }

  return data ?? null;
}
