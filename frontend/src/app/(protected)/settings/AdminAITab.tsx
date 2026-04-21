"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/* ── Types ── */
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tokens?: { input: number; output: number };
  qaId?: string;
  feedback?: "good" | "bad" | null;
};

const STORAGE_KEY = "risknova_admin_ai_history";

/* ── Quick actions ── */
const quickActions = [
  { label: "Firma risk ozeti", prompt: "Platformdaki firmalarin genel risk durumunu ozetle. Hangi firmalar dikkat gerektiriyor?" },
  { label: "Mevzuat guncelleme", prompt: "Son donemde Turk ISG mevzuatinda onemli degisiklikler neler? Dikkat etmem gereken guncellemeler var mi?" },
  { label: "Egitim plani onerisi", prompt: "Calisanlara yonelik yillik ISG egitim plani onerisi hazirla. Zorunlu egitimler ve surelerini belirt." },
  { label: "Denetim hazirligi", prompt: "Calisma Bakanligi denetimine hazirlanmak icin yapilmasi gereken islemlerin kontrol listesini olustur." },
  { label: "Acil durum plani", prompt: "Genel bir isyeri acil durum eylem plani tasarla. Deprem, yangin ve dogal afet senaryolarini icerecek sekilde." },
  { label: "DÖF sureci", prompt: "Duzeltici ve Onleyici Faaliyet (DOF) surecini adim adim anlat. Kok neden analizi nasil yapilir?" },
];

/* ── Markdown-lite renderer ── */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={key++} className="my-1 ml-4 list-disc space-y-0.5 text-sm leading-relaxed">
        {listBuffer.map((li, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(li) }} />)}
      </ul>
    );
    listBuffer = [];
  }

  function inlineFormat(s: string): string {
    return s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, '<code class="rounded bg-slate-200 px-1 py-0.5 text-xs dark:bg-slate-700">$1</code>');
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listBuffer.push(trimmed.slice(2));
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\d+\.\s/, ""));
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      elements.push(<h4 key={key++} className="mt-3 mb-1 text-sm font-bold text-foreground">{trimmed.slice(4)}</h4>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h3 key={key++} className="mt-3 mb-1 text-base font-bold text-foreground">{trimmed.slice(3)}</h3>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h2 key={key++} className="mt-3 mb-1 text-lg font-bold text-foreground">{trimmed.slice(2)}</h2>);
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={key++} className="my-1 border-l-2 border-[var(--accent)] pl-3 text-sm italic text-muted-foreground" dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed.slice(2)) }} />
      );
    } else if (trimmed === "") {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(<p key={key++} className="text-sm leading-relaxed text-foreground" dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />);
    }
  }
  flushList();
  return elements;
}

/* ── Main Component ── */
type KnowledgeItem = { id: string; title: string; category: string; keyPointCount: number };
type NovaFeatureFlagRow = {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  organization_id: string | null;
  workspace_id: string | null;
  is_enabled: boolean;
  rollout_percentage: number;
  config: Record<string, unknown> | null;
};

type NovaEvalRunRow = {
  id: string;
  suite_key: string;
  case_key: string;
  category: string;
  score: number;
  passed: boolean;
  latency_ms: number | null;
  failure_reason: string | null;
  created_at: string;
};

