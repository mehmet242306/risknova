"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuditLogRow = {
  id: string;
  created_at: string;
  action: string | null;
  entity_type: string;
  entity_id: string | null;
  severity: string;
  tenant_id: string | null;
  organization_id: string | null;
  user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  metadata_json: Record<string, unknown> | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
};

const severityOptions = [
  { value: "all", label: "Tum Seviyeler" },
  { value: "info", label: "Bilgi" },
  { value: "warning", label: "Uyari" },
  { value: "critical", label: "Kritik" },
];

const entityOptions = [
  { value: "all", label: "Tum Varliklar" },
  { value: "risk_assessments", label: "Risk Analizi" },
  { value: "user_profiles", label: "Kullanicilar" },
  { value: "company_trainings", label: "Egitimler" },
  { value: "company_periodic_controls", label: "Periyodik Kontroller" },
  { value: "editor_documents", label: "Dokumanlar" },
  { value: "incidents", label: "Olaylar" },
  { value: "slide_decks", label: "Sunumlar" },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function summarizeChange(row: AuditLogRow) {
  const oldCount = Object.keys(row.old_values ?? {}).length;
  const newCount = Object.keys(row.new_values ?? {}).length;

  if (row.action?.endsWith(".insert")) {
    return `${newCount} alan kaydedildi`;
  }
  if (row.action?.endsWith(".delete")) {
    return `${oldCount} alan silme oncesi yakalandi`;
  }
  if (oldCount === 0 && newCount === 0) {
    return "Ek veri yok";
  }
  return `${oldCount} once / ${newCount} sonra`;
}

export function AuditLogsTab() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [severity, setSeverity] = useState("all");

  const deferredQuery = useDeferredValue(query.trim());
  const deferredEntityType = useDeferredValue(entityType);
  const deferredSeverity = useDeferredValue(severity);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
          setError("Supabase ortam degiskenleri tanimli degil.");
        }
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc("search_audit_logs", {
        p_query: deferredQuery || null,
        p_entity_type: deferredEntityType === "all" ? null : deferredEntityType,
        p_severity: deferredSeverity === "all" ? null : deferredSeverity,
        p_limit: 120,
      });

      if (cancelled) return;

      if (rpcError) {
        setRows([]);
        setError(rpcError.message);
      } else {
        setRows((data ?? []) as AuditLogRow[]);
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [deferredEntityType, deferredQuery, deferredSeverity]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Denetim Loglari</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Veritabanindan otomatik toplanan degisiklik kayitlarini burada filtreleyip inceleyebilirsiniz.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          {rows.length} kayit
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_220px_180px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Aksiyon, kisi, e-posta veya kayit ara"
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
        />
        <select
          value={entityType}
          onChange={(event) => setEntityType(event.target.value)}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
        >
          {entityOptions.map((option) => (
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
            Loglar yukleniyor...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Secilen filtrelerle eslesen audit kaydi bulunmadi.
          </div>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      {row.action ?? "degisiklik"}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                      {row.entity_type}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {row.severity}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-medium text-foreground">
                    {row.actor_name || row.actor_email || "Sistem islemi"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.actor_email || "Kimlik bilgisi yok"} · {formatDateTime(row.created_at)}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Kayit No: {row.entity_id || row.id}</div>
                  <div className="mt-1">{summarizeChange(row)}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Once</div>
                  <pre className="mt-2 max-h-44 overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(row.old_values ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-border/70 bg-card p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sonra</div>
                  <pre className="mt-2 max-h-44 overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(row.new_values ?? row.metadata_json ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
