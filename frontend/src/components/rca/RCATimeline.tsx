"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Circle, Cpu, CheckCircle2 } from "lucide-react";

export interface TimelineEvent {
  timestamp: string;
  description: string;
  severity: "critical" | "warning" | "low" | "system" | "resolution";
  dimension?: string;
}

interface RCATimelineProps {
  events: TimelineEvent[];
}

const SEVERITY_META: Record<TimelineEvent["severity"], { color: string; bg: string; Icon: typeof AlertTriangle }> = {
  critical:   { color: "#D85A30", bg: "rgba(216,90,48,0.12)",   Icon: AlertTriangle },
  warning:    { color: "#EF9F27", bg: "rgba(239,159,39,0.12)",  Icon: AlertCircle },
  low:        { color: "#B4B2A9", bg: "rgba(180,178,169,0.18)", Icon: Circle },
  system:     { color: "#1E2761", bg: "rgba(30,39,97,0.12)",    Icon: Cpu },
  resolution: { color: "#1D9E75", bg: "rgba(29,158,117,0.12)",  Icon: CheckCircle2 },
};

export function RCATimeline({ events }: RCATimelineProps) {
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <Card aria-label="Olay zaman çizgisi">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Olay Zaman Çizgisi</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Henüz olay kaydı yok</div>
        ) : (
          <div className="relative pl-8">
            {/* Dikey çizgi */}
            <div className="absolute left-3 top-2 h-full w-0.5 bg-border" />
            <div className="space-y-4">
              {sorted.map((event, i) => {
                const m = SEVERITY_META[event.severity];
                const Icon = m.Icon;
                return (
                  <div key={i} className="relative">
                    {/* Dot */}
                    <span
                      className="absolute -left-8 top-1.5 inline-flex size-6 items-center justify-center rounded-full ring-4 ring-background"
                      style={{ background: m.color }}
                    >
                      <Icon className="size-3 text-white" />
                    </span>
                    {/* İçerik */}
                    <div className="rounded-lg border border-border p-3" style={{ background: m.bg }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold" style={{ color: m.color }}>
                          {event.timestamp}
                        </span>
                        {event.dimension && (
                          <span className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                            {event.dimension}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-foreground">{event.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
