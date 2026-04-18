import { createClient } from "./client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type IncidentType = "work_accident" | "near_miss" | "occupational_disease" | "other";
export type IncidentStatus = "draft" | "reported" | "investigating" | "dof_open" | "closed";
export type SeverityLevel = "low" | "medium" | "high" | "critical";
export type DofStatus = "open" | "in_progress" | "completed" | "verified";

export type IncidentRecord = {
  id: string;
  organizationId: string;
  companyWorkspaceId: string | null;
  personnelId: string | null;
  incidentCode: string;
  incidentType: IncidentType;
  status: IncidentStatus;
  severityLevel: SeverityLevel | null;

  // Olay detayları
  incidentDate: string | null;
  incidentTime: string | null;
  incidentLocation: string | null;
  incidentDepartment: string | null;
  incidentEnvironment: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  workStartTime: string | null;
  generalActivity: string | null;
  specificActivity: string | null;
  toolUsed: string | null;
  description: string | null;
  narrative: string | null;

  // Yaralanma
  injuryType: string | null;
  injuryBodyPart: string | null;
  injuryCauseEvent: string | null;
  injuryCauseTool: string | null;
  workDisability: boolean;
  disabilityStatus: string | null;
  daysLost: number;

  // Tıbbi müdahale
  medicalIntervention: boolean;
  firstAidProvided: boolean;
  firstAidNotes: string | null;
  medicalPerson: string | null;
  medicalLocation: string | null;
  medicalCity: string | null;
  medicalDistrict: string | null;
  medicalDate: string | null;
  medicalTime: string | null;

  // Bildirim
  reportedBy: string | null;
  reportDate: string | null;
  reportTime: string | null;
  employeeCountMale: number | null;
  employeeCountFemale: number | null;
  employeeCountTotal: number | null;

  // Kaza
  accidentCauseDescription: string | null;
  accidentCause: string | null;
  accidentCauseTool: string | null;
  accidentCity: string | null;
  accidentDistrict: string | null;

  // Meslek hastalığı
  diseaseWorkEnvironment: string | null;
  diseaseDetectionMethod: string | null;
  diseaseAgent: string | null;
  diseaseAgentDuration: string | null;
  disabilityLevel: string | null;
  diseaseDiagnosis: string | null;
  diseaseDiagnosisDate: string | null;

  // AI
  aiSummary: Record<string, unknown> | null;
  dofRequired: boolean;
  ishikawaRequired: boolean;
  ishikawaData: Record<string, unknown> | null;
  sgkNotificationDeadline: string | null;
  sgkNotifiedAt: string | null;

  // Meta
  createdAt: string;
  updatedAt: string;

  // Joined fields (from queries)
  companyName?: string;
  personnelName?: string;
};

