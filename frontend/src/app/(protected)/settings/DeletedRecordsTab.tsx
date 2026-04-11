"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DeletedRecordRow = {
  source_table: string;
  record_id: string;
  label: string | null;
  organization_id: string | null;
  tenant_id: string | null;
  deleted_at: string;
  deleted_by: string | null;
  status: string | null;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDisplayName(value: string) {
  return value.replaceAll("_", " ");
}

export function DeletedRecordsTab() {
  const [rows, setRows] = useState<DeletedRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const deferredQuery = useDeferredValue(query.trim());

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

      const { data, error: rpcError } = await supabase.rpc("list_deleted_records", {
        p_query: deferredQuery || null,
        p_limit: 120,
      });

      if (cancelled) return;

      if (rpcError) {
        setRows([]);
        setError(rpcError.message);
      } else {
        setRows((data ?? []) as DeletedRecordRow[]);
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  async function restoreRow(row: DeletedRecordRow) {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase istemcisi olusturulamadi.");
      return;
    }

    setRestoringId(row.record_id);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("restore_deleted_record", {
      p_table_name: row.source_table,
      p_record_id: row.record_id,
    });

    if (rpcError || data !== true) {
      setRestoringId(null);
      setError(rpcError?.message ?? "Kayit geri yuklenemedi.");
      return;
    }

    startTransition(() => {
      setRows((current) => current.filter((item) => item.record_id !== row.record_id));
      setRestoringId(null);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Silinmis Kayitlar</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Soft delete ile gizlenen kayitlari buradan gorebilir ve gerekiyorsa geri yukleyebilirsiniz.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          {rows.length} kayit
        </div>
      </div>

      <div className="mt-5">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kayit adi, tablo veya durum ara"
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Silinmis kayitlar yukleniyor...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            Geri yuklenebilir silinmis kayit bulunmadi.
          </div>
        ) : (
          rows.map((row) => (
            <article key={`${row.source_table}-${row.record_id}`} className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                      {toDisplayName(row.source_table)}
                    </span>
                    {row.status && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        {row.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-sm font-medium text-foreground">
                    {row.label || row.record_id}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(row.deleted_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void restoreRow(row)}
                  disabled={restoringId === row.record_id}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoringId === row.record_id ? "Geri Yukleniyor..." : "Geri Yukle"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
