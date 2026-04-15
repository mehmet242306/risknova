/**
 * ISG Süreç Takip API — Eğitim, Periyodik Kontrol, İSG Kurul, Sağlık Muayenesi, Özet Metrikler
 * Eğitim/Kontrol/Kurul kaydedilince otomatik olarak planlama (isg_tasks) + bildirim oluşturulur.
 */

import { createClient } from "./client";
import { resolveOrganizationId } from "./incident-api";
import { createNotification } from "./notification-api";

/* ISG Task Category IDs — DB'deki sabit değerler */
const ISG_CAT = {
  EGITIM: "9b722ae5-0a72-48c8-9d1f-836e1a114b8a",
  PERIYODIK_KONTROL: "5656072d-c601-453d-a3c6-fa40e5a624e6",
  ISG_KURUL: "7e4dda4c-d0c0-4e61-adce-eba783e43085",
};

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

export type TrainingRecord = {
  id: string;
  title: string;
  trainingType: "zorunlu" | "istege_bagli" | "yenileme";
  trainerName: string;
  trainingDate: string | null;
  durationHours: number;
  location: string;
  status: "planned" | "completed" | "cancelled";
  notes: string;
  attendeeCount?: number;
  createdAt: string;
};

export type PeriodicControlRecord = {
  id: string;
  title: string;
  controlType: string;
  inspectorName: string;
  inspectionDate: string | null;
  nextInspectionDate: string | null;
  result: "uygun" | "uygun_degil" | "sartli_uygun";
  reportReference: string;
  notes: string;
  status: "planned" | "completed" | "overdue";
  createdAt: string;
};

export type HealthExamRecord = {
  id: string;
  personnelId: string | null;
  personnelName: string;
  examType: "ise_giris" | "periyodik" | "isten_ayrilma" | "ozel";
  examDate: string | null;
  nextExamDate: string | null;
  physicianName: string;
  result: "uygun" | "uygun_degil" | "sartli_uygun" | "izleme";
  restrictions: string;
  notes: string;
  createdAt: string;
};

export type TrackingSummary = {
  completedTrainingCount: number;
  expiringTrainingCount: number;
  periodicControlCount: number;
  overduePeriodicControlCount: number;
  openActionCount: number;
  healthExamsDueCount: number;
};

export type OrganizationTrackingSummary = {
  companyCount: number;
  openActionCount: number;
  expiringTrainingCount: number;
  overduePeriodicControlCount: number;
  upcomingCommitteeCount: number;
  healthExamsDueCount: number;
  topCompanies: Array<{
    id: string;
    name: string;
    openActions: number;
    expiringTrainings: number;
    overdueControls: number;
  }>;
};

/* ================================================================== */
/* SUMMARY METRICS                                                     */
/* ================================================================== */

