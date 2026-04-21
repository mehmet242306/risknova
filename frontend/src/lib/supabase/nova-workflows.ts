"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAccountContext,
  hasManagedOsgbAccount,
  type AccountContextResponse,
} from "@/lib/account/account-api";
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

type WorkspaceScopedRow = {
  company_workspace_id?: string | null;
};

function isCompatSchemaError(message: string | undefined | null): boolean {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

function hasOrganizationWideNovaAccess(account: AccountContextResponse | null): boolean {
  const context = account?.context;
  if (!context?.organizationId || !context.accountType) {
    return false;
  }

  if (context.accountType === "osgb") {
    return hasManagedOsgbAccount(context);
  }

  return true;
}

async function fetchActiveOrganizationWorkspaceIds(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string[]> {
  const preferred = await supabase
    .from("company_workspaces")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (!preferred.error) {
    return (preferred.data ?? []).map((row) => row.id).filter(Boolean);
  }

  if (!isCompatSchemaError(preferred.error.message)) {
    return [];
  }

  const legacy = await supabase
    .from("company_workspaces")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_archived", false);

  if (legacy.error) {
    return [];
  }

  return (legacy.data ?? []).map((row) => row.id).filter(Boolean);
}

async function fetchAssignedWorkspaceIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const assignments = await supabase
    .from("workspace_assignments")
    .select("company_workspace_id")
    .eq("user_id", userId)
    .eq("assignment_status", "active");

  if (!assignments.error) {
    return (assignments.data ?? [])
      .map((row) => row.company_workspace_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
  }

  if (!isCompatSchemaError(assignments.error.message)) {
    return [];
  }

  const memberships = await supabase
    .from("company_memberships")
    .select("company_workspace_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (memberships.error) {
    return [];
  }

  return (memberships.data ?? [])
    .map((row) => row.company_workspace_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function resolveAccessibleWorkspaceIds(
  supabase: SupabaseClient,
  account: AccountContextResponse | null,
  userId: string,
): Promise<string[]> {
  const organizationId = account?.context.organizationId ?? null;
  if (!organizationId) {
    return [];
  }

  if (hasOrganizationWideNovaAccess(account)) {
    return fetchActiveOrganizationWorkspaceIds(supabase, organizationId);
  }

  return fetchAssignedWorkspaceIds(supabase, userId);
}

function filterAccessibleRows<T extends WorkspaceScopedRow>(
  rows: T[],
  accessibleWorkspaceIds: string[],
  organizationWideAccess: boolean,
): T[] {
  if (organizationWideAccess) {
    return rows;
  }

  const workspaceIdSet = new Set(accessibleWorkspaceIds);
  return rows.filter((row) => {
    const workspaceId = row.company_workspace_id;
    return typeof workspaceId === "string" && workspaceIdSet.has(workspaceId);
  });
}

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
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  if (!user) return null;

  const account = await fetchAccountContext();
  const organizationId = account?.context.organizationId ?? null;
  const organizationWideAccess = hasOrganizationWideNovaAccess(account);
  const accessibleWorkspaceIds = await resolveAccessibleWorkspaceIds(supabase, account, user.id);

  if (!organizationWideAccess && accessibleWorkspaceIds.length === 0) {
    return {
      summary:
        uiLanguage === "en"
          ? "Nova could not verify a workspace scope for this user, so it is holding back proactive operational data."
          : "Nova bu kullanici icin erisilebilir firma baglamini dogrulayamadigi icin proaktif operasyon verisini gostermiyor.",
      actions: [],
      insights: [],
      activeWorkflows: [],
    };
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const horizonDate = horizon.toISOString().slice(0, 10);

  let workflowRunsQuery = supabase
    .from("nova_workflow_runs")
    .select("id, title, summary, status, current_step, total_steps, company_workspace_id")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(3);

  if (organizationId) {
    workflowRunsQuery = workflowRunsQuery.eq("organization_id", organizationId);
  }

  if (!organizationWideAccess) {
    workflowRunsQuery = workflowRunsQuery.in("company_workspace_id", accessibleWorkspaceIds);
  }

  let dueTasksQuery = supabase
    .from("isg_tasks")
    .select("id, title, start_date, status, company_workspace_id")
    .in("status", ["planned", "in_progress", "overdue"])
    .lte("start_date", horizonDate)
    .order("start_date", { ascending: true })
    .limit(4);

  if (organizationId) {
    dueTasksQuery = dueTasksQuery.eq("organization_id", organizationId);
  }

  if (!organizationWideAccess) {
    dueTasksQuery = dueTasksQuery.in("company_workspace_id", accessibleWorkspaceIds);
  }

  let dueTrainingsQuery = supabase
    .from("company_trainings")
    .select("id, title, training_date, status, company_workspace_id")
    .eq("status", "planned")
    .lte("training_date", horizonDate)
    .order("training_date", { ascending: true })
    .limit(3);

  if (organizationId) {
    dueTrainingsQuery = dueTrainingsQuery.eq("organization_id", organizationId);
  }

  if (!organizationWideAccess) {
    dueTrainingsQuery = dueTrainingsQuery.in("company_workspace_id", accessibleWorkspaceIds);
  }

  let incidentsQuery = supabase
    .from("incidents")
    .select("id, incident_code, status, company_workspace_id, created_at")
    .in("status", ["draft", "investigating", "dof_open"])
    .order("created_at", { ascending: false })
    .limit(3);

  if (organizationId) {
    incidentsQuery = incidentsQuery.eq("organization_id", organizationId);
  }

  if (!organizationWideAccess) {
    incidentsQuery = incidentsQuery.in("company_workspace_id", accessibleWorkspaceIds);
  }

  let documentsQuery = supabase
    .from("editor_documents")
    .select("id, title, status, company_workspace_id, updated_at")
    .in("status", ["taslak", "revizyon", "onay_bekliyor"])
    .order("updated_at", { ascending: false })
    .limit(3);

  if (organizationId) {
    documentsQuery = documentsQuery.eq("organization_id", organizationId);
  }

  if (!organizationWideAccess) {
    documentsQuery = documentsQuery.in("company_workspace_id", accessibleWorkspaceIds);
  }

  let signalsQuery = supabase
    .from("nova_learning_signals")
    .select("signal_label, outcome, signal_key, created_at, company_workspace_id")
    .order("created_at", { ascending: false })
    .limit(6);

  if (organizationId) {
    signalsQuery = signalsQuery.eq("organization_id", organizationId);
  }

  if (!organizationWideAccess) {
    signalsQuery = signalsQuery.in("company_workspace_id", accessibleWorkspaceIds);
  }

  const [
    workflowRunsRes,
    dueTasksRes,
    dueTrainingsRes,
    incidentsRes,
    documentsRes,
    signalsRes,
  ] = await Promise.all([
    workflowRunsQuery,
    dueTasksQuery,
    dueTrainingsQuery,
    incidentsQuery,
    documentsQuery,
    signalsQuery,
  ]);

  const workflowRuns = filterAccessibleRows(
    (workflowRunsRes.data || []) as Array<{
      id: string;
      title: string;
      summary?: string | null;
      status: "active" | "completed" | "cancelled" | "failed";
      current_step: number;
      total_steps: number;
      company_workspace_id?: string | null;
    }>,
    accessibleWorkspaceIds,
    organizationWideAccess,
  );
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

  for (const task of filterAccessibleRows(
    (dueTasksRes.data || []) as Array<{
      id: string;
      title: string;
      start_date: string;
      status: string;
      company_workspace_id?: string | null;
    }>,
    accessibleWorkspaceIds,
    organizationWideAccess,
  )) {
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

  for (const training of filterAccessibleRows(
    (dueTrainingsRes.data || []) as Array<{
      id: string;
      title: string;
      training_date: string;
      status: string;
      company_workspace_id?: string | null;
    }>,
    accessibleWorkspaceIds,
    organizationWideAccess,
  )) {
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

  for (const incident of filterAccessibleRows(
    (incidentsRes.data || []) as Array<{
      id: string;
      incident_code: string;
      status: string;
      company_workspace_id?: string | null;
      created_at: string;
    }>,
    accessibleWorkspaceIds,
    organizationWideAccess,
  )) {
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

  for (const document of filterAccessibleRows(
    (documentsRes.data || []) as Array<{
      id: string;
      title: string;
      status: string;
      company_workspace_id?: string | null;
      updated_at: string;
    }>,
    accessibleWorkspaceIds,
    organizationWideAccess,
  )) {
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

  const insights = filterAccessibleRows(
    (signalsRes.data || []) as Array<{
      signal_label: string;
      outcome: string;
      signal_key: string;
      created_at: string;
      company_workspace_id?: string | null;
    }>,
    accessibleWorkspaceIds,
    organizationWideAccess,
  )
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
