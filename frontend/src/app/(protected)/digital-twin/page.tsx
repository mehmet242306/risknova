"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listScanSessions,
  listDetections,
  listTwinPoints,
  listTwinModels,
  getSessionStats,
  resolveDetection,
  getCompanyTwinStats,
  type ScanSession,
  type ScanDetection,
  type TwinPoint,
  type TwinModel,
  type SessionStats,
} from "@/lib/supabase/digital-twin-api";

/* ================================================================== */
/* Constants                                                           */
/* ================================================================== */

const LEVEL_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#10B981",
};

const LEVEL_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Yuksek",
  medium: "Orta",
  low: "Dusuk",
};

const CATEGORY_LABELS: Record<string, string> = {
  yangin: "Yangin",
  dusme: "Dusme",
  elektrik: "Elektrik",
  kkd: "KKD",
  kimyasal: "Kimyasal",
  ergonomik: "Ergonomik",
  mekanik: "Mekanik",
  trafik: "Trafik",
  diger: "Diger",
};

type ViewMode = "map" | "cloud" | "timeline";

/* ================================================================== */
/* MAIN COMPONENT                                                      */
/* ================================================================== */

export default function DigitalTwinPage() {
  // Data states
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [models, setModels] = useState<TwinModel[]>([]);
  const [selectedSession, setSelectedSession] = useState<ScanSession | null>(null);
  const [detections, setDetections] = useState<ScanDetection[]>([]);
  const [points, setPoints] = useState<TwinPoint[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);

  // UI states
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedPoint, setSelectedPoint] = useState<TwinPoint | null>(null);
  const [selectedDetection, setSelectedDetection] = useState<ScanDetection | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Aggregate
  const [aggStats, setAggStats] = useState<{ totalSessions: number; totalPoints: number; totalRisks: number; resolvedRisks: number; activeSessions: number }>({ totalSessions: 0, totalPoints: 0, totalRisks: 0, resolvedRisks: 0, activeSessions: 0 });

  // Initial load
  useEffect(() => {
    (async () => {
      const [s, m] = await Promise.all([listScanSessions(), listTwinModels()]);
      setSessions(s);
      setModels(m);
      // Aggregate stats — no company filter for now
      const agg = { totalSessions: s.length, totalPoints: s.reduce((a, r) => a + r.totalFramesAnalyzed, 0), totalRisks: s.reduce((a, r) => a + r.totalRisksFound, 0), resolvedRisks: 0, activeSessions: s.filter((x) => x.status === "active").length };
      setAggStats(agg);
      setLoading(false);
    })();
  }, []);

  // Load session detail
  useEffect(() => {
    if (!selectedSession) { setDetections([]); setPoints([]); setStats(null); return; }
    (async () => {
      const [d, p, st] = await Promise.all([
        listDetections(selectedSession.id),
        listTwinPoints(selectedSession.id),
        getSessionStats(selectedSession.id),
      ]);
      setDetections(d);
      setPoints(p);
      setStats(st);
      setSelectedPoint(null);
      setSelectedDetection(null);
    })();
  }, [selectedSession]);

  // Helpers
  function fmtDate(d: string) {
    try { return new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return d; }
  }
  function fmtDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
  }

  // Resolve a detection
  async function handleResolve(id: string) {
    setResolvingId(id);
    const ok = await resolveDetection(id);
    if (ok) {
      setDetections((prev) => prev.map((d) => d.id === id ? { ...d, isResolved: true, resolvedAt: new Date().toISOString() } : d));
      if (stats) {
        setStats({ ...stats, resolvedCount: stats.resolvedCount + 1, openCount: stats.openCount - 1 });
      }
    }
    setResolvingId(null);
  }

  // GPS normalization for canvas rendering
  const normalizedPoints = useMemo(() => {
    if (points.length === 0) return [];
    const lats = points.map((p) => p.gpsLat);
    const lngs = points.map((p) => p.gpsLng);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    const rangeLat = maxLat - minLat || 0.001;
    const rangeLng = maxLng - minLng || 0.001;
    return points.map((p) => ({
      ...p,
      nx: 5 + ((p.gpsLng - minLng) / rangeLng) * 90,
      ny: 5 + ((maxLat - p.gpsLat) / rangeLat) * 90,
    }));
  }, [points]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dijital Ikiz</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mobil saha taramalarindan olusan mekansal risk haritalari ve nokta bulutu gorsellestirmesi
          </p>
        </div>
        <Badge variant="neutral">Mobil uygulama ile veri toplanir</Badge>
      </div>

      {/* ── Ozet Bandi ── */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {[
          { l: "Toplam Tarama", v: aggStats.totalSessions },
          { l: "Aktif Oturum", v: aggStats.activeSessions, warn: aggStats.activeSessions > 0 },
          { l: "Veri Noktasi", v: aggStats.totalPoints },
          { l: "Tespit Edilen Risk", v: aggStats.totalRisks, warn: aggStats.totalRisks > 0 },
          { l: "Model", v: models.length },
        ].map((m) => (
          <div key={m.l} className="rounded-xl border border-border bg-card p-4 text-center shadow-[var(--shadow-soft)]">
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{m.l}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${m.warn ? "text-amber-500" : "text-foreground"}`}>{m.v}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : sessions.length === 0 ? (
        /* ── Empty State ── */
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <svg className="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <h3 className="mt-6 text-lg font-semibold text-foreground">Henuz dijital ikiz verisi yok</h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground leading-6">
            Mobil uygulamayi kullanarak saha taramasi baslatin. Kamera ile yuruyerek cektiginiz veriler buraya otomatik olarak aktarilacak ve mekansal risk haritasi olusturulacaktir.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">Adim 1</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Mobil Uygulama</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Uygulamayi ac</p>
            </div>
            <div className="flex items-center text-muted-foreground">→</div>
            <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">Adim 2</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Saha Taramasi</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Kamera ile yuru</p>
            </div>
            <div className="flex items-center text-muted-foreground">→</div>
            <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-center">
              <p className="text-xs font-medium text-muted-foreground">Adim 3</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Gorsellestirme</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Burada goruntule</p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Main Content ── */
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* ── Left: Sessions + Models ── */}
          <div className="space-y-5">
            {/* Sessions */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <h3 className="text-sm font-semibold text-foreground">Tarama Oturumlari</h3>
              <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
                {sessions.map((s) => {
                  const isActive = selectedSession?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSession(isActive ? null : s)}
                      className={`w-full rounded-xl border p-3 text-left transition-all ${
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground truncate">{s.locationName || "Adsiz Tarama"}</p>
                        <Badge variant={s.status === "completed" ? "success" : s.status === "active" ? "warning" : "neutral"} className="text-[9px]">
                          {s.status === "completed" ? "Tamam" : s.status === "active" ? "Aktif" : "Durakladi"}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{fmtDate(s.startedAt)}</span>
                        <span>{s.totalRisksFound} risk</span>
                        <span>{fmtDuration(s.durationSeconds)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Models */}
            {models.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
                <h3 className="text-sm font-semibold text-foreground">3D Modeller</h3>
                <div className="mt-3 space-y-2">
                  {models.map((m) => (
                    <div key={m.id} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-medium text-foreground">{m.modelName}</p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{m.totalPoints} nokta</span>
                        <span>{m.totalRisks} risk</span>
                        <Badge variant={m.status === "ready" ? "success" : m.status === "processing" ? "warning" : "danger"} className="text-[9px]">
                          {m.status === "ready" ? "Hazir" : m.status === "processing" ? "Isleniyor" : "Hata"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Visualization ── */}
          <div className="space-y-5">
            {!selectedSession ? (
              <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-16">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                  <p className="mt-4 text-sm font-medium text-muted-foreground">Goruntlemek icin bir tarama oturumu secin</p>
                </div>
              </div>
            ) : (
              <>
                {/* Session header + view toggle */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{selectedSession.locationName || "Tarama Detayi"}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDate(selectedSession.startedAt)} · {fmtDuration(selectedSession.durationSeconds)} · {selectedSession.riskMethod.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex rounded-lg border border-border bg-secondary/30">
                      {(["map", "cloud", "timeline"] as ViewMode[]).map((v) => (
                        <button key={v} type="button" onClick={() => setViewMode(v)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"} ${v === "map" ? "rounded-l-lg" : v === "timeline" ? "rounded-r-lg" : ""}`}>
                          {v === "map" ? "Harita" : v === "cloud" ? "Nokta Bulutu" : "Zaman Cizgisi"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Session stats */}
                  {stats && (
                    <div className="mt-4 grid gap-2 grid-cols-3 sm:grid-cols-6">
                      <div className="rounded-lg border border-border p-2 text-center">
                        <p className="text-[9px] font-medium uppercase text-muted-foreground">Toplam</p>
                        <p className="text-lg font-bold text-foreground">{stats.totalDetections}</p>
                      </div>
                      {(["critical", "high", "medium", "low"] as const).map((l) => (
                        <div key={l} className="rounded-lg border border-border p-2 text-center">
                          <p className="text-[9px] font-medium uppercase text-muted-foreground">{LEVEL_LABELS[l]}</p>
                          <p className="text-lg font-bold" style={{ color: LEVEL_COLORS[l] }}>
                            {l === "critical" ? stats.criticalCount : l === "high" ? stats.highCount : l === "medium" ? stats.mediumCount : stats.lowCount}
                          </p>
                        </div>
                      ))}
                      <div className="rounded-lg border border-border p-2 text-center">
                        <p className="text-[9px] font-medium uppercase text-muted-foreground">Cozuldu</p>
                        <p className="text-lg font-bold text-emerald-500">{stats.resolvedCount}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── MAP VIEW ── */}
                {viewMode === "map" && (
                  <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                    {/* Canvas area */}
                    <div className="rounded-2xl border border-border bg-slate-950 p-4 min-h-[500px] relative overflow-hidden">
                      {/* Grid background */}
                      <div className="absolute inset-0 opacity-5">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={`h-${i}`} className="absolute w-full border-t border-primary" style={{ top: `${(i + 1) * 5}%` }} />
                        ))}
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={`v-${i}`} className="absolute h-full border-l border-primary" style={{ left: `${(i + 1) * 5}%` }} />
                        ))}
                      </div>

                      {/* Points */}
                      {normalizedPoints.map((p) => {
                        const hasRisk = p.risksAtPoint && p.risksAtPoint.length > 0;
                        const topRisk = hasRisk ? p.risksAtPoint[0] : null;
                        const color = topRisk ? (LEVEL_COLORS[topRisk.risk_level] ?? "#3B82F6") : "#3B82F6";
                        const isSelected = selectedPoint?.id === p.id;

                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPoint(isSelected ? null : p)}
                            className={`absolute transition-all duration-200 ${isSelected ? "z-20 scale-[2]" : "hover:scale-150 z-10"}`}
                            style={{ left: `${p.nx}%`, top: `${p.ny}%` }}
                            title={`Nokta #${p.pointIndex}${topRisk ? ` — ${topRisk.risk_name}` : ""}`}
                          >
                            <div
                              className="h-3 w-3 rounded-full border border-white/30"
                              style={{ backgroundColor: color, boxShadow: `0 0 ${hasRisk ? 10 : 4}px ${color}` }}
                            />
                            {/* Direction arrow */}
                            {p.compassHeading != null && (
                              <div
                                className="absolute -top-1 left-1/2 h-2 w-0.5 bg-white/50 origin-bottom"
                                style={{ transform: `translateX(-50%) rotate(${p.compassHeading}deg)` }}
                              />
                            )}
                          </button>
                        );
                      })}

                      {points.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-sm text-slate-500">Bu oturum icin nokta verisi bekleniyor...</p>
                        </div>
                      )}

                      {/* Legend */}
                      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm">
                        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
                          <div key={level} className="flex items-center gap-1">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[10px] text-slate-400">{LEVEL_LABELS[level]}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                          <span className="text-[10px] text-slate-400">Guvenli</span>
                        </div>
                      </div>
                    </div>

                    {/* Point detail sidebar */}
                    <div className="space-y-3">
                      {selectedPoint ? (
                        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
                          <h4 className="text-sm font-semibold text-foreground">Nokta #{selectedPoint.pointIndex}</h4>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            GPS: {selectedPoint.gpsLat.toFixed(6)}, {selectedPoint.gpsLng.toFixed(6)}
                            {selectedPoint.compassHeading != null && ` · Yon: ${Math.round(selectedPoint.compassHeading)}°`}
                          </p>
                          {selectedPoint.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={selectedPoint.imageUrl} alt="" className="mt-3 w-full rounded-xl border border-border object-cover aspect-[4/3]" />
                          )}
                          {selectedPoint.risksAtPoint.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Bu Noktadaki Riskler</p>
                              {selectedPoint.risksAtPoint.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-2">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: LEVEL_COLORS[r.risk_level] ?? "#3B82F6" }} />
                                  <span className="text-xs text-foreground">{r.risk_name}</span>
                                  <Badge variant={r.risk_level === "critical" ? "danger" : r.risk_level === "high" ? "warning" : "neutral"} className="ml-auto text-[9px]">
                                    {LEVEL_LABELS[r.risk_level]}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">Temiz — risk tespit edilmedi</p>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
                          <p className="text-xs text-muted-foreground">Detay gormek icin haritada bir noktaya tiklayin</p>
                        </div>
                      )}

                      {/* Category breakdown */}
                      {stats && Object.keys(stats.categoryBreakdown).length > 0 && (
                        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
                          <h4 className="text-sm font-semibold text-foreground">Kategori Dagilimi</h4>
                          <div className="mt-3 space-y-2">
                            {Object.entries(stats.categoryBreakdown)
                              .sort(([, a], [, b]) => b - a)
                              .map(([cat, count]) => (
                                <div key={cat} className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat] ?? cat}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 rounded-full bg-primary/20" style={{ width: `${Math.max(count / (stats.totalDetections || 1) * 100, 8)}px` }}>
                                      <div className="h-full rounded-full bg-primary" style={{ width: `${(count / (stats.totalDetections || 1)) * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-foreground tabular-nums">{count}</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── CLOUD VIEW ── */}
                {viewMode === "cloud" && (
                  <div className="rounded-2xl border border-border bg-slate-950 p-6 min-h-[600px] relative overflow-hidden">
                    {/* 3D-like grid */}
                    <div className="absolute inset-0">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Perspective grid lines */}
                        {Array.from({ length: 11 }).map((_, i) => (
                          <line key={`gh-${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="rgba(245,158,11,0.06)" strokeWidth="0.2" />
                        ))}
                        {Array.from({ length: 11 }).map((_, i) => (
                          <line key={`gv-${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="rgba(245,158,11,0.06)" strokeWidth="0.2" />
                        ))}
                      </svg>
                    </div>

                    {/* Points as 3D-ish spheres */}
                    {normalizedPoints.map((p, i) => {
                      const hasRisk = p.risksAtPoint && p.risksAtPoint.length > 0;
                      const topRisk = hasRisk ? p.risksAtPoint[0] : null;
                      const color = topRisk ? (LEVEL_COLORS[topRisk.risk_level] ?? "#3B82F6") : "#3B82F6";
                      const size = hasRisk ? 14 : 8;
                      const depth = (p.depthEstimate ?? (50 + Math.sin(i * 0.5) * 30)) / 100;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPoint(p)}
                          className="absolute transition-all duration-300 hover:scale-150"
                          style={{
                            left: `${p.nx}%`,
                            top: `${p.ny}%`,
                            transform: `translate(-50%, -50%) scale(${0.5 + depth * 0.8})`,
                            opacity: 0.5 + depth * 0.5,
                            zIndex: Math.round(depth * 100),
                          }}
                          title={`#${p.pointIndex}`}
                        >
                          <div
                            className="rounded-full"
                            style={{
                              width: `${size}px`, height: `${size}px`,
                              backgroundColor: color,
                              boxShadow: `0 0 ${hasRisk ? 12 : 6}px ${color}, inset 0 -2px 4px rgba(0,0,0,0.3)`,
                            }}
                          />
                        </button>
                      );
                    })}

                    {points.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-sm text-slate-500">Nokta bulutu verisi bekleniyor...</p>
                      </div>
                    )}

                    {/* Info overlay */}
                    <div className="absolute top-3 left-3 rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm">
                      <p className="text-[10px] text-slate-400">{points.length} nokta · {detections.filter((d) => !d.isResolved).length} acik risk</p>
                    </div>
                  </div>
                )}

                {/* ── TIMELINE VIEW ── */}
                {viewMode === "timeline" && (
                  <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                    <h3 className="text-sm font-semibold text-foreground">Risk Tespit Zaman Cizgisi</h3>
                    {detections.length === 0 ? (
                      <p className="mt-4 text-center text-sm text-muted-foreground py-8">Bu oturumda tespit yok.</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {detections.map((d) => {
                          const color = LEVEL_COLORS[d.riskLevel] ?? "#3B82F6";
                          const isExpanded = selectedDetection?.id === d.id;
                          return (
                            <div key={d.id} className={`rounded-xl border p-4 transition-all ${isExpanded ? "border-primary ring-1 ring-primary/20" : "border-border"}`}>
                              <button type="button" onClick={() => setSelectedDetection(isExpanded ? null : d)} className="w-full text-left">
                                <div className="flex items-center gap-3">
                                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium text-foreground">{d.riskName}</span>
                                      <Badge variant={d.riskLevel === "critical" ? "danger" : d.riskLevel === "high" ? "warning" : "neutral"} className="text-[9px]">
                                        {LEVEL_LABELS[d.riskLevel]}
                                      </Badge>
                                      {d.riskCategory && <span className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[d.riskCategory] ?? d.riskCategory}</span>}
                                      {d.isResolved && <Badge variant="success" className="text-[9px]">Cozuldu</Badge>}
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                      Kare #{d.frameNumber} · {fmtDate(d.detectedAt)} · Guven: %{d.confidence}
                                    </p>
                                  </div>
                                  {d.screenshotUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={d.screenshotUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg border border-border object-cover" />
                                  )}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="mt-3 space-y-3 border-t border-border pt-3">
                                  {d.description && (
                                    <div>
                                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Aciklama</p>
                                      <p className="mt-1 text-xs text-foreground leading-5">{d.description}</p>
                                    </div>
                                  )}
                                  {d.recommendedAction && (
                                    <div className="rounded-lg bg-amber-50/50 p-2.5 dark:bg-amber-900/10">
                                      <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Onerilen Aksiyon</p>
                                      <p className="mt-0.5 text-xs text-foreground leading-5">{d.recommendedAction}</p>
                                    </div>
                                  )}
                                  {d.screenshotUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={d.screenshotUrl} alt="" className="w-full max-w-md rounded-xl border border-border object-cover" />
                                  )}
                                  {d.gpsLat && (
                                    <p className="text-[11px] text-muted-foreground">GPS: {d.gpsLat.toFixed(6)}, {d.gpsLng?.toFixed(6)}</p>
                                  )}
                                  {!d.isResolved && (
                                    <Button
                                      type="button"
                                      variant="accent"
                                      size="sm"
                                      onClick={() => handleResolve(d.id)}
                                      disabled={resolvingId === d.id}
                                    >
                                      {resolvingId === d.id ? "Kaydediliyor..." : "Cozuldu Olarak Isaretle"}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
