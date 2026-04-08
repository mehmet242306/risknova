/**
 * Dijital İkiz API — Tarama oturumları, tespitler, nokta bulutu, modeller
 * Veriler mobil uygulamadan gelir; bu katman web görselleştirmesi için okur.
 */

import { createClient } from "./client";

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

export type ScanSession = {
  id: string;
  companyId: string | null;
  userId: string | null;
  status: "active" | "paused" | "completed";
  riskMethod: string;
  locationName: string;
  gpsStartLat: number | null;
  gpsStartLng: number | null;
  totalRisksFound: number;
  totalFramesAnalyzed: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type ScanDetection = {
  id: string;
  sessionId: string;
  frameNumber: number;
  riskName: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  riskCategory: string;
  confidence: number;
  description: string;
  recommendedAction: string;
  locationHint: string;
  screenshotUrl: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  compassHeading: number | null;
  detectedAt: string;
  isResolved: boolean;
  resolvedAt: string | null;
};

export type TwinPoint = {
  id: string;
  sessionId: string;
  pointIndex: number;
  gpsLat: number;
  gpsLng: number;
  gpsAltitude: number | null;
  compassHeading: number | null;
  devicePitch: number | null;
  deviceRoll: number | null;
  imageUrl: string | null;
  depthEstimate: number | null;
  risksAtPoint: Array<{ risk_name: string; risk_level: string }>;
  capturedAt: string;
};

export type TwinModel = {
  id: string;
  sessionId: string;
  companyId: string | null;
  modelName: string;
  locationName: string;
  centerLat: number | null;
  centerLng: number | null;
  totalPoints: number;
  totalRisks: number;
  boundingBox: { min_lat: number; max_lat: number; min_lng: number; max_lng: number } | null;
  thumbnailUrl: string | null;
  status: "processing" | "ready" | "error";
  createdAt: string;
};

export type SessionStats = {
  totalDetections: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  resolvedCount: number;
  openCount: number;
  categoryBreakdown: Record<string, number>;
};

/* ================================================================== */
/* LIST SCAN SESSIONS                                                  */
/* ================================================================== */

export async function listScanSessions(companyId?: string): Promise<ScanSession[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from("scan_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) { console.warn("[digital-twin-api] listScanSessions:", error.message); return []; }

  return (data ?? []).map((r) => ({
    id: r.id,
    companyId: r.company_id,
    userId: r.user_id,
    status: r.status,
    riskMethod: r.risk_method,
    locationName: r.location_name ?? "",
    gpsStartLat: r.gps_start_lat,
    gpsStartLng: r.gps_start_lng,
    totalRisksFound: r.total_risks_found ?? 0,
    totalFramesAnalyzed: r.total_frames_analyzed ?? 0,
    durationSeconds: r.duration_seconds ?? 0,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
  }));
}

/* ================================================================== */
/* GET SCAN SESSION                                                    */
/* ================================================================== */

export async function getScanSession(sessionId: string): Promise<ScanSession | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("scan_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    userId: data.user_id,
    status: data.status,
    riskMethod: data.risk_method,
    locationName: data.location_name ?? "",
    gpsStartLat: data.gps_start_lat,
    gpsStartLng: data.gps_start_lng,
    totalRisksFound: data.total_risks_found ?? 0,
    totalFramesAnalyzed: data.total_frames_analyzed ?? 0,
    durationSeconds: data.duration_seconds ?? 0,
    startedAt: data.started_at,
    completedAt: data.completed_at,
    createdAt: data.created_at,
  };
}

/* ================================================================== */
/* LIST DETECTIONS                                                     */
/* ================================================================== */

export async function listDetections(sessionId: string): Promise<ScanDetection[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("scan_detections")
    .select("*")
    .eq("session_id", sessionId)
    .order("detected_at", { ascending: true });

  if (error) { console.warn("[digital-twin-api] listDetections:", error.message); return []; }

  return (data ?? []).map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    frameNumber: r.frame_number,
    riskName: r.risk_name,
    riskLevel: r.risk_level,
    riskCategory: r.risk_category ?? "",
    confidence: r.confidence,
    description: r.description ?? "",
    recommendedAction: r.recommended_action ?? "",
    locationHint: r.location_hint ?? "",
    screenshotUrl: r.screenshot_url,
    gpsLat: r.gps_lat,
    gpsLng: r.gps_lng,
    compassHeading: r.compass_heading,
    detectedAt: r.detected_at,
    isResolved: r.is_resolved ?? false,
    resolvedAt: r.resolved_at,
  }));
}

