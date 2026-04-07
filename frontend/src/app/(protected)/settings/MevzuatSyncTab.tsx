"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface LegalDoc {
  id: string;
  title: string;
  doc_type: string;
  doc_number: string;
  source_url: string | null;
  last_synced_at: string | null;
  chunk_count: number;
}

/* ------------------------------------------------------------------ */
/* MevzuatSyncTab                                                      */
/* ------------------------------------------------------------------ */

export function MevzuatSyncTab() {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data, error } = await supabase.functions.invoke("sync-mevzuat", {
        body: { action: "list" },
      });

      if (error) {
        console.error("[MevzuatSync] list error:", error);
        return;
      }

      setDocs(data || []);
    } catch (err) {
      console.error("[MevzuatSync] load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function syncSingle(docId: string) {
    setSyncing(docId);
    setSyncResult(null);
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data, error } = await supabase.functions.invoke("sync-mevzuat", {
        body: { action: "sync_single", document_id: docId },
      });

      if (error) {
        // Try to extract detailed error from response
        let msg = error.message || "Hata";
        try {
          if (error.context?.body) {
            const text = await new Response(error.context.body).text();
            const parsed = JSON.parse(text);
            msg = parsed.error || msg;
          }
        } catch { /* ignore parse errors */ }
        setSyncResult({ id: docId, success: false, message: msg });
        return;
      }

      if (data?.error) {
        setSyncResult({ id: docId, success: false, message: data.error });
        return;
      }

      setSyncResult({
        id: docId,
        success: true,
        message: `${data.articles_added} madde eklendi`,
      });
      await loadDocs();
    } catch (err) {
      setSyncResult({
        id: docId,
        success: false,
        message: err instanceof Error ? err.message : "Bilinmeyen hata",
      });
    } finally {
      setSyncing(null);
    }
  }

  async function testConnection() {
    setTestResult(null);
    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data, error } = await supabase.functions.invoke("sync-mevzuat", {
        body: { action: "test" },
      });

      if (error) {
        setTestResult(`Hata: ${error.message}`);
        return;
      }
      setTestResult(`Basarili: ${data.message} (${data.timestamp})`);
    } catch (err) {
      setTestResult(`Hata: ${err instanceof Error ? err.message : "Bilinmeyen"}`);
    }
  }

  const totalChunks = docs.reduce((sum, d) => sum + d.chunk_count, 0);
  const syncedDocs = docs.filter((d) => d.chunk_count > 0);
  const unsyncedDocs = docs.filter((d) => d.chunk_count === 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-foreground">{docs.length}</p>
            <p className="text-xs text-muted-foreground">Toplam Mevzuat</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-emerald-500">{syncedDocs.length}</p>
            <p className="text-xs text-muted-foreground">Senkronize</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-amber-500">{unsyncedDocs.length}</p>
            <p className="text-xs text-muted-foreground">Bekleyen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-primary">{totalChunks.toLocaleString("tr-TR")}</p>
            <p className="text-xs text-muted-foreground">Toplam Chunk</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={testConnection} variant="outline" size="sm">
          Baglanti Testi
        </Button>
        <Button onClick={loadDocs} variant="outline" size="sm">
          Yenile
        </Button>
        {testResult && (
          <span className={cn("text-xs", testResult.startsWith("Basarili") ? "text-emerald-500" : "text-red-500")}>
            {testResult}
          </span>
        )}
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Synced docs */}
          {syncedDocs.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-foreground">Senkronize Edilmis ({syncedDocs.length})</h3>
              {syncedDocs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  syncing={syncing === doc.id}
                  syncResult={syncResult?.id === doc.id ? syncResult : null}
                  onSync={() => syncSingle(doc.id)}
                />
              ))}
            </>
          )}

          {/* Unsynced docs */}
          {unsyncedDocs.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-foreground">Senkronize Edilmemis ({unsyncedDocs.length})</h3>
              {unsyncedDocs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  syncing={syncing === doc.id}
                  syncResult={syncResult?.id === doc.id ? syncResult : null}
                  onSync={() => syncSingle(doc.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Doc row                                                             */
/* ------------------------------------------------------------------ */

function DocRow({
  doc,
  syncing,
  syncResult,
  onSync,
}: {
  doc: LegalDoc;
  syncing: boolean;
  syncResult: { success: boolean; message: string } | null;
  onSync: () => void;
}) {
  const typeLabel = doc.doc_type === "law" ? "Kanun" : "Yonetmelik";
  const hasSynced = doc.chunk_count > 0;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      {/* Type badge */}
      <Badge variant={doc.doc_type === "law" ? "accent" : "default"} className="shrink-0">
        {typeLabel}
      </Badge>

      {/* Title & meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>No: {doc.doc_number}</span>
          {hasSynced && (
            <>
              <span>|</span>
              <span className="text-emerald-500">{doc.chunk_count} chunk</span>
            </>
          )}
          {doc.last_synced_at && (
            <>
              <span>|</span>
              <span>
                Son:{" "}
                {new Date(doc.last_synced_at).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <span className={cn("text-xs", syncResult.success ? "text-emerald-500" : "text-red-500")}>
          {syncResult.message}
        </span>
      )}

      {/* Sync button */}
      <Button onClick={onSync} disabled={syncing} size="sm" variant={hasSynced ? "outline" : "primary"}>
        {syncing ? (
          <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : hasSynced ? (
          "Tekrar Senkronize Et"
        ) : (
          "Senkronize Et"
        )}
      </Button>
    </div>
  );
}