export function AdminAITab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [totalTokens, setTotalTokens] = useState({ input: 0, output: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ── Ogrenme paneli state ── */
  const [showLearnPanel, setShowLearnPanel] = useState(false);
  const [learnUrl, setLearnUrl] = useState("");
  const [isLearning, setIsLearning] = useState(false);
  const [learnStatus, setLearnStatus] = useState("");
  const [learnedItems, setLearnedItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [featureFlags, setFeatureFlags] = useState<NovaFeatureFlagRow[]>([]);
  const [evalRuns, setEvalRuns] = useState<NovaEvalRunRow[]>([]);
  const [governanceStatus, setGovernanceStatus] = useState("");
  const [savingFlagKey, setSavingFlagKey] = useState<string | null>(null);
  const [runningBenchmarks, setRunningBenchmarks] = useState(false);

  // Bilgi tabani sayisini yukle
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { count } = await supabase.from("ai_knowledge_base").select("*", { count: "exact", head: true });
      if (count != null) setKnowledgeCount(count);
    })();
  }, [learnedItems]);

  const loadGovernanceData = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    const [{ data: flags }, { data: evalRows }] = await Promise.all([
      supabase.from("nova_feature_flags").select("*").order("feature_key"),
      supabase.from("nova_eval_runs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    setFeatureFlags((flags ?? []) as NovaFeatureFlagRow[]);
    setEvalRuns((evalRows ?? []) as NovaEvalRunRow[]);
  }, []);

  useEffect(() => {
    void loadGovernanceData();
  }, [loadGovernanceData]);

  const updateFeatureFlag = useCallback(async (flag: NovaFeatureFlagRow, patch: Partial<NovaFeatureFlagRow>) => {
    const supabase = createClient();
    if (!supabase) return;

    try {
      setSavingFlagKey(flag.feature_key);
      setGovernanceStatus("");
      const { error } = await supabase
        .from("nova_feature_flags")
        .update({
          is_enabled: patch.is_enabled ?? flag.is_enabled,
          rollout_percentage: patch.rollout_percentage ?? flag.rollout_percentage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", flag.id);

      if (error) throw error;
      setGovernanceStatus(`${flag.display_name} guncellendi.`);
      await loadGovernanceData();
    } catch (err) {
      setGovernanceStatus(`Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
    } finally {
      setSavingFlagKey(null);
    }
  }, [loadGovernanceData]);

  const runBenchmarks = useCallback(async () => {
    try {
      setRunningBenchmarks(true);
      setGovernanceStatus("");
      const response = await fetch("/api/admin-ai/nova-benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suiteKey: "core" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((payload as { error?: string; message?: string }).error ?? (payload as { message?: string }).message ?? "Benchmark kosusu basarisiz");
      }

      setGovernanceStatus(
        `Benchmark tamamlandi. ${(payload as { passed?: number }).passed ?? 0}/${(payload as { total?: number }).total ?? 0} vaka gecti.`,
      );
      await loadGovernanceData();
    } catch (err) {
      setGovernanceStatus(`Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
    } finally {
      setRunningBenchmarks(false);
    }
  }, [loadGovernanceData]);

  // URL'den ogren
  const learnFromUrl = useCallback(async () => {
    if (!learnUrl.trim() || isLearning) return;
    setIsLearning(true);
    setLearnStatus("Site icerigi okunuyor...");

    try {
      const form = new FormData();
      form.append("type", "url");
      form.append("url", learnUrl.trim());

      const res = await fetch("/api/admin-ai/learn", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Bilinmeyen hata" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json() as { knowledge: KnowledgeItem };
      setLearnedItems((prev) => [data.knowledge, ...prev]);
      setLearnStatus(`"${data.knowledge.title}" basariyla ogrendi! (${data.knowledge.keyPointCount} anahtar bilgi)`);
      setLearnUrl("");
    } catch (err) {
      setLearnStatus(`Hata: ${err instanceof Error ? err.message : "Bilinmeyen"}`);
    } finally {
      setIsLearning(false);
    }
  }, [learnUrl, isLearning]);

  // PDF'den ogren
  const learnFromPdf = useCallback(async (file: File) => {
    if (isLearning) return;
    setIsLearning(true);
    setLearnStatus(`"${file.name}" okunuyor...`);

    try {
      const form = new FormData();
      form.append("type", "pdf");
      form.append("file", file);

      const res = await fetch("/api/admin-ai/learn", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Bilinmeyen hata" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json() as { knowledge: KnowledgeItem };
      setLearnedItems((prev) => [data.knowledge, ...prev]);
      setLearnStatus(`"${data.knowledge.title}" basariyla ogrendi! (${data.knowledge.keyPointCount} anahtar bilgi)`);
    } catch (err) {
      setLearnStatus(`Hata: ${err instanceof Error ? err.message : "Bilinmeyen"}`);
    } finally {
      setIsLearning(false);
    }
  }, [isLearning]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        setMessages(parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })));
      }
    } catch { /* ignore */ }
  }, []);

  // Save history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); // son 50 mesaj
    }
  }, [messages]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // History for API (last 10 messages)
      const historyForApi = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Get userId
      let userId: string | undefined;
      try {
        const supabase = createClient();
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        }
      } catch { /* ignore */ }

      const res = await fetch("/api/admin-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          history: historyForApi,
          userId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Bilinmeyen hata" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json() as { response: string; usage?: { inputTokens: number; outputTokens: number }; qaId?: string };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        tokens: data.usage ? { input: data.usage.inputTokens, output: data.usage.outputTokens } : undefined,
        qaId: data.qaId ?? undefined,
        feedback: null,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.usage) {
        setTotalTokens((prev) => ({
          input: prev.input + data.usage!.inputTokens,
          output: prev.output + data.usage!.outputTokens,
        }));
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Hata olustu: ${err instanceof Error ? err.message : "Bilinmeyen hata"}. Lutfen tekrar deneyin.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages]);

  // Geri bildirim
  const sendFeedback = useCallback(async (msgId: string, qaId: string, score: "good" | "bad") => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, feedback: score } : m));

    try {
      const supabase = createClient();
      if (!supabase) return;
      await supabase
        .from("ai_qa_learning")
        .update({ user_feedback_score: score === "good" ? 1.0 : 0.0, expert_verified: score === "good" })
        .eq("id", qaId);
    } catch { /* ignore */ }
  }, []);

  function clearHistory() {
    setMessages([]);
    setTotalTokens({ input: 0, output: 0 });
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px] flex-col rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white">N</div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Nova AI</h3>
            <p className="text-xs text-muted-foreground">RiskNova&apos;nın yerleşik yapay zekası</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {totalTokens.input > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground dark:bg-slate-800">
              {((totalTokens.input + totalTokens.output) / 1000).toFixed(1)}k token
            </span>
          )}
          {knowledgeCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {knowledgeCount} bilgi
            </span>
          )}
          <Button
            type="button"
            variant={showLearnPanel ? "accent" : "outline"}
            onClick={() => setShowLearnPanel(!showLearnPanel)}
            className="h-7 px-2 text-xs"
          >
            {showLearnPanel ? "Kapat" : "Ogret"}
          </Button>
          <Button type="button" variant="ghost" onClick={clearHistory} className="h-7 px-2 text-xs">Temizle</Button>
        </div>
      </div>

      {/* Ogrenme paneli */}
      {showLearnPanel && (
        <div className="border-b border-border px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* URL'den ogren */}
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">WEB SİTESİNDEN ÖĞREN</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={learnUrl}
                  onChange={(e) => setLearnUrl(e.target.value)}
                  placeholder="https://www.mevzuat.gov.tr/..."
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                  onKeyDown={(e) => { if (e.key === "Enter") learnFromUrl(); }}
                />
                <Button type="button" variant="accent" disabled={!learnUrl.trim() || isLearning} onClick={learnFromUrl} className="h-auto px-3 text-xs">
                  {isLearning ? "..." : "Ogren"}
                </Button>
              </div>
            </div>

            {/* PDF'den ogren */}
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">PDF&apos;DEN ÖĞREN</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) learnFromPdf(f); e.target.value = ""; }}
              />
              <Button type="button" variant="outline" disabled={isLearning} onClick={() => fileInputRef.current?.click()} className="w-full text-xs">
                {isLearning ? "Okunuyor..." : "PDF Yukle ve Ogren"}
              </Button>
            </div>
          </div>

          {/* Durum mesaji */}
          {learnStatus && (
            <p className={`mt-3 text-xs ${learnStatus.startsWith("Hata") ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
              {learnStatus}
            </p>
          )}

          {/* Son ogrenilenler */}
          {learnedItems.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground">SON OGRENİLENLER</p>
              {learnedItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">{item.category}</span>
                  <span className="truncate text-foreground">{item.title}</span>
                  <span className="flex-shrink-0 text-muted-foreground">({item.keyPointCount} bilgi)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border-b border-border px-5 py-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Tenant Rollout</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Nova chat, confirmation, async execution ve benchmark akislari icin canli rollout kontrolu.
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {featureFlags.length === 0 ? (
                <div className="text-sm text-muted-foreground">Feature flag verisi bulunamadi.</div>
              ) : (
                featureFlags.map((flag) => (
                  <div key={flag.id} className="rounded-xl border border-border bg-card px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{flag.display_name}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{flag.feature_key}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void updateFeatureFlag(flag, { is_enabled: !flag.is_enabled })}
                        disabled={savingFlagKey !== null}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          flag.is_enabled
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {savingFlagKey === flag.feature_key ? "Kaydediliyor..." : flag.is_enabled ? "Acik" : "Kapali"}
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={flag.rollout_percentage}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          setFeatureFlags((prev) =>
                            prev.map((item) =>
                              item.id === flag.id ? { ...item, rollout_percentage: nextValue } : item,
                            ),
                          );
                        }}
                        className="flex-1"
                      />
                      <span className="w-12 text-right text-xs font-medium text-foreground">%{flag.rollout_percentage}</span>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        disabled={savingFlagKey !== null}
                        onClick={() => {
                          const currentFlag = featureFlags.find((item) => item.id === flag.id) ?? flag;
                          void updateFeatureFlag(currentFlag, {
                            rollout_percentage: currentFlag.rollout_percentage,
                          });
                        }}
                      >
                        Kaydet
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Eval ve Benchmark</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Core benchmark suiti ile Nova davranisini kalite ve latency ekseninde olc.
                </p>
              </div>
              <Button type="button" variant="accent" disabled={runningBenchmarks} onClick={runBenchmarks} className="h-8 px-3 text-xs">
                {runningBenchmarks ? "Kosuyor..." : "Benchmark Calistir"}
              </Button>
            </div>
            {governanceStatus && (
              <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                governanceStatus.startsWith("Hata")
                  ? "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              }`}>
                {governanceStatus}
              </div>
            )}
            <div className="mt-3 space-y-3">
              {evalRuns.length === 0 ? (
                <div className="text-sm text-muted-foreground">Benchmark gecmisi bulunmuyor.</div>
              ) : (
                evalRuns.slice(0, 6).map((row) => (
                  <div key={row.id} className="rounded-xl border border-border bg-card px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-foreground">{row.case_key}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {row.category} - {new Date(row.created_at).toLocaleString("tr-TR")}
                        </div>
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        row.passed
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      }`}>
                        {row.score}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.latency_ms ?? 0} ms
                      {row.failure_reason ? ` - ${row.failure_reason}` : " - basarili"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] text-2xl font-bold text-white shadow-lg">
              N
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nova AI</h3>
            <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
              Merhaba! Ben Nova AI, RiskNova platformunun yapay zekasiyim. ISG mevzuati, risk degerlendirmesi, platform yonetimi ve teknik konularda yardimci olabilirim.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickActions.map((qa) => (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => sendMessage(qa.prompt)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-[var(--accent)] hover:bg-amber-50 dark:hover:bg-amber-950"
                >
                  {qa.label}
                </button>
              ))}
            </div>

            {/* Erişim bilgisi */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Platform Verileri", "Mevzuat Bilgisi", "ISG Uzmanligi", "Surekli Ogrenme", "Geri Bildirim", "Kalici Hafiza"].map((cap) => (
                <span key={cap} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-[var(--accent)] text-white"
                }`}>
                  {msg.role === "user" ? "S" : "N"}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 border border-border"
                }`}>
                  {msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div>{renderMarkdown(msg.content)}</div>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] opacity-50">
                      {msg.timestamp.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {msg.tokens && (
                      <span className="text-[10px] opacity-40">{msg.tokens.input + msg.tokens.output} tok</span>
                    )}
                    {/* Geri bildirim butonlari (sadece AI mesajlari icin) */}
                    {msg.role === "assistant" && msg.qaId && (
                      <span className="ml-1 flex items-center gap-1">
                        {msg.feedback === "good" ? (
                          <span className="text-[10px] text-emerald-500">Faydali olarak isaretlendi</span>
                        ) : msg.feedback === "bad" ? (
                          <span className="text-[10px] text-red-400">Gelistirilmeli olarak isaretlendi</span>
                        ) : (
                          <>
                            <button type="button" onClick={() => sendFeedback(msg.id, msg.qaId!, "good")} className="rounded px-1 text-[10px] text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900 dark:hover:text-emerald-300" title="Faydali">👍</button>
                            <button type="button" onClick={() => sendFeedback(msg.id, msg.qaId!, "bad")} className="rounded px-1 text-[10px] text-muted-foreground hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900 dark:hover:text-red-300" title="Gelistirilmeli">👎</button>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">AI</div>
                <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--accent)]" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border px-5 py-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Sorunuzu yazin... (Enter ile gonderin)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <Button
            type="button"
            variant="accent"
            disabled={!input.trim() || isLoading}
            onClick={() => sendMessage(input)}
            className="h-auto px-4"
          >
            Gonder
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Shift+Enter yeni satir. Nova AI sadece yoneticilere aciktir.
        </p>
      </div>
    </div>
  );
}