export async function getTrackingSummary(companyWorkspaceId: string): Promise<TrackingSummary> {
  const supabase = createClient();
  if (!supabase) return { completedTrainingCount: 0, expiringTrainingCount: 0, periodicControlCount: 0, overduePeriodicControlCount: 0, openActionCount: 0, healthExamsDueCount: 0 };

  const today = new Date().toISOString().split("T")[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  // Resolve company_identity_id for health exams query
  const { data: ws } = await supabase.from("company_workspaces").select("company_identity_id").eq("id", companyWorkspaceId).single();
  const identityId = ws?.company_identity_id ?? companyWorkspaceId;

  const [trainings, controls, findings, healthExams] = await Promise.all([
    supabase.from("company_trainings").select("status, training_date").eq("company_workspace_id", companyWorkspaceId),
    supabase.from("company_periodic_controls").select("status, next_inspection_date").eq("company_workspace_id", companyWorkspaceId),
    supabase.from("risk_assessment_findings").select("tracking_status, assessment_id").in("tracking_status", ["open", "in_progress"]),
    supabase.from("personnel_health_exams").select("next_exam_date").eq("company_identity_id", identityId),
  ]);

  const completedTrainingCount = (trainings.data ?? []).filter((t) => t.status === "completed").length;
  const expiringTrainingCount = (trainings.data ?? []).filter((t) => t.status === "planned" && t.training_date && t.training_date <= in30Days).length;
  const periodicControlCount = (controls.data ?? []).length;
  const overduePeriodicControlCount = (controls.data ?? []).filter((c) => c.next_inspection_date && c.next_inspection_date < today).length;
  const openActionCount = (findings.data ?? []).length;
  const healthExamsDueCount = (healthExams.data ?? []).filter((h) => h.next_exam_date && h.next_exam_date <= in30Days).length;

  return { completedTrainingCount, expiringTrainingCount, periodicControlCount, overduePeriodicControlCount, openActionCount, healthExamsDueCount };
}

/**
 * Tum organizasyondaki firmalar icin tek cagride takip rollup'i.
 * Dashboard widget'i icin — company_workspaces'dan org ID'yi cozup her alt tabloyu
 * bu firmalar'a gore filtreler, sonuclari agrege eder. RLS zaten org izolasyonunu saglar.
 */
export async function getOrganizationTrackingSummary(): Promise<OrganizationTrackingSummary> {
  const empty: OrganizationTrackingSummary = {
    companyCount: 0,
    openActionCount: 0,
    expiringTrainingCount: 0,
    overduePeriodicControlCount: 0,
    upcomingCommitteeCount: 0,
    healthExamsDueCount: 0,
    topCompanies: [],
  };

  const supabase = createClient();
  if (!supabase) return empty;

  const auth = await resolveOrganizationId();
  if (!auth) return empty;

  const { data: workspaces, error: wsErr } = await supabase
    .from("company_workspaces")
    .select("id, display_name, company_identity_id")
    .eq("organization_id", auth.orgId)
    .is("deleted_at", null);

  if (wsErr) {
    console.warn("[tracking-api] getOrganizationTrackingSummary workspaces:", wsErr.message);
    return empty;
  }

  const wsList = workspaces ?? [];
  if (wsList.length === 0) return empty;

  const wsIds = wsList.map((w) => w.id);
  const identityIds = wsList
    .map((w) => w.company_identity_id)
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  const today = new Date().toISOString().split("T")[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const [assessments, trainings, controls, meetings, healthExams] = await Promise.all([
    supabase
      .from("risk_assessments")
      .select("id, company_workspace_id")
      .in("company_workspace_id", wsIds),
    supabase
      .from("company_trainings")
      .select("status, training_date, company_workspace_id")
      .in("company_workspace_id", wsIds),
    supabase
      .from("company_periodic_controls")
      .select("next_inspection_date, company_workspace_id")
      .in("company_workspace_id", wsIds),
    supabase
      .from("company_committee_meetings")
      .select("status, next_meeting_date, company_workspace_id")
      .in("company_workspace_id", wsIds),
    identityIds.length > 0
      ? supabase
          .from("personnel_health_exams")
          .select("next_exam_date, company_identity_id")
          .in("company_identity_id", identityIds)
      : Promise.resolve({ data: [] as Array<{ next_exam_date: string | null; company_identity_id: string }> }),
  ]);

  const assessmentRows = assessments.data ?? [];
  const assessmentToWorkspace = new Map<string, string>();
  for (const a of assessmentRows) {
    if (a.id && a.company_workspace_id) assessmentToWorkspace.set(a.id, a.company_workspace_id);
  }
  const assessmentIds = assessmentRows.map((a) => a.id);

  let findings: Array<{ assessment_id: string }> = [];
  if (assessmentIds.length > 0) {
    const { data: findingRows } = await supabase
      .from("risk_assessment_findings")
      .select("assessment_id, tracking_status")
      .in("assessment_id", assessmentIds)
      .in("tracking_status", ["open", "in_progress"]);
    findings = (findingRows ?? []) as Array<{ assessment_id: string }>;
  }

  // Per-company rollups
  type WsStats = { openActions: number; expiringTrainings: number; overdueControls: number };
  const perCompany = new Map<string, WsStats>();
  const bump = (wsId: string, key: keyof WsStats) => {
    const cur = perCompany.get(wsId) ?? { openActions: 0, expiringTrainings: 0, overdueControls: 0 };
    cur[key] += 1;
    perCompany.set(wsId, cur);
  };

  for (const f of findings) {
    const wsId = assessmentToWorkspace.get(f.assessment_id);
    if (wsId) bump(wsId, "openActions");
  }
  for (const t of trainings.data ?? []) {
    if (t.status === "planned" && t.training_date && t.training_date <= in30Days) {
      bump(t.company_workspace_id, "expiringTrainings");
    }
  }
  for (const c of controls.data ?? []) {
    if (c.next_inspection_date && c.next_inspection_date < today) {
      bump(c.company_workspace_id, "overdueControls");
    }
  }

  const openActionCount = findings.length;
  const expiringTrainingCount = (trainings.data ?? []).filter(
    (t) => t.status === "planned" && t.training_date && t.training_date <= in30Days,
  ).length;
  const overduePeriodicControlCount = (controls.data ?? []).filter(
    (c) => c.next_inspection_date && c.next_inspection_date < today,
  ).length;
  const upcomingCommitteeCount = (meetings.data ?? []).filter(
    (m) => m.status === "planned",
  ).length;
  const healthExamsDueCount = (healthExams.data ?? []).filter(
    (h) => h.next_exam_date && h.next_exam_date <= in30Days,
  ).length;

  const topCompanies = wsList
    .map((w) => {
      const stats = perCompany.get(w.id) ?? { openActions: 0, expiringTrainings: 0, overdueControls: 0 };
      return {
        id: w.id,
        name: w.display_name || "Isimsiz firma",
        openActions: stats.openActions,
        expiringTrainings: stats.expiringTrainings,
        overdueControls: stats.overdueControls,
      };
    })
    .filter((c) => c.openActions + c.expiringTrainings + c.overdueControls > 0)
    .sort(
      (a, b) =>
        b.openActions + b.expiringTrainings + b.overdueControls -
        (a.openActions + a.expiringTrainings + a.overdueControls),
    )
    .slice(0, 5);

  return {
    companyCount: wsList.length,
    openActionCount,
    expiringTrainingCount,
    overduePeriodicControlCount,
    upcomingCommitteeCount,
    healthExamsDueCount,
    topCompanies,
  };
}

/* ================================================================== */
/* TRAININGS CRUD                                                      */
/* ================================================================== */

export async function listTrainings(companyWorkspaceId: string): Promise<TrainingRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("company_trainings")
    .select("*")
    .eq("company_workspace_id", companyWorkspaceId)
    .order("training_date", { ascending: false, nullsFirst: false });

  if (error) { console.warn("[tracking-api] listTrainings:", error.message); return []; }

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    trainingType: r.training_type,
    trainerName: r.trainer_name ?? "",
    trainingDate: r.training_date,
    durationHours: Number(r.duration_hours) || 0,
    location: r.location ?? "",
    status: r.status,
    notes: r.notes ?? "",
    createdAt: r.created_at,
  }));
}

