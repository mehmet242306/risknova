"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { fetchDeckById, fetchSlides, type SlideDeck, type Slide } from "@/lib/supabase/slide-deck-api";

type Session = {
  id: string;
  viewer_name: string | null;
  viewer_email: string | null;
  started_at: string;
  ended_at: string | null;
  total_duration_seconds: number;
  slides_viewed: number;
  completed: boolean;
};

type SlideStat = {
  slide_id: string;
  slide_order: number;
  avg_seconds: number;
  total_views: number;
};

export function DeckAnalyticsClient({ deckId }: { deckId: string }) {
  const [deck, setDeck] = useState<SlideDeck | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [slideStats, setSlideStats] = useState<SlideStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }

      const [d, s] = await Promise.all([fetchDeckById(deckId), fetchSlides(deckId)]);
      setDeck(d);
      setSlides(s);

      // Sessions
      const { data: sessData } = await supabase
        .from("slide_deck_sessions")
        .select("*")
        .eq("deck_id", deckId)
        .order("started_at", { ascending: false })
        .limit(50);
      setSessions((sessData as Session[]) || []);

      // Slide stats (avg time per slide)
      const { data: events } = await supabase
        .from("slide_view_events")
        .select("slide_id, slide_order, time_spent_seconds")
        .in("session_id", (sessData || []).map((s: any) => s.id));

      if (events) {
        const bySlide = new Map<string, { total: number; count: number; order: number }>();
        for (const e of events as any[]) {
          if (!e.slide_id) continue;
          const existing = bySlide.get(e.slide_id);
          if (existing) {
            existing.total += e.time_spent_seconds || 0;
            existing.count += 1;
          } else {
            bySlide.set(e.slide_id, {
              total: e.time_spent_seconds || 0,
              count: 1,
              order: e.slide_order || 0,
            });
          }
        }
        const stats: SlideStat[] = Array.from(bySlide.entries()).map(([slide_id, v]) => ({
          slide_id,
          slide_order: v.order,
          avg_seconds: v.count > 0 ? Math.round(v.total / v.count) : 0,
          total_views: v.count,
        }));
        stats.sort((a, b) => a.slide_order - b.slide_order);
        setSlideStats(stats);
      }

      setLoading(false);
    })();
  }, [deckId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-sm text-[var(--muted-foreground)]">Analitik yükleniyor...</div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-sm text-[var(--muted-foreground)]">Deck bulunamadı</div>
      </div>
    );
  }

  // Stats
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.completed).length;
  const avgDuration = sessions.length > 0
    ? Math.round(sessions.reduce((a, s) => a + (s.total_duration_seconds || 0), 0) / sessions.length)
    : 0;
  const avgSlidesViewed = sessions.length > 0
    ? Math.round(sessions.reduce((a, s) => a + (s.slides_viewed || 0), 0) / sessions.length)
    : 0;
  const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const maxAvgSeconds = Math.max(1, ...slideStats.map((s) => s.avg_seconds));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/training/slides/${deckId}/edit`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--foreground)]">{deck.title}</h1>
            <p className="text-xs text-[var(--muted-foreground)]">Sunum Analitiği</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Toplam İzlenme" value={totalSessions} icon="👁️" color="#3B82F6" />
          <StatCard label="Tamamlanma" value={`${completionRate}%`} icon="✅" color="#10B981" />
          <StatCard label="Ort. Süre" value={formatDuration(avgDuration)} icon="⏱️" color="#F97316" />
          <StatCard label="Ort. Slayt/İzlenme" value={`${avgSlidesViewed}/${slides.length}`} icon="📊" color="#8B5CF6" />
        </div>

        {/* Slide heatmap */}
        <div className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">Slayt Başına Ortalama Süre</h2>
          {slideStats.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Henüz izlenme verisi yok. Sunum yapıldıkça burada görünecek.
            </div>
          ) : (
            <div className="space-y-2">
              {slides.map((slide, i) => {
                const stat = slideStats.find((s) => s.slide_id === slide.id);
                const avg = stat?.avg_seconds || 0;
                const widthPct = maxAvgSeconds > 0 ? (avg / maxAvgSeconds) * 100 : 0;
                return (
                  <div key={slide.id} className="flex items-center gap-3">
                    <div className="w-8 text-xs font-bold text-[var(--muted-foreground)]">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                          {(slide.content as any)?.title || `Slayt ${i + 1}`}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {formatDuration(avg)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--muted)]/20">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${widthPct}%`,
                            background: avg > maxAvgSeconds * 0.7 ? "#EF4444" : avg > maxAvgSeconds * 0.4 ? "#F59E0B" : "#10B981",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sessions list */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">Son İzlenmeler</h2>
          {sessions.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Henüz izlenme kaydı yok
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--muted)]/20 text-sm">
                      {s.completed ? "✅" : "⏳"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        {s.viewer_name || s.viewer_email || "Anonim İzleyici"}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        {new Date(s.started_at).toLocaleString("tr-TR")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-[var(--foreground)]">
                      {s.slides_viewed}/{slides.length} slayt
                    </div>
                    {s.ended_at && (
                      <div className="text-[10px] text-[var(--muted-foreground)]">
                        {formatDuration(Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl">{icon}</div>
        <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      </div>
      <div className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}dk`;
  return `${m}dk ${s}s`;
}
