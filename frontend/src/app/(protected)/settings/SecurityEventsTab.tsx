"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SecurityEventRow = {
  id: string;
  created_at: string;
  event_type: string;
  severity: "info" | "warning" | "critical";
  endpoint: string | null;
  ip_address: string | null;
  user_agent: string | null;
  organization_id: string | null;
  user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  details: Record<string, unknown> | null;
};

const severityOptions = [
  { value: "all", label: "Tum seviyeler" },
  { value: "info", label: "Bilgi" },
  { value: "warning", label: "Uyari" },
  { value: "critical", label: "Kritik" },
];

const eventOptions = [
  { value: "all", label: "Tum olaylar" },
  { value: "rate_limit.exceeded", label: "Rate limit ihlali" },
  { value: "auth.login_failed", label: "Basarisiz giris" },
  { value: "auth.login_succeeded", label: "Giris basarili" },
  { value: "ai.admin.failed", label: "Admin AI hatasi" },
  { value: "ai.document.failed", label: "Dokuman AI hatasi" },
  { value: "ai.training.failed", label: "Egitim AI hatasi" },
  { value: "ai.analyze_risk.failed", label: "Risk AI hatasi" },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SecurityEventsTab() {
  const [rows, setRows] = useState<SecurityEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("all");
  const [severity, setSeverity] = useState("all");

  const deferredQuery = useDeferredValue(query.trim());
  const deferredEventType = useDeferredValue(eventType);
  const deferredSeverity = useDeferredValue(severity);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
          setError("Supabase baglantisi kurulamadi.");
        }
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc("search_security_events", {
        p_query: deferredQuery || null,
        p_event_type: deferredEventType === "all" ? null : deferredEventType,
        p_severity: deferredSeverity === "all" ? null : deferredSeverity,
        p_limit: 150,
      });

      if (cancelled) return;

      if (rpcError) {
        setRows([]);
        setError(rpcError.message);
      } else {
        setRows((data ?? []) as SecurityEventRow[]);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [deferredEventType, deferredQuery, deferredSeverity]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      rateLimit: rows.filter((row) => row.event_type === "rate_limit.exceeded").length,
      critical: rows.filter((row) => row.severity === "critical").length,
      auth: rows.filter((row) => row.event_type.startsWith("auth.")).length,
    }),
    [rows],
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Guvenlik Olaylari</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Basarisiz girisler, rate limit ihlalleri ve AI/API hata akislarini buradan izleyebilirsiniz.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-muted-foreground">
            <div>Toplam</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-muted-foreground">
            <div>Rate limit</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{stats.rateLimit}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-muted-foreground">
            <div>Kritik</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{stats.critical}</div>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-muted-foreground">
            <div>Auth</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{stats.auth}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_220px_180px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kullanici, endpoint veya olay tipi ara"
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
        />
        <select
          value={eventType}
          onChange={(event) => setEventType(event.target.value)}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
        >
          {eventOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
        >
          {severityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Guvenlik olaylari yukleniyor...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Secilen filtrelerle eslesen guvenlik olayi bulunmadi.
          </div>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      {row.event_type}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {row.severity}
                    </span>
                    {row.endpoint && (
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                        {row.endpoint}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-sm font-medium text-foreground">
                    {row.actor_name || row.actor_email || "Sistem olayi"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.actor_email || "Kullanici bilgisi yok"} · {formatDateTime(row.created_at)}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>IP: {row.ip_address || "-"}</div>
                  <div className="mt-1">{row.user_agent || "-"}</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-card p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detay</div>
                <pre className="mt-2 max-h-44 overflow-auto text-xs text-muted-foreground">
                  {JSON.stringify(row.details ?? {}, null, 2)}
                </pre>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