export async function createTraining(companyWorkspaceId: string, data: {
  title: string; trainingType: string; trainerName: string;
  trainingDate: string; durationHours: number; location: string; status: string; notes: string;
}): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) { console.warn("[tracking-api] createTraining: auth failed"); return null; }

  console.log("[tracking-api] createTraining orgId:", auth.orgId, "wsId:", companyWorkspaceId);

  const { data: row, error } = await supabase
    .from("company_trainings")
    .insert({
      organization_id: auth.orgId,
      company_workspace_id: companyWorkspaceId,
      title: data.title,
      training_type: data.trainingType,
      trainer_name: data.trainerName,
      training_date: data.trainingDate || null,
      duration_hours: data.durationHours,
      location: data.location,
      status: data.status,
      notes: data.notes,
    })
    .select("id")
    .single();

  if (error) { console.warn("[tracking-api] createTraining error:", error.message, error.details, error.hint); return null; }
  console.log("[tracking-api] createTraining success:", row?.id);

  // Otomatik planlama görevi oluştur
  if (row?.id && data.trainingDate) {
    const { error: taskErr } = await supabase.from("isg_tasks").insert({
      organization_id: auth.orgId,
      title: `Eğitim: ${data.title}`,
      description: `Eğitimci: ${data.trainerName || "—"} | Süre: ${data.durationHours} saat${data.notes ? "\n" + data.notes : ""}`,
      category_id: ISG_CAT.EGITIM,
      company_workspace_id: companyWorkspaceId,
      start_date: data.trainingDate,
      end_date: data.trainingDate,
      status: data.status === "completed" ? "completed" : "planned",
      location: data.location || null,
      reminder_days: 3,
    });
    if (taskErr) console.warn("[tracking-api] isg_tasks insert error:", taskErr.message, taskErr.details);
    else console.log("[tracking-api] isg_task created for training");
  }

  // Bildirim oluştur
  void createNotification({
    title: "Yeni eğitim planlandı",
    message: `${data.title} — ${data.trainingDate || "Tarih belirlenmedi"}`,
    type: "task",
    level: "info",
    link: `/companies/${companyWorkspaceId}?tab=tracking`,
  });

  return row?.id ?? null;
}

