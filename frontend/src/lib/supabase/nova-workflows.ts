"use client";

import { createClient } from "@/lib/supabase/client";
import { getNovaUiLanguage } from "@/lib/nova-ui";

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

export type NovaProactiveBrief = {
  summary: string;
  actions: NovaFollowUpAction[];
  insights: string[];
  activeWorkflows: NovaWorkflowSummary[];
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

export async function getNovaProactiveBrief(locale: string = "tr"): Promise<NovaProactiveBrief | null> {
  const uiLanguage = getNovaUiLanguage(locale);
  const supabase = createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const [
    workflowRunsRes,
    dueTasksRes,
    dueTrainingsRes,
    incidentsRes,
    documentsRes,
    signalsRes,
  ] = await Promise.all([
    supabase
      .from("nova_workflow_runs")
      .select("id, title, summary, status, current_step, total_steps, company_workspace_id")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("isg_tasks")
      .select("id, title, start_date, status, company_workspace_id")
      .in("status", ["planned", "in_progress", "overdue"])
      .lte("start_date", horizonDate)
      .order("start_date", { ascending: true })
      .limit(4),
    supabase
      .from("company_trainings")
      .select("id, title, training_date, status, company_workspace_id")
      .eq("status", "planned")
      .lte("training_date", horizonDate)
      .order("training_date", { ascending: true })
      .limit(3),
    supabase
      .from("incidents")
      .select("id, incident_code, status, company_workspace_id, created_at")
      .in("status", ["draft", "investigating", "dof_open"])
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("editor_documents")
      .select("id, title, status, company_workspace_id, updated_at")
      .in("status", ["taslak", "revizyon", "onay_bekliyor"])
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("nova_learning_signals")
      .select("signal_label, outcome, signal_key, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const workflowRuns = workflowRunsRes.data || [];
  const workflowIds = workflowRuns.map((item) => item.id);

  const workflowStepsRes = workflowIds.length
    ? await supabase
        .from("nova_workflow_steps")
        .select("id, workflow_run_id, title, description, action_kind, target_url, prompt_text, status")
        .in("workflow_run_id", workflowIds)
        .in("status", ["pending", "in_progress"])
        .order("step_order", { ascending: true })
    : { data: [], error: null };

  const stepMap = new Map<string, NovaFollowUpAction[]>();
  for (const step of workflowStepsRes.data || []) {
    const current = stepMap.get(step.workflow_run_id) || [];
    current.push({
      id: `${step.workflow_run_id}:${step.id}`,
      label: step.title,
      description: step.description || null,
      kind: step.action_kind === "navigate" ? "navigate" : "prompt",
      url: step.target_url || null,
      prompt: step.prompt_text || null,
      workflow_run_id: step.workflow_run_id,
      workflow_step_id: step.id,
      status: step.status,
    });
    stepMap.set(step.workflow_run_id, current);
  }

  const activeWorkflows: NovaWorkflowSummary[] = workflowRuns.map((workflow) => ({
    id: workflow.id,
    title: workflow.title,
    summary: workflow.summary || null,
    status: workflow.status,
    current_step: workflow.current_step,
    total_steps: workflow.total_steps,
    next_step_label: stepMap.get(workflow.id)?.[0]?.label || null,
  }));

  const actions: NovaFollowUpAction[] = [];

  for (const workflow of workflowRuns) {
    const nextStep = stepMap.get(workflow.id)?.[0];
    if (nextStep) {
      actions.push(nextStep);
    }
  }

  for (const task of dueTasksRes.data || []) {
    actions.push({
      id: `task:${task.id}`,
      label: uiLanguage === "en" ? `Review task: ${task.title}` : `Gorevi gozden gecir: ${task.title}`,
      description: uiLanguage === "en"
        ? `Due on ${task.start_date}.`
        : `${task.start_date} tarihinde takip bekliyor.`,
      kind: "navigate",
      url: task.company_workspace_id
        ? `/companies/${task.company_workspace_id}?tab=planner`
        : "/planner",
      status: task.status,
    });
  }

  for (const training of dueTrainingsRes.data || []) {
    actions.push({
      id: `training:${training.id}`,
      label: uiLanguage === "en"
        ? `Follow up training: ${training.title}`
        : `Egitim takibini yap: ${training.title}`,
      description: uiLanguage === "en"
        ? `Training date ${training.training_date}.`
        : `${training.training_date} tarihli egitim icin takip yap.`,
      kind: "navigate",
      url: training.company_workspace_id
        ? `/companies/${training.company_workspace_id}?tab=tracking`
        : "/planner",
      status: training.status,
    });
  }

  for (const incident of incidentsRes.data || []) {
    actions.push({
      id: `incident:${incident.id}`,
      label: uiLanguage === "en"
        ? `Continue incident: ${incident.incident_code}`
        : `Olayi devam ettir: ${incident.incident_code}`,
      description: uiLanguage === "en"
        ? `Status ${incident.status}.`
        : `${incident.status} durumundaki olayi tamamlayin.`,
      kind: "navigate",
      url: `/incidents/${incident.id}`,
      status: incident.status,
    });
  }

  for (const document of documentsRes.data || []) {
    actions.push({
      id: `document:${document.id}`,
      label: uiLanguage === "en"
        ? `Review document: ${document.title}`
        : `Dokumani gozden gecir: ${document.title}`,
      description: uiLanguage === "en"
        ? `Document status ${document.status}.`
        : `${document.status} durumundaki dokumani tamamlayin.`,
      kind: "navigate",
      url: `/documents/${document.id}`,
      status: document.status,
    });
  }

  const insights = (signalsRes.data || [])
    .filter((signal) => signal.outcome === "positive")
    .slice(0, 3)
    .map((signal) =>
      uiLanguage === "en"
        ? `Nova learned: ${signal.signal_label}`
        : `Nova ogrendi: ${signal.signal_label}`,
    );

  const uniqueActions = actions
    .filter((action, index, arr) => arr.findIndex((candidate) => candidate.id === action.id) === index)
    .slice(0, 6);

  const summary = uiLanguage === "en"
    ? activeWorkflows.length || uniqueActions.length
      ? `Nova found ${activeWorkflows.length} active workflows and ${uniqueActions.length} follow-up actions for you.`
      : "Nova does not see an urgent follow-up right now. You can still ask it to review your next operational step."
    : activeWorkflows.length || uniqueActions.length
      ? `Nova sizin icin ${activeWorkflows.length} aktif akis ve ${uniqueActions.length} takip adimi buldu.`
      : "Nova su an acil bir takip gormuyor. Yine de bir sonraki operasyon adimini birlikte planlayabiliriz.";

  return {
    summary,
    actions: uniqueActions,
    insights,
    activeWorkflows,
  };
}