export type WitnessRecord = {
  id: string;
  incidentId: string;
  tcIdentity: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type PersonnelOutcome = "injured" | "deceased" | "unharmed" | "unknown";

export type IncidentPersonnelRecord = {
  id: string;
  incidentId: string;
  personnelId: string | null;
  personnelName: string;
  personnelTc: string | null;
  personnelDepartment: string | null;
  personnelPosition: string | null;
  outcome: PersonnelOutcome;
  injuryType: string | null;
  injuryBodyPart: string | null;
  injuryCauseEvent: string | null;
  injuryCauseTool: string | null;
  workDisability: boolean;
  disabilityStatus: string | null;
  daysLost: number;
  medicalIntervention: boolean;
  medicalPerson: string | null;
  medicalLocation: string | null;
  medicalCity: string | null;
  medicalDistrict: string | null;
  medicalDate: string | null;
  medicalTime: string | null;
  notes: string | null;
};

export type DofRecord = {
  id: string;
  incidentId: string;
  organizationId: string;
  dofCode: string;
  rootCause: string | null;
  rootCauseAnalysis: string | null;
  correctiveActions: { action: string; assignedTo: string; deadline: string; done: boolean }[];
  preventiveActions: { action: string; assignedTo: string; deadline: string; done: boolean }[];
  assignedTo: string | null;
  deadline: string | null;
  completionDate: string | null;
  status: DofStatus;
  aiSuggestions: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type IshikawaRecord = {
  id: string;
  incidentId: string;
  organizationId: string;
  problemStatement: string | null;
  manCauses: string[];
  machineCauses: string[];
  methodCauses: string[];
  materialCauses: string[];
  environmentCauses: string[];
  measurementCauses: string[];
  rootCauseConclusion: string | null;
  aiSuggestions: Record<string, unknown> | null;
  sharedWithCompany: boolean;
  createdAt: string;
  updatedAt: string;
};

export type IshikawaVersion = {
  id: string;
  ishikawaId: string;
  organizationId: string;
  versionNumber: number;
  problemStatement: string | null;
  manCauses: string[];
  machineCauses: string[];
  methodCauses: string[];
  materialCauses: string[];
  environmentCauses: string[];
  measurementCauses: string[];
  rootCauseConclusion: string | null;
  createdBy: string | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Row mappers                                                        */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIncidentRow(row: any): IncidentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    companyWorkspaceId: row.company_workspace_id,
    personnelId: row.personnel_id,
    incidentCode: row.incident_code,
    incidentType: row.incident_type,
    status: row.status,
    severityLevel: row.severity_level,
    incidentDate: row.incident_date,
    incidentTime: row.incident_time,
    incidentLocation: row.incident_location,
    incidentDepartment: row.incident_department,
    incidentEnvironment: row.incident_environment,
    shiftStartTime: row.shift_start_time,
    shiftEndTime: row.shift_end_time,
    workStartTime: row.work_start_time,
    generalActivity: row.general_activity,
    specificActivity: row.specific_activity,
    toolUsed: row.tool_used,
    description: row.description,
    narrative: row.narrative,
    injuryType: row.injury_type,
    injuryBodyPart: row.injury_body_part,
    injuryCauseEvent: row.injury_cause_event,
    injuryCauseTool: row.injury_cause_tool,
    workDisability: row.work_disability ?? false,
    disabilityStatus: row.disability_status,
    daysLost: row.days_lost ?? 0,
    medicalIntervention: row.medical_intervention ?? false,
    firstAidProvided: row.first_aid_provided ?? false,
    firstAidNotes: row.first_aid_notes,
    medicalPerson: row.medical_person,
    medicalLocation: row.medical_location,
    medicalCity: row.medical_city,
    medicalDistrict: row.medical_district,
    medicalDate: row.medical_date,
    medicalTime: row.medical_time,
    reportedBy: row.reported_by,
    reportDate: row.report_date,
    reportTime: row.report_time,
    employeeCountMale: row.employee_count_male,
    employeeCountFemale: row.employee_count_female,
    employeeCountTotal: row.employee_count_total,
    accidentCauseDescription: row.accident_cause_description,
    accidentCause: row.accident_cause,
    accidentCauseTool: row.accident_cause_tool,
    accidentCity: row.accident_city,
    accidentDistrict: row.accident_district,
    diseaseWorkEnvironment: row.disease_work_environment,
    diseaseDetectionMethod: row.disease_detection_method,
    diseaseAgent: row.disease_agent,
    diseaseAgentDuration: row.disease_agent_duration,
    disabilityLevel: row.disability_level,
    diseaseDiagnosis: row.disease_diagnosis,
    diseaseDiagnosisDate: row.disease_diagnosis_date,
    aiSummary: row.ai_summary,
    dofRequired: row.dof_required ?? false,
    ishikawaRequired: row.ishikawa_required ?? false,
    ishikawaData: row.ishikawa_data,
    sgkNotificationDeadline: row.sgk_notification_deadline,
    sgkNotifiedAt: row.sgk_notified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    companyName: row.company_workspaces?.display_name ?? row.company_workspaces?.company_identities?.official_name,
    personnelName: row.company_personnel
      ? `${row.company_personnel.first_name} ${row.company_personnel.last_name}`
      : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDofRow(row: any): DofRecord {
  return {
    id: row.id,
    incidentId: row.incident_id,
    organizationId: row.organization_id,
    dofCode: row.dof_code,
    rootCause: row.root_cause,
    rootCauseAnalysis: row.root_cause_analysis,
    correctiveActions: row.corrective_actions ?? [],
    preventiveActions: row.preventive_actions ?? [],
    assignedTo: row.assigned_to,
    deadline: row.deadline,
    completionDate: row.completion_date,
    status: row.status,
    aiSuggestions: row.ai_suggestions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIshikawaRow(row: any): IshikawaRecord {
  return {
    id: row.id,
    incidentId: row.incident_id,
    organizationId: row.organization_id,
    problemStatement: row.problem_statement,
    manCauses: row.man_causes ?? [],
    machineCauses: row.machine_causes ?? [],
    methodCauses: row.method_causes ?? [],
    materialCauses: row.material_causes ?? [],
    environmentCauses: row.environment_causes ?? [],
    measurementCauses: row.measurement_causes ?? [],
    rootCauseConclusion: row.root_cause_conclusion,
    aiSuggestions: row.ai_suggestions,
    sharedWithCompany: row.shared_with_company ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIshikawaVersionRow(row: any): IshikawaVersion {
  return {
    id: row.id,
    ishikawaId: row.ishikawa_id,
    organizationId: row.organization_id,
    versionNumber: row.version_number,
    problemStatement: row.problem_statement,
    manCauses: row.man_causes ?? [],
    machineCauses: row.machine_causes ?? [],
    methodCauses: row.method_causes ?? [],
    materialCauses: row.material_causes ?? [],
    environmentCauses: row.environment_causes ?? [],
    measurementCauses: row.measurement_causes ?? [],
    rootCauseConclusion: row.root_cause_conclusion,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/*  camelCase → snake_case mapper for inserts/updates                  */
/* ------------------------------------------------------------------ */

function toSnake(record: Partial<IncidentRecord>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  const map: Record<string, string> = {
    organizationId: "organization_id",
    companyWorkspaceId: "company_workspace_id",
    personnelId: "personnel_id",
    incidentType: "incident_type",
    severityLevel: "severity_level",
    incidentDate: "incident_date",
    incidentTime: "incident_time",
    incidentLocation: "incident_location",
    incidentDepartment: "incident_department",
    incidentEnvironment: "incident_environment",
    shiftStartTime: "shift_start_time",
    shiftEndTime: "shift_end_time",
    workStartTime: "work_start_time",
    generalActivity: "general_activity",
    specificActivity: "specific_activity",
    toolUsed: "tool_used",
    narrative: "narrative",
    injuryType: "injury_type",
    injuryBodyPart: "injury_body_part",
    injuryCauseEvent: "injury_cause_event",
    injuryCauseTool: "injury_cause_tool",
    workDisability: "work_disability",
    disabilityStatus: "disability_status",
    daysLost: "days_lost",
    medicalIntervention: "medical_intervention",
    firstAidProvided: "first_aid_provided",
    firstAidNotes: "first_aid_notes",
    medicalPerson: "medical_person",
    medicalLocation: "medical_location",
    medicalCity: "medical_city",
    medicalDistrict: "medical_district",
    medicalDate: "medical_date",
    medicalTime: "medical_time",
    reportedBy: "reported_by",
    reportDate: "report_date",
    reportTime: "report_time",
    employeeCountMale: "employee_count_male",
    employeeCountFemale: "employee_count_female",
    employeeCountTotal: "employee_count_total",
    accidentCauseDescription: "accident_cause_description",
    accidentCause: "accident_cause",
    accidentCauseTool: "accident_cause_tool",
    accidentCity: "accident_city",
    accidentDistrict: "accident_district",
    diseaseWorkEnvironment: "disease_work_environment",
    diseaseDetectionMethod: "disease_detection_method",
    diseaseAgent: "disease_agent",
    diseaseAgentDuration: "disease_agent_duration",
    disabilityLevel: "disability_level",
    diseaseDiagnosis: "disease_diagnosis",
    diseaseDiagnosisDate: "disease_diagnosis_date",
    aiSummary: "ai_summary",
    dofRequired: "dof_required",
    ishikawaRequired: "ishikawa_required",
    ishikawaData: "ishikawa_data",
    sgkNotificationDeadline: "sgk_notification_deadline",
    sgkNotifiedAt: "sgk_notified_at",
  };
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined) continue;
    const snakeKey = map[k] ?? k;
    out[snakeKey] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Incident CRUD                                                      */
/* ------------------------------------------------------------------ */

export async function fetchIncidents(filters?: {
  type?: IncidentType;
  companyId?: string;
  status?: IncidentStatus;
}): Promise<IncidentRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from("incidents")
    .select(`
      *,
      company_workspaces(display_name, company_identities(official_name)),
      company_personnel(first_name, last_name)
    `)
    .order("created_at", { ascending: false });

  if (filters?.type) query = query.eq("incident_type", filters.type);
  if (filters?.companyId) query = query.eq("company_workspace_id", filters.companyId);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) { console.warn("fetchIncidents: tablo henüz oluşturulmamış olabilir:", error.message); return []; }
  return (data ?? []).map(mapIncidentRow);
}

export async function fetchIncidentById(id: string): Promise<IncidentRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("incidents")
    .select(`
      *,
      company_workspaces(display_name, company_identities(official_name)),
      company_personnel(first_name, last_name)
    `)
    .eq("id", id)
    .single();

  if (error) { console.warn("fetchIncidentById error:", error); return null; }
  return mapIncidentRow(data);
}

export async function resolveOrganizationId(): Promise<{ orgId: string; userId: string } | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 1. JWT app_metadata
  if (user.app_metadata?.organization_id) {
    return { orgId: user.app_metadata.organization_id, userId: user.id };
  }
  // 2. JWT user_metadata
  if (user.user_metadata?.organization_id) {
    return { orgId: user.user_metadata.organization_id, userId: user.id };
  }
  // 3. user_profiles tablosu
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (profile?.organization_id) {
    return { orgId: profile.organization_id, userId: user.id };
  }
  return null;
}

export class CreateIncidentError extends Error {
  constructor(message: string, public readonly code: "no_supabase" | "no_auth" | "insert_error", public readonly supabaseError?: unknown) {
    super(message);
    this.name = "CreateIncidentError";
  }
}

export async function createIncident(record: Partial<IncidentRecord>): Promise<IncidentRecord | null> {
  const supabase = createClient();
  if (!supabase) {
    console.warn("createIncident: Supabase client oluşturulamadı (env eksik olabilir)");
    throw new CreateIncidentError(
      "Supabase bağlantısı kurulamadı. Ortam değişkenleri kontrol edilmelidir.",
      "no_supabase",
    );
  }

  const auth = await resolveOrganizationId();
  if (!auth) {
    console.warn("createIncident: organization_id bulunamadı");
    throw new CreateIncidentError(
      "Kullanıcı veya organizasyon bilgisi bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.",
      "no_auth",
    );
  }

  record.organizationId = auth.orgId;

  const snakeRecord = toSnake(record);
  snakeRecord.created_by = auth.userId;

  const { data, error } = await supabase
    .from("incidents")
    .insert(snakeRecord)
    .select()
    .single();

  if (error) {
    console.warn("createIncident insert error:", error);
    throw new CreateIncidentError(
      `Veritabanı hatası: ${error.message}${error.hint ? ` (${error.hint})` : ""}`,
      "insert_error",
      error,
    );
  }
  return mapIncidentRow(data);
}

export async function updateIncident(id: string, record: Partial<IncidentRecord>): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("incidents")
    .update(toSnake(record))
    .eq("id", id);

  if (error) { console.warn("updateIncident error:", error); return false; }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Witnesses                                                          */
/* ------------------------------------------------------------------ */

export async function fetchWitnesses(incidentId: string): Promise<WitnessRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("incident_witnesses")
    .select("*")
    .eq("incident_id", incidentId);

  if (error) { console.warn("fetchWitnesses error:", error); return []; }
  return (data ?? []).map((r) => ({
    id: r.id,
    incidentId: r.incident_id,
    tcIdentity: r.tc_identity,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    address: r.address,
  }));
}

export async function addWitness(incidentId: string, witness: Omit<WitnessRecord, "id" | "incidentId">): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("incident_witnesses")
    .insert({
      incident_id: incidentId,
      tc_identity: witness.tcIdentity,
      full_name: witness.fullName,
      email: witness.email,
      phone: witness.phone,
      address: witness.address,
    });

  if (error) { console.warn("addWitness error:", error); return false; }
  return true;
}

/* ------------------------------------------------------------------ */
/*  DÖF                                                                */
/* ------------------------------------------------------------------ */

export async function fetchDof(incidentId: string): Promise<DofRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("incident_dof")
    .select("*")
    .eq("incident_id", incidentId)
    .maybeSingle();

  if (error) { console.warn("fetchDof error:", error); return null; }
  return data ? mapDofRow(data) : null;
}

export async function createDof(incidentId: string, organizationId: string, record?: Partial<DofRecord>): Promise<DofRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("incident_dof")
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      root_cause: record?.rootCause ?? null,
      root_cause_analysis: record?.rootCauseAnalysis ?? null,
      corrective_actions: record?.correctiveActions ?? [],
      preventive_actions: record?.preventiveActions ?? [],
      assigned_to: record?.assignedTo ?? null,
      deadline: record?.deadline ?? null,
    })
    .select()
    .single();

  if (error) { console.warn("createDof error:", error); return null; }
  const dofRecord = mapDofRow(data);

  // Otomatik Ajanda sync — DÖF deadline varsa /planner takviminde görünür
  if (dofRecord?.deadline) {
    try {
      const { syncDofDeadline } = await import("@/lib/supabase/ajanda-sync");
      // Incident kodunu al (opsiyonel)
      const { data: incidentRow } = await supabase
        .from("incidents")
        .select("incident_code, company_workspace_id")
        .eq("id", incidentId)
        .maybeSingle();
      await syncDofDeadline({
        id: dofRecord.id,
        deadline: dofRecord.deadline,
        rootCause: dofRecord.rootCause,
        incidentCode: incidentRow?.incident_code ?? null,
        companyWorkspaceId: incidentRow?.company_workspace_id ?? null,
        assignedTo: dofRecord.assignedTo ?? null,
      });
    } catch (syncErr) {
      console.warn("DOF ajanda sync başarısız (sorun değil):", syncErr);
    }
  }

  return dofRecord;
}