export async function updateTraining(id: string, data: {
  title: string; trainingType: string; trainerName: string;
  trainingDate: string; durationHours: number; location: string; status: string; notes: string;
}): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("company_trainings").update({
    title: data.title, training_type: data.trainingType, trainer_name: data.trainerName,
    training_date: data.trainingDate || null, duration_hours: data.durationHours,
    location: data.location, status: data.status, notes: data.notes, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) { console.warn("[tracking-api] updateTraining:", error.message); return false; }
  return true;
}

export async function deleteTraining(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("company_trainings").delete().eq("id", id);
  return !error;
}

/* ================================================================== */
/* PERIODIC CONTROLS CRUD                                              */
/* ================================================================== */

export async function listPeriodicControls(companyWorkspaceId: string): Promise<PeriodicControlRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("company_periodic_controls")
    .select("*")
    .eq("company_workspace_id", companyWorkspaceId)
    .order("next_inspection_date", { ascending: true, nullsFirst: false });

  if (error) { console.warn("[tracking-api] listPeriodicControls:", error.message); return []; }

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    controlType: r.control_type,
    inspectorName: r.inspector_name ?? "",
    inspectionDate: r.inspection_date,
    nextInspectionDate: r.next_inspection_date,
    result: r.result,
    reportReference: r.report_reference ?? "",
    notes: r.notes ?? "",
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function createPeriodicControl(companyWorkspaceId: string, data: {
  title: string; controlType: string; inspectorName: string;
  inspectionDate: string; nextInspectionDate: string; result: string; reportReference: string; notes: string; status: string;
}): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) return null;

  const { data: row, error } = await supabase
    .from("company_periodic_controls")
    .insert({
      organization_id: auth.orgId,
      company_workspace_id: companyWorkspaceId,
      title: data.title,
      control_type: data.controlType,
      inspector_name: data.inspectorName,
      inspection_date: data.inspectionDate || null,
      next_inspection_date: data.nextInspectionDate || null,
      result: data.result,
      report_reference: data.reportReference,
      notes: data.notes,
      status: data.status,
      // created_by omitted — FK constraint removed
    })
    .select("id")
    .single();

  if (error) { console.warn("[tracking-api] createPeriodicControl error:", error.message, error.details); return null; }
  console.log("[tracking-api] createPeriodicControl success:", row?.id);

  // Planlama görevine ekle — sonraki kontrol tarihi veya kontrol tarihi
  const taskDate = data.nextInspectionDate || data.inspectionDate;
  if (row?.id && taskDate) {
    const { error: taskErr } = await supabase.from("isg_tasks").insert({
      organization_id: auth.orgId,
      title: `Periyodik Kontrol: ${data.title}`,
      description: `Denetçi: ${data.inspectorName || "—"} | Rapor: ${data.reportReference || "—"}${data.notes ? "\n" + data.notes : ""}`,
      category_id: ISG_CAT.PERIYODIK_KONTROL,
      company_workspace_id: companyWorkspaceId,
      start_date: taskDate,
      end_date: taskDate,
      status: data.nextInspectionDate ? "planned" : (data.status === "completed" ? "completed" : "planned"),
      reminder_days: 14,
    });
    if (taskErr) console.warn("[tracking-api] isg_tasks insert error (control):", taskErr.message, taskErr.details);
    else console.log("[tracking-api] isg_task created for control");
  }

  // Bildirim
  const typeLabels: Record<string, string> = { elektrik: "Elektrik", asansor: "Asansör", yangin: "Yangın", basinc: "Basınçlı Kap", vinc: "Vinç", kompressor: "Kompresör", forklift: "Forklift", diger: "Diğer" };
  void createNotification({
    title: "Periyodik kontrol kaydedildi",
    message: `${data.title} (${typeLabels[data.controlType] ?? data.controlType}) — Sonuç: ${data.result === "uygun" ? "Uygun" : data.result === "uygun_degil" ? "Uygun Değil" : "Şartlı Uygun"}`,
    type: "task",
    level: data.result === "uygun_degil" ? "warning" : "info",
    link: `/companies/${companyWorkspaceId}?tab=tracking`,
  });

  return row?.id ?? null;
}

export async function updatePeriodicControl(id: string, data: {
  title: string; controlType: string; inspectorName: string;
  inspectionDate: string; nextInspectionDate: string; result: string; reportReference: string; notes: string; status: string;
}): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("company_periodic_controls").update({
    title: data.title, control_type: data.controlType, inspector_name: data.inspectorName,
    inspection_date: data.inspectionDate || null, next_inspection_date: data.nextInspectionDate || null,
    result: data.result, report_reference: data.reportReference, notes: data.notes, status: data.status,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) { console.warn("[tracking-api] updatePeriodicControl:", error.message); return false; }
  return true;
}