/* ================================================================== */
/* LIST TWIN POINTS                                                    */
/* ================================================================== */

export async function listTwinPoints(sessionId: string): Promise<TwinPoint[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("digital_twin_points")
    .select("*")
    .eq("session_id", sessionId)
    .order("point_index", { ascending: true });

  if (error) { console.warn("[digital-twin-api] listTwinPoints:", error.message); return []; }

  return (data ?? []).map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    pointIndex: r.point_index,
    gpsLat: r.gps_lat,
    gpsLng: r.gps_lng,
    gpsAltitude: r.gps_altitude,
    compassHeading: r.compass_heading,
    devicePitch: r.device_pitch,
    deviceRoll: r.device_roll,
    imageUrl: r.image_url,
    depthEstimate: r.depth_estimate,
    risksAtPoint: (r.risks_at_point ?? []) as TwinPoint["risksAtPoint"],
    capturedAt: r.captured_at,
  }));
}

/* ================================================================== */
/* LIST TWIN MODELS                                                    */
/* ================================================================== */

export async function listTwinModels(companyId?: string): Promise<TwinModel[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from("digital_twin_models")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) { console.warn("[digital-twin-api] listTwinModels:", error.message); return []; }

  return (data ?? []).map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    companyId: r.company_id,
    modelName: r.model_name,
    locationName: r.location_name ?? "",
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    totalPoints: r.total_points ?? 0,
    totalRisks: r.total_risks ?? 0,
    boundingBox: r.bounding_box as TwinModel["boundingBox"],
    thumbnailUrl: r.thumbnail_url,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/* ================================================================== */
/* SESSION STATS                                                       */
/* ================================================================== */

export async function getSessionStats(sessionId: string): Promise<SessionStats> {
  const fallback: SessionStats = {
    totalDetections: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0,
    resolvedCount: 0, openCount: 0, categoryBreakdown: {},
  };

  const supabase = createClient();
  if (!supabase) return fallback;

  const { data, error } = await supabase
    .from("scan_detections")
    .select("risk_level, risk_category, is_resolved")
    .eq("session_id", sessionId);

  if (error || !data) return fallback;

  const stats = { ...fallback, totalDetections: data.length };
  const catMap: Record<string, number> = {};

  for (const d of data) {
    if (d.risk_level === "critical") stats.criticalCount++;
    else if (d.risk_level === "high") stats.highCount++;
    else if (d.risk_level === "medium") stats.mediumCount++;
    else stats.lowCount++;

    if (d.is_resolved) stats.resolvedCount++;
    else stats.openCount++;

    const cat = d.risk_category || "diger";
    catMap[cat] = (catMap[cat] ?? 0) + 1;
  }

  stats.categoryBreakdown = catMap;
  return stats;
}

/* ================================================================== */
/* RESOLVE DETECTION                                                   */
/* ================================================================== */

export async function resolveDetection(detectionId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("scan_detections")
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", detectionId);

  if (error) { console.warn("[digital-twin-api] resolveDetection:", error.message); return false; }
  return true;
}

/* ================================================================== */
/* AGGREGATE STATS (all sessions for a company)                        */
/* ================================================================== */

export async function getCompanyTwinStats(companyId: string): Promise<{
  totalSessions: number;
  totalPoints: number;
  totalRisks: number;
  resolvedRisks: number;
  activeSessions: number;
}> {
  const fallback = { totalSessions: 0, totalPoints: 0, totalRisks: 0, resolvedRisks: 0, activeSessions: 0 };
  const supabase = createClient();
  if (!supabase) return fallback;

  const [sessionsRes, detectionsRes] = await Promise.all([
    supabase.from("scan_sessions").select("id, status, total_risks_found, total_frames_analyzed").eq("company_id", companyId),
    supabase.from("scan_detections").select("is_resolved").eq("company_id", companyId),
  ]);

  const sessions = sessionsRes.data ?? [];
  const detections = detectionsRes.data ?? [];

  return {
    totalSessions: sessions.length,
    totalPoints: sessions.reduce((s, r) => s + (r.total_frames_analyzed ?? 0), 0),
    totalRisks: detections.length,
    resolvedRisks: detections.filter((d) => d.is_resolved).length,
    activeSessions: sessions.filter((s) => s.status === "active").length,
  };
}