export async function updateDof(id: string, record: Partial<DofRecord>): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if (record.rootCause !== undefined) update.root_cause = record.rootCause;
  if (record.rootCauseAnalysis !== undefined) update.root_cause_analysis = record.rootCauseAnalysis;
  if (record.correctiveActions !== undefined) update.corrective_actions = record.correctiveActions;
  if (record.preventiveActions !== undefined) update.preventive_actions = record.preventiveActions;
  if (record.assignedTo !== undefined) update.assigned_to = record.assignedTo;
  if (record.deadline !== undefined) update.deadline = record.deadline;
  if (record.completionDate !== undefined) update.completion_date = record.completionDate;
  if (record.status !== undefined) update.status = record.status;
  if (record.aiSuggestions !== undefined) update.ai_suggestions = record.aiSuggestions;

  const { error } = await supabase.from("incident_dof").update(update).eq("id", id);
  if (error) { console.warn("updateDof error:", error); return false; }
  return true;
}

/* ------------------------------------------------------------------ */
/*  İshikawa                                                           */
/* ------------------------------------------------------------------ */

export async function fetchIshikawa(incidentId: string): Promise<IshikawaRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("incident_ishikawa")
    .select("*")
    .eq("incident_id", incidentId)
    .maybeSingle();

  if (error) { console.warn("fetchIshikawa error:", error); return null; }
  return data ? mapIshikawaRow(data) : null;
}