export async function deletePeriodicControl(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("company_periodic_controls").delete().eq("id", id);
  return !error;
}

/* ================================================================== */
/* HEALTH EXAMS — uses existing personnel_health_exams table           */
/* ================================================================== */

export async function listHealthExams(companyWorkspaceId: string): Promise<HealthExamRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  // Resolve company_identity_id
  const { data: ws } = await supabase.from("company_workspaces").select("company_identity_id").eq("id", companyWorkspaceId).single();
  const identityId = ws?.company_identity_id ?? companyWorkspaceId;

  const { data, error } = await supabase
    .from("personnel_health_exams")
    .select("*, personnel:personnel_id(first_name, last_name)")
    .eq("company_identity_id", identityId)
    .order("exam_date", { ascending: false, nullsFirst: false });

  if (error) { console.warn("[tracking-api] listHealthExams:", error.message); return []; }

  return (data ?? []).map((r) => {
    const p = r.personnel as { first_name?: string; last_name?: string } | null;
    return {
      id: r.id,
      personnelId: r.personnel_id,
      personnelName: p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : "",
      examType: r.exam_type,
      examDate: r.exam_date,
      nextExamDate: r.next_exam_date,
      physicianName: r.physician_name ?? "",
      result: r.result,
      restrictions: r.restrictions ?? "",
      notes: r.notes ?? "",
      createdAt: r.created_at,
    };
  });
}

/* ================================================================== */
/* OPEN ACTIONS — combined from risk findings + DÖF + ISG tasks        */
/* ================================================================== */

export type OpenAction = {
  id: string;
  title: string;
  source: "risk" | "dof" | "isg_task";
  sourceLabel: string;
  severity: string;
  assignee: string;
  deadline: string | null;
  status: string;
};

export async function listOpenActions(companyWorkspaceId: string): Promise<OpenAction[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const actions: OpenAction[] = [];

  // 1. Risk tespitlerinden açık aksiyonlar
  const { data: assessments } = await supabase
    .from("risk_assessments")
    .select("id, title")
    .eq("company_workspace_id", companyWorkspaceId);

  if (assessments && assessments.length > 0) {
    const aIds = assessments.map((a) => a.id);
    const titleMap = new Map(assessments.map((a) => [a.id, a.title]));
    const { data: findings } = await supabase
      .from("risk_assessment_findings")
      .select("id, title, severity, tracking_status, assessment_id")
      .in("assessment_id", aIds)
      .in("tracking_status", ["open", "in_progress"]);

    for (const f of findings ?? []) {
      actions.push({
        id: f.id,
        title: f.title,
        source: "risk",
        sourceLabel: titleMap.get(f.assessment_id) ?? "Risk Analizi",
        severity: f.severity,
        assignee: "",
        deadline: null,
        status: f.tracking_status,
      });
    }
  }

  // 2. DÖF'lerden açık aksiyonlar
  const { data: dofs } = await supabase
    .from("incident_dof")
    .select("id, dof_code, root_cause, status, assigned_to, deadline")
    .in("status", ["open", "in_progress"]);

  for (const d of dofs ?? []) {
    actions.push({
      id: d.id,
      title: d.dof_code || "DÖF",
      source: "dof",
      sourceLabel: d.root_cause ? d.root_cause.substring(0, 50) : "DÖF",
      severity: "high",
      assignee: d.assigned_to ?? "",
      deadline: d.deadline,
      status: d.status,
    });
  }

  // 3. ISG görevlerinden açık aksiyonlar
  const { data: tasks } = await supabase
    .from("isg_tasks")
    .select("id, title, status, end_date, assigned_to")
    .in("status", ["planned", "in_progress", "overdue"]);

  for (const t of tasks ?? []) {
    actions.push({
      id: t.id,
      title: t.title,
      source: "isg_task",
      sourceLabel: "İSG Görevi",
      severity: t.status === "overdue" ? "high" : "medium",
      assignee: "",
      deadline: t.end_date,
      status: t.status,
    });
  }

  // Severity sırasına göre sırala
  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));
}

/* ================================================================== */
/* İSG KURUL TOPLANTILARI                                              */
/* ================================================================== */

export type CommitteeMeeting = {
  id: string;
  meetingDate: string;
  meetingNumber: number;
  attendees: string;
  agenda: string;
  decisions: { text: string; responsible: string; deadline: string }[];
  nextMeetingDate: string | null;
  notes: string;
  status: "planned" | "completed" | "cancelled";
  createdAt: string;
};

