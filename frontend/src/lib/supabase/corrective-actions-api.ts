import { createClient } from "./client";

export type CorrectiveActionStatus = "tracking" | "in_progress" | "on_hold" | "completed" | "overdue";
export type CorrectiveActionPriority = "Düşük" | "Orta" | "Yüksek" | "Kritik";
export type CorrectiveActionUpdateType = "comment" | "progress" | "status_change" | "file_upload";

export type CorrectiveActionRecord = {
  id: string;
  code: string | null;
  organizationId: string;
  companyWorkspaceId: string;
  incidentId: string | null;
  title: string;
  rootCause: string;
  category: string;
  correctiveAction: string;
  preventiveAction: string | null;
  responsibleUserId: string | null;
  responsibleRole: string | null;
  deadline: string;
  status: CorrectiveActionStatus;
  priority: CorrectiveActionPriority;
  completionPercentage: number;
  aiGenerated: boolean;
  ishikawaSnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  incidentCode?: string | null;
  companyName?: string | null;
};

export type CorrectiveActionUpdateRecord = {
  id: string;
  correctiveActionId: string;
  organizationId: string;
  userId: string | null;
  updateType: CorrectiveActionUpdateType;
  content: string | null;
  fileUrl: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

type LooseRow = Record<string, unknown>;

function mapCorrectiveActionRow(row: LooseRow): CorrectiveActionRecord {
  return {
    id: row.id as string,
    code: (row.code as string | null) ?? null,
    organizationId: row.organization_id as string,
    companyWorkspaceId: row.company_workspace_id as string,
    incidentId: (row.incident_id as string | null) ?? null,
    title: row.title as string,
    rootCause: row.root_cause as string,
    category: row.category as string,
    correctiveAction: row.corrective_action as string,
    preventiveAction: (row.preventive_action as string | null) ?? null,
    responsibleUserId: (row.responsible_user_id as string | null) ?? null,
    responsibleRole: (row.responsible_role as string | null) ?? null,
    deadline: row.deadline as string,
    status: row.status as CorrectiveActionStatus,
    priority: row.priority as CorrectiveActionPriority,
    completionPercentage: (row.completion_percentage as number | null) ?? 0,
    aiGenerated: (row.ai_generated as boolean | null) ?? false,
    ishikawaSnapshot: (row.ishikawa_snapshot as Record<string, unknown> | null) ?? {},
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    incidentCode: ((row.incidents as { incident_code?: string | null } | null) ?? null)?.incident_code ?? null,
    companyName: ((row.company_workspaces as { display_name?: string | null } | null) ?? null)?.display_name ?? null,
  };
}

function mapUpdateRow(row: LooseRow): CorrectiveActionUpdateRecord {
  return {
    id: row.id as string,
    correctiveActionId: row.corrective_action_id as string,
    organizationId: row.organization_id as string,
    userId: (row.user_id as string | null) ?? null,
    updateType: row.update_type as CorrectiveActionUpdateType,
    content: (row.content as string | null) ?? null,
    fileUrl: (row.file_url as string | null) ?? null,
    oldValue: (row.old_value as string | null) ?? null,
    newValue: (row.new_value as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchCorrectiveActions() {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("corrective_actions")
    .select("*, incidents(incident_code), company_workspaces(display_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("fetchCorrectiveActions:", error.message);
    return [];
  }

  return (data ?? []).map(mapCorrectiveActionRow);
}

export async function fetchCorrectiveActionById(id: string) {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("corrective_actions")
    .select("*, incidents(incident_code), company_workspaces(display_name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("fetchCorrectiveActionById:", error.message);
    return null;
  }

  return data ? mapCorrectiveActionRow(data) : null;
}

export async function fetchCorrectiveActionUpdates(correctiveActionId: string) {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("corrective_action_updates")
    .select("*")
    .eq("corrective_action_id", correctiveActionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("fetchCorrectiveActionUpdates:", error.message);
    return [];
  }

  return (data ?? []).map(mapUpdateRow);
}

export async function updateCorrectiveAction(id: string, patch: Partial<CorrectiveActionRecord>) {
  const supabase = createClient();
  if (!supabase) return false;

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.rootCause !== undefined) update.root_cause = patch.rootCause;
  if (patch.correctiveAction !== undefined) update.corrective_action = patch.correctiveAction;
  if (patch.preventiveAction !== undefined) update.preventive_action = patch.preventiveAction;
  if (patch.responsibleRole !== undefined) update.responsible_role = patch.responsibleRole;
  if (patch.deadline !== undefined) update.deadline = patch.deadline;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.completionPercentage !== undefined) update.completion_percentage = patch.completionPercentage;
  if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
  if (patch.metadata !== undefined) update.metadata = patch.metadata;

  const { error } = await supabase.from("corrective_actions").update(update).eq("id", id);
  if (error) {
    console.warn("updateCorrectiveAction:", error.message);
    return false;
  }
  return true;
}

export async function addCorrectiveActionUpdate(input: {
  correctiveActionId: string;
  organizationId: string;
  userId?: string | null;
  updateType: CorrectiveActionUpdateType;
  content?: string | null;
  fileUrl?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}) {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase.from("corrective_action_updates").insert({
    corrective_action_id: input.correctiveActionId,
    organization_id: input.organizationId,
    user_id: input.userId ?? null,
    update_type: input.updateType,
    content: input.content ?? null,
    file_url: input.fileUrl ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
  });

  if (error) {
    console.warn("addCorrectiveActionUpdate:", error.message);
    return false;
  }
  return true;
}