export async function createIshikawa(incidentId: string, organizationId: string, record?: Partial<IshikawaRecord>): Promise<IshikawaRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("incident_ishikawa")
    .insert({
      incident_id: incidentId,
      organization_id: organizationId,
      problem_statement: record?.problemStatement ?? null,
      man_causes: record?.manCauses ?? [],
      machine_causes: record?.machineCauses ?? [],
      method_causes: record?.methodCauses ?? [],
      material_causes: record?.materialCauses ?? [],
      environment_causes: record?.environmentCauses ?? [],
      measurement_causes: record?.measurementCauses ?? [],
      root_cause_conclusion: record?.rootCauseConclusion ?? null,
      ai_suggestions: record?.aiSuggestions ?? null,
    })
    .select()
    .single();

  if (error) { console.warn("createIshikawa error:", error); return null; }
  return mapIshikawaRow(data);
}

export async function updateIshikawa(id: string, record: Partial<IshikawaRecord>, saveVersion = true): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  // Düzenlemeden önce mevcut halini versiyon olarak kaydet
  if (saveVersion) {
    const { data: current } = await supabase
      .from("incident_ishikawa")
      .select("*")
      .eq("id", id)
      .single();

    if (current) {
      const { count } = await supabase
        .from("ishikawa_versions")
        .select("*", { count: "exact", head: true })
        .eq("ishikawa_id", id);

      const auth = await resolveOrganizationId();
      await supabase.from("ishikawa_versions").insert({
        ishikawa_id: id,
        organization_id: current.organization_id,
        version_number: (count || 0) + 1,
        problem_statement: current.problem_statement,
        man_causes: current.man_causes,
        machine_causes: current.machine_causes,
        method_causes: current.method_causes,
        material_causes: current.material_causes,
        environment_causes: current.environment_causes,
        measurement_causes: current.measurement_causes,
        root_cause_conclusion: current.root_cause_conclusion,
        created_by: auth?.userId ?? null,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if (record.problemStatement !== undefined) update.problem_statement = record.problemStatement;
  if (record.manCauses !== undefined) update.man_causes = record.manCauses;
  if (record.machineCauses !== undefined) update.machine_causes = record.machineCauses;
  if (record.methodCauses !== undefined) update.method_causes = record.methodCauses;
  if (record.materialCauses !== undefined) update.material_causes = record.materialCauses;
  if (record.environmentCauses !== undefined) update.environment_causes = record.environmentCauses;
  if (record.measurementCauses !== undefined) update.measurement_causes = record.measurementCauses;
  if (record.rootCauseConclusion !== undefined) update.root_cause_conclusion = record.rootCauseConclusion;
  if (record.aiSuggestions !== undefined) update.ai_suggestions = record.aiSuggestions;
  if (record.sharedWithCompany !== undefined) update.shared_with_company = record.sharedWithCompany;

  const { error } = await supabase.from("incident_ishikawa").update(update).eq("id", id);
  if (error) { console.warn("updateIshikawa error:", error); return false; }
  return true;
}

export async function deleteIshikawa(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase.from("incident_ishikawa").delete().eq("id", id);
  if (error) { console.warn("deleteIshikawa error:", error); return false; }
  return true;
}

export async function fetchIshikawaVersions(ishikawaId: string): Promise<IshikawaVersion[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("ishikawa_versions")
    .select("*")
    .eq("ishikawa_id", ishikawaId)
    .order("version_number", { ascending: false });

  if (error) { console.warn("fetchIshikawaVersions error:", error); return []; }
  return (data ?? []).map(mapIshikawaVersionRow);
}

export async function toggleIshikawaShare(id: string, shared: boolean): Promise<boolean> {
  return updateIshikawa(id, { sharedWithCompany: shared }, false);
}

export async function fetchAllIshikawaByOrg(): Promise<(IshikawaRecord & { incidentCode?: string; incidentTitle?: string })[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("incident_ishikawa")
    .select("*, incidents(incident_code, description)")
    .order("created_at", { ascending: false });

  if (error) { console.warn("fetchAllIshikawaByOrg error:", error); return []; }
  return (data ?? []).map((row) => ({
    ...mapIshikawaRow(row),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    incidentCode: (row as any).incidents?.incident_code,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    incidentTitle: (row as any).incidents?.description,
  }));
}

/* ------------------------------------------------------------------ */
/*  Incident Personnel (çoklu personel)                                */
/* ------------------------------------------------------------------ */

export async function fetchIncidentPersonnel(incidentId: string): Promise<IncidentPersonnelRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("incident_personnel")
    .select("*")
    .eq("incident_id", incidentId);

  if (error) { console.warn("fetchIncidentPersonnel:", error.message); return []; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    incidentId: r.incident_id,
    personnelId: r.personnel_id,
    personnelName: r.personnel_name ?? "",
    personnelTc: r.personnel_tc,
    personnelDepartment: r.personnel_department,
    personnelPosition: r.personnel_position,
    outcome: r.outcome ?? "injured",
    injuryType: r.injury_type,
    injuryBodyPart: r.injury_body_part,
    injuryCauseEvent: r.injury_cause_event,
    injuryCauseTool: r.injury_cause_tool,
    workDisability: r.work_disability ?? false,
    disabilityStatus: r.disability_status,
    daysLost: r.days_lost ?? 0,
    medicalIntervention: r.medical_intervention ?? false,
    medicalPerson: r.medical_person,
    medicalLocation: r.medical_location,
    medicalCity: r.medical_city,
    medicalDistrict: r.medical_district,
    medicalDate: r.medical_date,
    medicalTime: r.medical_time,
    notes: r.notes,
  }));
}