/** Tehlike sınıfına göre kurul toplantı periyodu (ay) */
export function getCommitteePeriodMonths(hazardClass: string): number {
  if (hazardClass === "Çok Tehlikeli") return 2;
  if (hazardClass === "Tehlikeli") return 3;
  return 6; // Az Tehlikeli
}

export async function listCommitteeMeetings(companyWorkspaceId: string): Promise<CommitteeMeeting[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("company_committee_meetings")
    .select("*")
    .eq("company_workspace_id", companyWorkspaceId)
    .order("meeting_date", { ascending: false });

  if (error) { console.warn("[tracking-api] listCommitteeMeetings:", error.message); return []; }

  return (data ?? []).map((r) => ({
    id: r.id,
    meetingDate: r.meeting_date,
    meetingNumber: r.meeting_number ?? 1,
    attendees: r.attendees ?? "",
    agenda: r.agenda ?? "",
    decisions: (r.decisions ?? []) as CommitteeMeeting["decisions"],
    nextMeetingDate: r.next_meeting_date,
    notes: r.notes ?? "",
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function createCommitteeMeeting(companyWorkspaceId: string, data: {
  meetingDate: string; meetingNumber: number; attendees: string; agenda: string;
  decisions: { text: string; responsible: string; deadline: string }[];
  nextMeetingDate: string; notes: string; status: string;
}): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const auth = await resolveOrganizationId();
  if (!auth) return null;

  const { data: row, error } = await supabase
    .from("company_committee_meetings")
    .insert({
      organization_id: auth.orgId,
      company_workspace_id: companyWorkspaceId,
      meeting_date: data.meetingDate,
      meeting_number: data.meetingNumber,
      attendees: data.attendees,
      agenda: data.agenda,
      decisions: data.decisions,
      next_meeting_date: data.nextMeetingDate || null,
      notes: data.notes,
      status: data.status,
      // created_by omitted — FK constraint removed
    })
    .select("id")
    .single();

  if (error) { console.warn("[tracking-api] createCommitteeMeeting error:", error.message, error.details); return null; }
  console.log("[tracking-api] createCommitteeMeeting success:", row?.id);

  // Planlamaya ekle — sonraki toplantı veya mevcut toplantı
  const meetingTaskDate = data.nextMeetingDate || data.meetingDate;
  if (row?.id && meetingTaskDate) {
    const { error: taskErr } = await supabase.from("isg_tasks").insert({
      organization_id: auth.orgId,
      title: data.nextMeetingDate ? `İSG Kurul Toplantısı #${data.meetingNumber + 1}` : `İSG Kurul Toplantısı #${data.meetingNumber}`,
      description: data.nextMeetingDate ? `Gündem hazırlanacak. Önceki toplantı: ${data.meetingDate}` : (data.agenda || ""),
      category_id: ISG_CAT.ISG_KURUL,
      company_workspace_id: companyWorkspaceId,
      start_date: meetingTaskDate,
      end_date: meetingTaskDate,
      status: data.nextMeetingDate ? "planned" : (data.status === "completed" ? "completed" : "planned"),
      reminder_days: 7,
    });
    if (taskErr) console.warn("[tracking-api] isg_tasks insert error (committee):", taskErr.message, taskErr.details);
    else console.log("[tracking-api] isg_task created for committee");
  }

  // Bildirim
  void createNotification({
    title: "İSG Kurul toplantısı kaydedildi",
    message: `Toplantı #${data.meetingNumber} — ${data.meetingDate} | ${data.decisions.length} karar`,
    type: "task",
    level: "info",
    link: `/companies/${companyWorkspaceId}?tab=tracking`,
  });

  return row?.id ?? null;
}

export async function updateCommitteeMeeting(id: string, data: {
  meetingDate: string; meetingNumber: number; attendees: string; agenda: string;
  decisions: { text: string; responsible: string; deadline: string }[];
  nextMeetingDate: string; notes: string; status: string;
}): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("company_committee_meetings").update({
    meeting_date: data.meetingDate, meeting_number: data.meetingNumber,
    attendees: data.attendees, agenda: data.agenda, decisions: data.decisions,
    next_meeting_date: data.nextMeetingDate || null, notes: data.notes, status: data.status,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) { console.warn("[tracking-api] updateCommitteeMeeting:", error.message); return false; }
  return true;
}

export async function deleteCommitteeMeeting(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("company_committee_meetings").delete().eq("id", id);
  return !error;
}
