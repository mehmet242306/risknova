"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LEVEL_COLORS: Record<string, string> = {
  critical: "#7C3AED",
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const LEVEL_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

interface ScanSession {
  id: string;
  status: string;
  risk_method: string;
  location_name: string;
  total_risks_found: number;
  total_frames_analyzed: number;
  duration_seconds: number;
  started_at: string;
}

interface Detection {
  id: string;
  session_id: string;
  risk_name: string;
  risk_level: string;
  confidence: number;
  description: string;
  recommended_action: string;
  screenshot_url: string | null;
  detected_at: string;
  method_specific_data: Record<string, unknown>;
}

export default function LiveScanPage() {
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [activeSession, setActiveSession] = useState<ScanSession | null>(null);
  const supabase = createClient();

  // Oturumları yükle
  useEffect(() => {
    if (!supabase) return;

    const loadSessions = async () => {
      const { data } = await supabase
        .from("scan_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (data) setSessions(data);

      const active = data?.find((s: ScanSession) => s.status === "active");
      if (active) setActiveSession(active);
    };

    loadSessions();

    // Real-time: yeni oturumlar
    const sessionChannel = supabase
      .channel("scan-sessions-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_sessions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setSessions((prev) => [payload.new as ScanSession, ...prev]);
            if ((payload.new as ScanSession).status === "active") {
              setActiveSession(payload.new as ScanSession);
            }
          }
          if (payload.eventType === "UPDATE") {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === (payload.new as ScanSession).id
                  ? (payload.new as ScanSession)
                  : s
              )
            );
            if ((payload.new as ScanSession).status === "completed") {
              setActiveSession(null);
            }
          }
        }
      )
      .subscribe();

    // Real-time: yeni tespitler
    const detectionChannel = supabase
      .channel("scan-detections-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_detections" },
        (payload) => {
          setDetections((prev) => [payload.new as Detection, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(detectionChannel);
    };
  }, [supabase]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}dk ${sec}sn`;
  };

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Canlı Saha Analizi
          </h1>
          <p className="text-gray-500 mt-1">
            Mobil cihazlardan gerçek zamanlı risk taraması
          </p>
        </div>
        {activeSession && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-700 font-semibold text-sm">
              Canlı Tarama Aktif
            </span>
          </div>
        )}
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Aktif Tarama</p>
              <h2 className="text-xl font-bold mt-1">
                {activeSession.location_name || "Saha Taraması"}
              </h2>
              <p className="text-orange-100 text-sm mt-1">
                Yöntem: {activeSession.risk_method.toUpperCase()} —{" "}
                {formatDuration(activeSession.duration_seconds)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black">
                {activeSession.total_risks_found}
              </p>
              <p className="text-orange-100 text-sm">Tespit Edilen Risk</p>
            </div>
          </div>
        </div>
      )}

      {/* Live detections feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection list */}
        <div className="lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">
            Gerçek Zamanlı Tespitler
          </h3>
          <div className="space-y-3">
            {detections.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg">Henüz tespit yok</p>
                <p className="text-sm mt-1">
                  Mobil uygulamadan tarama başlatın
                </p>
              </div>
            )}
            {detections.map((d) => (
              <div
                key={d.id}
                className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start gap-4 animate-in slide-in-from-top duration-300"
              >
                {d.screenshot_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={d.screenshot_url}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white"
                      style={{
                        backgroundColor:
                          LEVEL_COLORS[d.risk_level] || "#9ca3af",
                      }}
                    >
                      {LEVEL_LABELS[d.risk_level] || d.risk_level}
                    </span>
                    <span className="text-xs text-gray-400">
                      %{d.confidence} güven
                    </span>
                  </div>
                  <h4 className="font-semibold text-gray-900 truncate">
                    {d.risk_name}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {d.description}
                  </p>
                  {d.recommended_action && (
                    <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded-lg px-2 py-1">
                      {d.recommended_action}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(d.detected_at).toLocaleTimeString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary sidebar */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">
            Tarama Geçmişi
          </h3>
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      s.status === "active"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {s.status === "active" ? "Aktif" : "Tamamlandı"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(s.started_at).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <p className="font-medium text-gray-900 text-sm">
                  {s.location_name || "Saha Taraması"}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{s.total_risks_found} risk</span>
                  <span>{s.total_frames_analyzed} kare</span>
                  <span>{formatDuration(s.duration_seconds)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