export async function saveIncidentPersonnel(
  incidentId: string,
  records: Omit<IncidentPersonnelRecord, "id" | "incidentId">[],
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  // Delete existing then re-insert
  await supabase.from("incident_personnel").delete().eq("incident_id", incidentId);

  if (records.length === 0) return true;

  const rows = records.map((r) => ({
    incident_id: incidentId,
    personnel_id: r.personnelId || null,
    personnel_name: r.personnelName,
    personnel_tc: r.personnelTc,
    personnel_department: r.personnelDepartment,
    personnel_position: r.personnelPosition,
    outcome: r.outcome,
    injury_type: r.injuryType,
    injury_body_part: r.injuryBodyPart,
    injury_cause_event: r.injuryCauseEvent,
    injury_cause_tool: r.injuryCauseTool,
    work_disability: r.workDisability,
    disability_status: r.disabilityStatus,
    days_lost: r.daysLost,
    medical_intervention: r.medicalIntervention,
    medical_person: r.medicalPerson,
    medical_location: r.medicalLocation,
    medical_city: r.medicalCity,
    medical_district: r.medicalDistrict,
    medical_date: r.medicalDate || null,
    medical_time: r.medicalTime || null,
    notes: r.notes,
  }));

  const { error } = await supabase.from("incident_personnel").insert(rows);
  if (error) { console.warn("saveIncidentPersonnel:", error.message); return false; }
  return true;
}
