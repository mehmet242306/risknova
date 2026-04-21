"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  filterNovaOutboxRows,
  getNovaOutboxRiskTone,
  getNovaOutboxSummary,
  getTaskQueueSummary,
  type NovaOutboxFilter,
} from "@/lib/self-healing/queue-monitoring";

type HealthCheckRow = {
  id: string;
  component_key: string;
  component_name: string;
  status: "healthy" | "degraded" | "down";
  latency_ms: number | null;
  summary: string | null;
  checked_at: string;
};

type ServiceStateRow = {
  id: string;
  service_key: string;
  display_name: string;
  circuit_state: "closed" | "open" | "half_open";
  failure_count: number;
  success_count: number;
  open_until: string | null;
  last_error: string | null;
};

type TaskQueueRow = {
  id: string;
  task_type: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  scheduled_at: string;
};

type NovaOutboxRow = {
  id: string;
  action_run_id: string;
  task_queue_id: string | null;
  status: "queued" | "processing" | "succeeded" | "failed" | "dead_letter" | "cancelled";
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
  payload: Record<string, unknown> | null;
};

type NovaOutboxEventRow = {
  id: string;
  outbox_id: string;
  action_run_id: string;
  task_queue_id: string | null;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type RecoveryScenarioRow = {
  id: string;
  scenario_key: string;
  name: string;
  description: string | null;
  last_status: string;
  last_triggered_at: string | null;
  run_count: number;
};

type BackupRunRow = {
  id: string;
  backup_type: string;
  status: string;
  storage_bucket: string | null;
  storage_path: string | null;
  checksum: string | null;
  started_at: string;
  completed_at: string | null;
  result?: Record<string, unknown> | null;
};

type DeploymentLogRow = {
  id: string;
  environment: string;
  status: string;
  smoke_test_status: string;
  commit_sha: string | null;
  branch: string | null;
  started_at: string;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SelfHealingTab() {
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [novaOutboxFilter, setNovaOutboxFilter] = useState<NovaOutboxFilter>("attention");
  const [healthChecks, setHealthChecks] = useState<HealthCheckRow[]>([]);
  const [serviceStates, setServiceStates] = useState<ServiceStateRow[]>([]);
  const [queueRows, setQueueRows] = useState<TaskQueueRow[]>([]);
  const [novaOutboxRows, setNovaOutboxRows] = useState<NovaOutboxRow[]>([]);
  const [novaOutboxEvents, setNovaOutboxEvents] = useState<NovaOutboxEventRow[]>([]);
  const [recoveryScenarios, setRecoveryScenarios] = useState<RecoveryScenarioRow[]>([]);
  const [backupRuns, setBackupRuns] = useState<BackupRunRow[]>([]);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLogRow[]>([]);

  async function load() {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase baglantisi kurulamadi.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [
      healthResult,
      stateResult,
      queueResult,
      novaOutboxResult,
      novaOutboxEventsResult,
      recoveryResult,
      backupResult,
      deploymentResult,
    ] = await Promise.all([
      supabase.from("health_checks").select("*").order("checked_at", { ascending: false }).limit(24),
      supabase.from("service_resilience_states").select("*").order("display_name"),
      supabase.from("task_queue").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("nova_outbox").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("nova_outbox_events").select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("recovery_scenarios").select("*").order("name"),
      supabase.from("backup_runs").select("*").order("started_at", { ascending: false }).limit(20),
      supabase.from("deployment_logs").select("*").order("started_at", { ascending: false }).limit(20),
    ]);

    const firstError =
      healthResult.error ||
      stateResult.error ||
      queueResult.error ||
      novaOutboxResult.error ||
      novaOutboxEventsResult.error ||
      recoveryResult.error ||
      backupResult.error ||
      deploymentResult.error;

    if (firstError) {
      setError(firstError.message);
    }

    setHealthChecks((healthResult.data ?? []) as HealthCheckRow[]);
    setServiceStates((stateResult.data ?? []) as ServiceStateRow[]);
    setQueueRows((queueResult.data ?? []) as TaskQueueRow[]);
    setNovaOutboxRows((novaOutboxResult.data ?? []) as NovaOutboxRow[]);
    setNovaOutboxEvents((novaOutboxEventsResult.data ?? []) as NovaOutboxEventRow[]);
    setRecoveryScenarios((recoveryResult.data ?? []) as RecoveryScenarioRow[]);
    setBackupRuns((backupResult.data ?? []) as BackupRunRow[]);
    setDeploymentLogs((deploymentResult.data ?? []) as DeploymentLogRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const latestChecks = useMemo(() => {
    const seen = new Map<string, HealthCheckRow>();
    for (const row of healthChecks) {
      if (!seen.has(row.component_key)) {
        seen.set(row.component_key, row);
      }
    }
    return Array.from(seen.values());
  }, [healthChecks]);

  const stats = useMemo(() => {
    const down = latestChecks.filter((row) => row.status === "down").length;
    const degraded = latestChecks.filter((row) => row.status === "degraded").length;
    const queueSummary = getTaskQueueSummary(queueRows);
    const novaSummary = getNovaOutboxSummary(novaOutboxRows);

    return {
      overall: down > 0 ? "down" : degraded > 0 ? "degraded" : "healthy",
      down,
      degraded,
      processingQueue: queueSummary.processing,
      failedQueue: queueSummary.failed,
      queuedTasks: queueSummary.queued,
      completedTasks: queueSummary.completed,
      novaDeadLetters: novaSummary.deadLetters,
      novaQueued: novaSummary.queued,
      novaProcessing: novaSummary.processing,
      novaNeedsAttention: novaSummary.needsAttention,
      novaCompleted: novaSummary.completed,
    };
  }, [latestChecks, novaOutboxRows, queueRows]);

  const filteredNovaOutboxRows = useMemo(
    () => filterNovaOutboxRows(novaOutboxRows, novaOutboxFilter),
    [novaOutboxFilter, novaOutboxRows],
  );

  const latestNovaOutboxEvents = useMemo(() => {
    const map = new Map<string, NovaOutboxEventRow>();
    for (const row of novaOutboxEvents) {
      if (!map.has(row.outbox_id)) {
        map.set(row.outbox_id, row);
      }
    }
    return map;
  }, [novaOutboxEvents]);

  async function triggerAction(key: string, url: string, body?: Record<string, unknown>) {
    try {
      setBusyAction(key);
      setError(null);
      setMessage(null);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Islem basarisiz.");
      }

      setMessage("Islem basariyla tamamlandi.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Bilinmeyen hata");
    } finally {
      setBusyAction(null);
    }
  }

  async function triggerQueueAction(taskId: string, action: "requeue" | "cancel") {
    try {
      setBusyAction(`${action}:${taskId}`);
      setError(null);
      setMessage(null);

      const response = await fetch(`/api/self-healing/queue/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Queue islemi basarisiz.");
      }

      setMessage(action === "requeue" ? "Gorev yeniden kuyruga alindi." : "Gorev iptal edildi.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Bilinmeyen hata");
    } finally {
      setBusyAction(null);
    }
  }

  async function triggerNovaOutboxAction(outboxId: string, action: "replay" | "cancel" | "resolve") {
    try {
      setBusyAction(`nova-outbox:${action}:${outboxId}`);
      setError(null);
      setMessage(null);

      const response = await fetch(`/api/self-healing/nova-outbox/${outboxId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Nova outbox islemi basarisiz.");
      }

      setMessage(
        action === "replay"
          ? "Nova aksiyonu yeniden kuyruga alindi."
          : action === "cancel"
            ? "Nova outbox islemi iptal edildi."
            : "Nova outbox kaydi incelendi olarak isaretlendi.",
      );
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Bilinmeyen hata");
    } finally {
      setBusyAction(null);
    }
  }

  async function triggerBackupRestore(backupRunId: string, dryRun = false) {
    try {
      setBusyAction(`restore:${backupRunId}:${dryRun ? "dry" : "live"}`);
      setError(null);
      setMessage(null);

      const response = await fetch(`/api/self-healing/backup/${backupRunId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Yedek geri yukleme basarisiz.");
      }

      setMessage(dryRun ? "Yedek dry-run dogrulamasi tamamlandi." : "Yedek geri yukleme baslatildi.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Bilinmeyen hata");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Self-Healing Kontrol Merkezi</h3>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Saglik kontrolleri, circuit breaker durumlari, kuyruk, recovery senaryolari ve yedek akislarini tek
              panelden izleyin. AI hizmeti duserse sistem manuel fallback ve queue moduna gecebilir.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-muted-foreground">Genel durum</div>
              <div className="mt-1 text-lg font-semibold uppercase text-foreground">{stats.overall}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-muted-foreground">Down</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{stats.down}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-muted-foreground">Queue processing</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{stats.processingQueue}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-muted-foreground">Queue queued</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{stats.queuedTasks}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-muted-foreground">Queue failed</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{stats.failedQueue}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-muted-foreground">Nova DLQ</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{stats.novaDeadLetters}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-muted-foreground">Nova attention</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{stats.novaNeedsAttention}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void triggerAction("health", "/api/health")}
            disabled={busyAction !== null}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busyAction === "health" ? "Saglik kontrolu calisiyor..." : "Saglik kontrolu calistir"}
          </button>
          <button
            type="button"
            onClick={() => void triggerAction("queue", "/api/self-healing/queue/process", { batchSize: 5 })}
            disabled={busyAction !== null}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
          >
            {busyAction === "queue" ? "Queue isleniyor..." : "Queue worker calistir"}
          </button>
          <button
            type="button"
            onClick={() =>
              void triggerAction("backup", "/api/self-healing/backup/run", {
                backupType: "manual_snapshot",
              })
            }
            disabled={busyAction !== null}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
          >
            {busyAction === "backup" ? "Yedek aliniyor..." : "Tek tik yedek al"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            {message}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h4 className="text-sm font-semibold text-foreground">Canli Saglik Durumu</h4>
          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Saglik verileri yukleniyor...
              </div>
            ) : latestChecks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Henuz health check kaydi yok.
              </div>
            ) : (
              latestChecks.map((row) => (
                <article key={row.id} className="rounded-xl border border-border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{row.component_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.summary || "-"}</div>
                    </div>
                    <div className="text-right">
                      <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium uppercase text-foreground">
                        {row.status}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">{row.latency_ms ?? 0} ms</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">{formatDateTime(row.checked_at)}</div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h4 className="text-sm font-semibold text-foreground">Circuit Breaker Durumlari</h4>
          <div className="mt-4 space-y-3">
            {serviceStates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Kayitli resilience state bulunmuyor.
              </div>
            ) : (
              serviceStates.map((row) => (
                <article key={row.id} className="rounded-xl border border-border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{row.display_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.service_key}</div>
                    </div>
                    <div className="text-right">
                      <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium uppercase text-foreground">
                        {row.circuit_state}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Hata: {row.failure_count} | Basari: {row.success_count}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Acilma sonu: {formatDateTime(row.open_until)}
                    {row.last_error ? ` | ${row.last_error}` : ""}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h4 className="text-sm font-semibold text-foreground">Recovery Senaryolari</h4>
          <div className="mt-4 space-y-3">
            {recoveryScenarios.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Recovery senaryosu bulunmuyor.
              </div>
            ) : (
              recoveryScenarios.map((row) => (
                <article key={row.id} className="rounded-xl border border-border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{row.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.description || row.scenario_key}</div>
                    </div>
                    <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium uppercase text-foreground">
                      {row.last_status}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Son tetik: {formatDateTime(row.last_triggered_at)} | Calisma sayisi: {row.run_count}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h4 className="text-sm font-semibold text-foreground">Task Queue</h4>
          <div className="mt-4 space-y-3">
            {queueRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Queue kaydi bulunmuyor.
              </div>
            ) : (
              queueRows.map((row) => (
                <article key={row.id} className="rounded-xl border border-border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{row.task_type}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Planlanan: {formatDateTime(row.scheduled_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium uppercase text-foreground">
                        {row.status}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Retry {row.retry_count}/{row.max_retries}
                      </div>
                    </div>
                  </div>
                  {row.error_message && (
                    <div className="mt-3 text-xs text-rose-600 dark:text-rose-300">{row.error_message}</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.status !== "completed" && row.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => void triggerQueueAction(row.id, "requeue")}
                        disabled={busyAction !== null}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-60"
                      >
                        {busyAction === `requeue:${row.id}` ? "Yeniden aliniyor..." : "Yeniden kuyruga al"}
                      </button>
                    )}
                    {row.status !== "completed" && row.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => void triggerQueueAction(row.id, "cancel")}
                        disabled={busyAction !== null}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        {busyAction === `cancel:${row.id}` ? "Iptal ediliyor..." : "Iptal et"}
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h4 className="text-sm font-semibold text-foreground">Nova Outbox ve DLQ</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Queued</div>
              <div className="mt-1 text-base font-semibold text-foreground">{stats.novaQueued}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Processing</div>
              <div className="mt-1 text-base font-semibold text-foreground">{stats.novaProcessing}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Attention</div>
              <div className="mt-1 text-base font-semibold text-foreground">{stats.novaNeedsAttention}</div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2">
              <div className="text-[11px] text-muted-foreground">Completed</div>
              <div className="mt-1 text-base font-semibold text-foreground">{stats.novaCompleted}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["attention", "Dikkat"],
              ["active", "Aktif"],
              ["completed", "Tamamlanan"],
              ["all", "Tumu"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setNovaOutboxFilter(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  novaOutboxFilter === value
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {filteredNovaOutboxRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Secili filtre icin Nova outbox kaydi bulunmuyor.
              </div>
            ) : (
              filteredNovaOutboxRows.map((row) => (
                <article
                  key={row.id}
                  className={`rounded-xl border bg-background/80 p-4 ${
                    getNovaOutboxRiskTone(row) === "danger"
                      ? "border-rose-300 dark:border-rose-800/50"
                      : getNovaOutboxRiskTone(row) === "warning"
                        ? "border-amber-300 dark:border-amber-800/50"
                        : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {String(row.payload?.action_title ?? row.payload?.action_name ?? row.action_run_id)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Action run: {row.action_run_id}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Queue task: {row.task_queue_id || "-"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase ${
                          row.status === "dead_letter"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                            : row.status === "failed"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                              : row.status === "queued" || row.status === "processing"
                                ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200"
                                : "bg-muted text-foreground"
                        }`}
                      >
                        {row.status}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Retry {row.retry_count}/{row.max_retries}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-1">
                      {row.task_queue_id ? "Queue bagli" : "Queue kaydi yok"}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1">
                      {row.retry_count >= row.max_retries ? "Retry limiti dolu" : "Retry acik"}
                    </span>
                  </div>
                  {row.last_error ? (
                    <div className="mt-3 text-xs text-rose-600 dark:text-rose-300">{row.last_error}</div>
                  ) : null}
                  {latestNovaOutboxEvents.get(row.id) ? (
                    <div className="mt-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
                      <div className="text-[11px] font-medium text-foreground">
                        Son olay: {latestNovaOutboxEvents.get(row.id)?.event_type}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {latestNovaOutboxEvents.get(row.id)?.message || "Mesaj yok"} -{" "}
                        {formatDateTime(latestNovaOutboxEvents.get(row.id)?.created_at ?? null)}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-3 text-xs text-muted-foreground">
                    Olusturuldu: {formatDateTime(row.created_at)} | Tamamlandi: {formatDateTime(row.completed_at)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(row.status === "failed" || row.status === "dead_letter") && (
                      <button
                        type="button"
                        onClick={() => void triggerNovaOutboxAction(row.id, "replay")}
                        disabled={busyAction !== null}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-60"
                      >
                        {busyAction === `nova-outbox:replay:${row.id}` ? "Replay ediliyor..." : "Replay et"}
                      </button>
                    )}
                    {row.last_error && (
                      <button
                        type="button"
                        onClick={() => void triggerNovaOutboxAction(row.id, "resolve")}
                        disabled={busyAction !== null}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                      >
                        {busyAction === `nova-outbox:resolve:${row.id}` ? "Isaretleniyor..." : "Incelendi isaretle"}
                      </button>
                    )}
                    {row.status !== "cancelled" && row.status !== "succeeded" && (
                      <button
                        type="button"
                        onClick={() => void triggerNovaOutboxAction(row.id, "cancel")}
                        disabled={busyAction !== null}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        {busyAction === `nova-outbox:cancel:${row.id}` ? "Iptal ediliyor..." : "Outbox iptal et"}
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h4 className="text-sm font-semibold text-foreground">Yedek Calismalari</h4>
          <div className="mt-4 space-y-3">
            {backupRuns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Henuz yedek alinmamis.
              </div>
            ) : (
              backupRuns.map((row) => (
                <article key={row.id} className="rounded-xl border border-border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{row.backup_type}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.storage_bucket || "-"} / {row.storage_path || "-"}
                      </div>
                    </div>
                    <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium uppercase text-foreground">
                      {row.status}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Baslangic: {formatDateTime(row.started_at)} | Bitis: {formatDateTime(row.completed_at)}
                  </div>
                  {row.checksum && (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Checksum: <span className="font-mono">{row.checksum.slice(0, 16)}...</span>
                    </div>
                  )}
                  {row.status === "completed" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void triggerBackupRestore(row.id, true)}
                        disabled={busyAction !== null}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-60"
                      >
                        {busyAction === `restore:${row.id}:dry` ? "Dogrulaniyor..." : "Dry-run kontrolu"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void triggerBackupRestore(row.id)}
                        disabled={busyAction !== null}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                      >
                        {busyAction === `restore:${row.id}:live` ? "Geri yukleniyor..." : "Yedegi geri yukle"}
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h4 className="text-sm font-semibold text-foreground">Deployment Loglari</h4>
          <div className="mt-4 space-y-3">
            {deploymentLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Deployment log kaydi bulunmuyor.
              </div>
            ) : (
              deploymentLogs.map((row) => (
                <article key={row.id} className="rounded-xl border border-border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {row.environment} | {row.branch || "branch yok"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Commit: {row.commit_sha || "-"}</div>
                    </div>
                    <div className="text-right">
                      <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium uppercase text-foreground">
                        {row.status}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Smoke: {row.smoke_test_status}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">{formatDateTime(row.started_at)}</div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
