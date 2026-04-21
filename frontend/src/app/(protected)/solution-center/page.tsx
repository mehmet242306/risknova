"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getActiveWorkspace, type WorkspaceRow } from "@/lib/supabase/workspace-api";
import { downloadDocument, type DocumentBlock } from "@/lib/document-generator";
import { useI18n } from "@/lib/i18n";
import { getNovaUiCopy, resolveNovaRuntimeErrorMessage } from "@/lib/nova-ui";
import type {
  NovaAgentResponse,
  NovaActionHint,
  NovaAgentSource,
  NovaDraftPayload,
  NovaSafetyBlock,
  NovaAgentToolPreview,
} from "@/lib/nova/agent";
import {
  getNovaProactiveBrief,
  markNovaWorkflowStep,
  type NovaProactiveBrief,
  type NovaFollowUpAction,
  type NovaWorkflowSummary,
} from "@/lib/supabase/nova-workflows";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Source {
  doc_title: string;
  doc_type: string;
  doc_number: string;
  article_number: string;
  article_title: string;
  citation_id?: string | null;
  corpus_scope?: "official" | "tenant_private" | null;
  jurisdiction_code?: string | null;
}

interface RetrievalTracePayload {
  id: string;
  query_text: string;
  as_of_date: string;
  answer_mode: "extractive" | "polish";
  retrieval_trace: {
    exact?: Array<Record<string, unknown>>;
    sparse?: Array<Record<string, unknown>>;
    dense?: Array<Record<string, unknown>>;
    reranked?: Array<Record<string, unknown>>;
  } | null;
  answer_preview?: string | null;
  confidence?: number | null;
  created_at?: string;
}

function normalizeDocumentBlocks(input: unknown): DocumentBlock[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.title !== "string" ||
      (record.type !== "docx" && record.type !== "pptx") ||
      typeof record.content !== "string"
    ) {
      return [];
    }

    return [
      {
        title: record.title,
        type: record.type,
        content: record.content,
      },
    ];
  });
}

function normalizeFollowUpActions(input: unknown): NovaFollowUpAction[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.label !== "string" ||
      (record.kind !== "navigate" && record.kind !== "prompt")
    ) {
      return [];
    }

    return [
      {
        id: record.id,
        label: record.label,
        kind: record.kind,
        description: typeof record.description === "string" ? record.description : null,
        url: typeof record.url === "string" ? record.url : null,
        prompt: typeof record.prompt === "string" ? record.prompt : null,
        workflow_run_id: typeof record.workflow_run_id === "string" ? record.workflow_run_id : null,
        workflow_step_id: typeof record.workflow_step_id === "string" ? record.workflow_step_id : null,
        status: typeof record.status === "string" ? record.status : null,
      },
    ];
  });
}

interface NavigationAction {
  action: "navigate";
  url: string;
  label: string;
  reason: string;
  destination: string;
  auto_navigate: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  documents?: DocumentBlock[];
  navigation?: NavigationAction | null;
  workflow?: NovaWorkflowSummary | null;
  followUpActions?: NovaFollowUpAction[];
  actionHint?: NovaActionHint | null;
  toolPreview?: NovaAgentToolPreview | null;
  draft?: NovaDraftPayload | null;
  safetyBlock?: NovaSafetyBlock | null;
  queryId?: string;
  retrievalRunId?: string | null;
  asOfDate?: string | null;
  answerMode?: "extractive" | "polish";
  timestamp: Date;
  saved?: boolean;
  feedback?: "positive" | "negative" | null;
}

/* ------------------------------------------------------------------ */
/* Markdown-lite renderer (bold, headers, lists, blockquote)           */
/* ------------------------------------------------------------------ */

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const k = key++;

    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={k} className="mt-4 mb-2 text-base font-semibold text-foreground">
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h4 key={k} className="mt-3 mb-1 text-sm font-semibold text-foreground">
          {line.slice(4)}
        </h4>,
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={k}
          className="my-2 border-l-3 border-primary/40 pl-3 text-sm italic text-muted-foreground"
        >
          {formatInline(line.slice(2))}
        </blockquote>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={k} className="ml-4 list-disc text-sm leading-7">
          {formatInline(line.slice(2))}
        </li>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={k} className="ml-4 list-decimal text-sm leading-7">
          {formatInline(line.replace(/^\d+\.\s/, ""))}
        </li>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={k} className="h-2" />);
    } else {
      elements.push(
        <p key={k} className="text-sm leading-7">
          {formatInline(line)}
        </p>,
      );
    }
  }

  return elements;
}

function formatInline(text: string): React.ReactNode {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/* ------------------------------------------------------------------ */
/* Source card                                                          */
/* ------------------------------------------------------------------ */

function SourceCard({ source }: { source: Source }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
        M
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-medium text-foreground">
            {source.doc_title}
          </p>
          {source.corpus_scope === "tenant_private" ? (
            <Badge variant="warning" className="shrink-0">
              Private
            </Badge>
          ) : (
            <Badge variant="success" className="shrink-0">
              Official
            </Badge>
          )}
        </div>
        {source.article_number && (
          <p className="truncate text-[11px] text-muted-foreground">
            Madde {source.article_number}
            {source.article_title ? ` — ${source.article_title}` : ""}
          </p>
        )}
        {source.jurisdiction_code ? (
          <p className="truncate text-[11px] text-muted-foreground">
            Jurisdiction: {source.jurisdiction_code}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TracePanel({
  trace,
  loading,
}: {
  trace: RetrievalTracePayload | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
        Retrieval trace yukleniyor...
      </div>
    );
  }

  if (!trace) return null;

  const sections = [
    { key: "exact", label: "Exact" },
    { key: "sparse", label: "Sparse" },
    { key: "dense", label: "Dense" },
    { key: "reranked", label: "Reranked" },
  ] as const;

  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="neutral">{trace.answer_mode}</Badge>
        <Badge variant="neutral">{trace.as_of_date}</Badge>
        {typeof trace.confidence === "number" ? (
          <Badge variant="success">{`confidence ${trace.confidence.toFixed(2)}`}</Badge>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {sections.map((section) => {
          const rows = Array.isArray(trace.retrieval_trace?.[section.key])
            ? trace.retrieval_trace?.[section.key] ?? []
            : [];

          return (
            <div key={section.key} className="rounded-lg border border-border bg-card px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {section.label}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{rows.length} aday</p>
              <div className="mt-2 space-y-2">
                {rows.slice(0, 3).map((row, index) => (
                  <div key={`${section.key}-${index}`} className="rounded-md bg-secondary/40 px-2 py-2">
                    <p className="text-xs font-medium text-foreground">
                      {String(row.law ?? row.doc_title ?? row.official_citation ?? "Kaynak")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {String(row.article ?? row.article_number ?? row.title ?? "")}
                    </p>
                  </div>
                ))}
                {rows.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Kayit yok.</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation card                                                     */
/* ------------------------------------------------------------------ */

function NavigationCard({ navigation, onNavigate }: { navigation: NavigationAction; onNavigate: (url: string) => void }) {
  const { locale } = useI18n();
  const ui = getNovaUiCopy(locale);

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">{ui.solutionCenter.navigationTitle}</span>
          </div>
          <p className="text-sm font-medium text-foreground">{navigation.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{navigation.reason}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(navigation.url)}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {ui.solutionCenter.gotoPage}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: NovaWorkflowSummary }) {
  const { locale } = useI18n();
  const ui = getNovaUiCopy(locale);
  const progress = workflow.total_steps > 0
    ? Math.min(100, Math.round((workflow.current_step / workflow.total_steps) * 100))
    : 0;

  return (
    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {ui.solutionCenter.workflowLabel}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {workflow.current_step}/{workflow.total_steps}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{workflow.title}</p>
          {workflow.summary && (
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{workflow.summary}</p>
          )}
          {workflow.next_step_label && (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              {ui.solutionCenter.nextStepLabel}: {workflow.next_step_label}
            </p>
          )}
        </div>
        <span className="rounded-full bg-card px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          {workflow.status}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-500/10">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function FollowUpActionsCard({
  actions,
  onNavigate,
  onPrompt,
}: {
  actions: NovaFollowUpAction[];
  onNavigate: (action: NovaFollowUpAction) => void;
  onPrompt: (action: NovaFollowUpAction) => void;
}) {
  const { locale } = useI18n();
  const ui = getNovaUiCopy(locale);

  if (!actions.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {ui.solutionCenter.nextStepsLabel}
        </span>
      </div>
      <div className="grid gap-2">
        {actions.map((action) => (
          <div key={action.id} className="rounded-xl border border-border bg-card px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{action.label}</p>
                {action.description && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => (action.kind === "navigate" ? onNavigate(action) : onPrompt(action))}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {action.kind === "navigate" ? ui.widget.openLabel : ui.widget.continueLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Document download card                                              */
/* ------------------------------------------------------------------ */

function DocumentDownloadCard({ doc }: { doc: DocumentBlock }) {
  const { locale } = useI18n();
  const ui = getNovaUiCopy(locale);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadDocument(doc);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  }

  const isPptx = doc.type === "pptx";

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
        "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50",
        downloading && "opacity-70 cursor-wait",
      )}
    >
      {/* Icon */}
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        isPptx ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500",
      )}>
        {isPptx ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
        <p className="text-xs text-muted-foreground">{ui.solutionCenter.documentType(isPptx, doc.type)}</p>
      </div>

      {/* Download indicator */}
      <div className="shrink-0">
        {downloading ? (
          <svg className="h-5 w-5 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : done ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Message bubble                                                      */
/* ------------------------------------------------------------------ */

function MessageBubble({
  message,
  onToggleSave,
  onFeedback,
  onNavigate,
  onFollowUpNavigate,
  onFollowUpPrompt,
  onActionDecision,
  actionInFlightId,
  onToggleTrace,
  traceOpen,
  trace,
  traceLoading,
}: {
  message: ChatMessage;
  onToggleSave?: (id: string) => void;
  onFeedback?: (id: string, feedback: "positive" | "negative") => void;
  onNavigate: (url: string) => void;
  onFollowUpNavigate: (action: NovaFollowUpAction) => void;
  onFollowUpPrompt: (action: NovaFollowUpAction) => void;
  onActionDecision: (action: NovaActionHint, decision: "confirm" | "cancel") => void;
  actionInFlightId?: string | null;
  onToggleTrace?: (message: ChatMessage) => void;
  traceOpen?: boolean;
  trace?: RetrievalTracePayload | null;
  traceLoading?: boolean;
}) {
  const { locale } = useI18n();
  const ui = getNovaUiCopy(locale);
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-primary",
        )}
      >
        {isUser ? "S" : "N"}
      </div>

      {/* Content */}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card shadow-[var(--shadow-soft)]",
        )}
      >
        {isUser ? (
          <p className="text-sm leading-7">{message.content}</p>
        ) : (
          <div className="space-y-0">{renderMarkdown(message.content)}</div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn("transition-transform", showSources && "rotate-90")}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {ui.solutionCenter.sourceCount(message.sources.length)}
            </button>
            {showSources && (
              <div className="mt-2 grid gap-1.5">
                {message.sources.map((s, i) => (
                  <SourceCard key={i} source={s} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Document download buttons */}
        {!isUser && message.documents && message.documents.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.documents.map((doc, i) => (
              <DocumentDownloadCard key={i} doc={doc} />
            ))}
          </div>
        )}

        {/* Navigation */}
        {!isUser && message.navigation && (
          <NavigationCard navigation={message.navigation} onNavigate={onNavigate} />
        )}

        {!isUser && message.toolPreview && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              {ui.solutionCenter.toolPreviewLabel}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{message.toolPreview.title}</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{message.toolPreview.summary}</p>
            {message.actionHint?.action_run_id && message.toolPreview.requiresConfirmation ? (
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={actionInFlightId === message.actionHint.action_run_id}
                  onClick={() => onActionDecision(message.actionHint as NovaActionHint, "confirm")}
                >
                  {actionInFlightId === message.actionHint.action_run_id
                    ? ui.solutionCenter.actionRunning
                    : ui.solutionCenter.approveAction}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actionInFlightId === message.actionHint.action_run_id}
                  onClick={() => onActionDecision(message.actionHint as NovaActionHint, "cancel")}
                >
                  {ui.solutionCenter.cancelAction}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {!isUser && message.draft && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {ui.solutionCenter.draftReadyLabel}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{message.draft.title}</p>
            {message.draft.summary ? (
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{message.draft.summary}</p>
            ) : null}
          </div>
        )}

        {!isUser && message.safetyBlock && (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {ui.solutionCenter.safetyBlockLabel}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{message.safetyBlock.title}</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{message.safetyBlock.message}</p>
          </div>
        )}

        {!isUser && message.workflow && (
          <WorkflowCard workflow={message.workflow} />
        )}

        {!isUser && message.followUpActions && message.followUpActions.length > 0 && (
          <FollowUpActionsCard
            actions={message.followUpActions}
            onNavigate={onFollowUpNavigate}
            onPrompt={onFollowUpPrompt}
          />
        )}

        {/* Actions */}
        {!isUser && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onFeedback?.(message.id, "positive")}
              disabled={!message.queryId || message.feedback === "positive"}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors",
                message.feedback === "positive"
                  ? "text-emerald-600"
                  : "text-muted-foreground hover:text-foreground",
                !message.queryId && "cursor-not-allowed opacity-50",
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill={message.feedback === "positive" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 10v12" />
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3 3 0 0 1 3 3.88Z" />
              </svg>
              {ui.solutionCenter.helpful}
            </button>
            <button
              type="button"
              onClick={() => onFeedback?.(message.id, "negative")}
              disabled={!message.queryId || message.feedback === "negative"}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors",
                message.feedback === "negative"
                  ? "text-rose-600"
                  : "text-muted-foreground hover:text-foreground",
                !message.queryId && "cursor-not-allowed opacity-50",
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill={message.feedback === "negative" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 14V2" />
                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3 3 0 0 1-3-3.88Z" />
              </svg>
              {ui.solutionCenter.lacking}
            </button>
            <button
              type="button"
              onClick={() => onToggleSave?.(message.id)}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors",
                message.saved
                  ? "text-warning"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill={message.saved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
              </svg>
              {message.saved ? ui.solutionCenter.saved : ui.solutionCenter.save}
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(message.content);
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              {ui.solutionCenter.copy}
            </button>
            {message.retrievalRunId ? (
              <button
                type="button"
                onClick={() => onToggleTrace?.(message)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
                {traceOpen ? "Trace gizle" : "Trace goster"}
              </button>
            ) : null}
          </div>
        )}
        {traceOpen ? <TracePanel trace={trace ?? null} loading={Boolean(traceLoading)} /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Typing indicator                                                    */
/* ------------------------------------------------------------------ */

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-xs font-bold text-primary">
        N
      </div>
      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: "0ms" }} />
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: "150ms" }} />
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Welcome screen                                                      */
/* ------------------------------------------------------------------ */

function WelcomeScreen({
  onQuickQuestion,
  proactiveBrief,
  loadingProactive,
  onFollowUpNavigate,
  onFollowUpPrompt,
  title,
  description,
  quickQuestions,
}: {
  onQuickQuestion: (q: string) => void;
  proactiveBrief: NovaProactiveBrief | null;
  loadingProactive: boolean;
  onFollowUpNavigate: (action: NovaFollowUpAction) => void;
  onFollowUpPrompt: (action: NovaFollowUpAction) => void;
  title: string;
  description: string;
  quickQuestions: string[];
}) {
  const { locale } = useI18n();
  const ui = getNovaUiCopy(locale);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <span className="text-2xl font-bold text-primary">N</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ui.solutionCenter.modes.map((mode) => (
          <div
            key={mode.label}
            className="rounded-2xl border border-border bg-card px-4 py-4 text-left shadow-[var(--shadow-soft)]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{mode.label}</span>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {mode.badge}
              </span>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">{mode.hint}</p>
          </div>
        ))}
      </div>

      {(loadingProactive || proactiveBrief) && (
        <div className="w-full max-w-4xl rounded-3xl border border-primary/15 bg-card/80 p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  {ui.solutionCenter.briefEyebrow}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {ui.solutionCenter.focusQuestion}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {loadingProactive
                    ? ui.solutionCenter.loadingBrief
                    : proactiveBrief?.summary}
                </p>
              </div>
              {proactiveBrief?.actions?.length ? (
                <Badge variant="success">{`${proactiveBrief.actions.length} ${ui.solutionCenter.nextStepsLabel.toLowerCase()}`}</Badge>
              ) : null}
            </div>

            {!!proactiveBrief?.insights?.length && (
              <div className="grid gap-2 md:grid-cols-3">
                {proactiveBrief.insights.map((insight) => (
                  <div
                    key={insight}
                    className="rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-xs leading-6 text-muted-foreground"
                  >
                    {insight}
                  </div>
                ))}
              </div>
            )}

            {!!proactiveBrief?.activeWorkflows?.length && (
              <div className="grid gap-3 lg:grid-cols-2">
                {proactiveBrief.activeWorkflows.slice(0, 2).map((workflow) => (
                  <WorkflowCard key={workflow.id} workflow={workflow} />
                ))}
              </div>
            )}

            {!!proactiveBrief?.actions?.length && (
              <FollowUpActionsCard
                actions={proactiveBrief.actions}
                onNavigate={onFollowUpNavigate}
                onPrompt={onFollowUpPrompt}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid w-full max-w-3xl gap-2 sm:grid-cols-2">
        {quickQuestions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onQuickQuestion(q)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export default function SolutionCenterPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const ui = getNovaUiCopy(locale);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionInFlightId, setActionInFlightId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRow | null>(null);
  const [proactiveBrief, setProactiveBrief] = useState<NovaProactiveBrief | null>(null);
  const [loadingProactive, setLoadingProactive] = useState(false);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [answerMode, setAnswerMode] = useState<"extractive" | "polish">("extractive");
  const [openTraceMessageId, setOpenTraceMessageId] = useState<string | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceCache, setTraceCache] = useState<Record<string, RetrievalTracePayload>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const proactiveLocaleRef = useRef<string | null>(null);
  const promptSeedRef = useRef<string | null>(null);
  const actionPollCancelledRef = useRef(false);
  const requestedSurface = searchParams.get("surface");
  const promptSeed = searchParams.get("prompt")?.trim() ?? "";
  const managerSurface = requestedSurface === "osgb-manager";
  const enterpriseSurface = requestedSurface === "enterprise";
  const platformAdminSurface = requestedSurface === "platform-admin";
  const currentQueryString = searchParams.toString();
  const currentPage = `${pathname}${currentQueryString ? `?${currentQueryString}` : ""}`;
  const companyWorkspaceId = useMemo(() => {
    const workspaceId = searchParams.get("workspaceId");
    return workspaceId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        workspaceId,
      )
      ? workspaceId
      : null;
  }, [searchParams]);
  const welcomeTitle = platformAdminSurface
    ? "Nova Platform"
    : managerSurface
    ? "Nova OSGB Manager"
    : enterpriseSurface
      ? "Nova Kurumsal"
      : "Nova";
  const welcomeDescription = platformAdminSurface
    ? "Platform genel sagligi, hata akislari, belge omurgasi, risk hattı ve ic operasyon eksiklerini yonetici perspektifiyle analiz eder."
    : managerSurface
    ? "Firma, personel, gorevlendirme, dokuman ve gecikme risklerini yonetici perspektifiyle analiz eder. Secili firma varsa cevaplari varsayilan olarak o kapsamda tutar."
    : enterpriseSurface
      ? "Kurumsal yapilar icin lokasyon, standart, dokuman, rapor ve yonetim onceliklerini merkezi bir bakisla analiz eder."
      : ui.solutionCenter.welcomeDescription;
  const contextualQuickQuestions = useMemo(
    () =>
      platformAdminSurface
        ? [
            "Son 24 saatte hangi platform akislarinda daha cok hata var?",
            "Onay bekleyen dokuman ve taslak risk yogunlugunu ozetle",
            "Kritik alarm ve bekleyen kuyruklar icin oncelik sirasi cikar",
            "Sistemde gordugun temel eksik ve aksakliklari listele",
          ]
        : managerSurface
        ? [
            "Secili firma icin geciken gorevleri ozetle",
            "Atama bosluklarini ve kritik yetki eksiklerini goster",
            "Onay bekleyen dokumanlari onceliklendir",
            "Personel yuk dagilimina gore yonetici aksiyonlarini sirala",
          ]
        : enterpriseSurface
          ? [
              "Bu kurumsal hesap icin oncelikli yonetim aksiyonlarini sirala",
              "Lokasyon bazli dokuman ve onay risklerini ozetle",
              "Raporlama ve standartlasma aciklarini goster",
              "Secili firma icin yonetici eylem plani hazirla",
            ]
        : ui.solutionCenter.quickQuestions,
    [enterpriseSurface, managerSurface, platformAdminSurface, ui.solutionCenter.quickQuestions],
  );

  const buildAssistantMessageFromAgentResponse = useCallback(
    (data: NovaAgentResponse): ChatMessage => {
      const docs = normalizeDocumentBlocks(data.documents);
      const rawSources = Array.isArray(data.sources) ? data.sources : [];
      const normalizedSources: Source[] = rawSources.map((s: NovaAgentSource) => ({
        doc_title: s.doc_title || s.law || "",
        doc_type: s.doc_type || "",
        doc_number: s.doc_number || "",
        article_number: s.article_number || s.article || "",
        article_title: s.article_title || s.title || "",
        corpus_scope: (s.corpus_scope as "official" | "tenant_private" | undefined) ?? null,
        jurisdiction_code: s.jurisdiction_code || null,
      }));

      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer || ui.solutionCenter.routeTitle,
        sources: normalizedSources,
        documents: docs,
        navigation: (data.navigation as NavigationAction | null) || null,
        workflow: (data.workflow as NovaWorkflowSummary | null) || null,
        followUpActions: normalizeFollowUpActions(data.follow_up_actions),
        actionHint:
          data.action_hint && typeof data.action_hint === "object"
            ? (data.action_hint as NovaActionHint)
            : null,
        toolPreview: data.tool_preview || null,
        draft: data.draft || null,
        safetyBlock: data.safety_block || null,
        queryId: data.query_id || data.session_id || undefined,
        retrievalRunId: data.retrieval_run_id || null,
        asOfDate: data.as_of_date || asOfDate,
        answerMode: data.answer_mode || answerMode,
        timestamp: new Date(),
        saved: false,
        feedback: null,
      };
    },
    [answerMode, asOfDate, ui.solutionCenter.routeTitle],
  );

  useEffect(() => {
    return () => {
      actionPollCancelledRef.current = true;
    };
  }, []);

  // Fetch organization_id from user_profiles
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) return;
      const { data: profile } = await supabase.from("user_profiles").select("organization_id").eq("auth_user_id", user.id).single();
      if (profile?.organization_id) setOrganizationId(profile.organization_id);
      const workspace = await getActiveWorkspace();
      if (workspace) setActiveWorkspace(workspace);
    })();
  }, []);

  useEffect(() => {
    if (!organizationId || messages.length > 0 || proactiveLocaleRef.current === locale) return;

    let cancelled = false;
    setLoadingProactive(true);

    (async () => {
      const brief = await getNovaProactiveBrief(locale);
      if (cancelled) return;
      setProactiveBrief(brief);
      proactiveLocaleRef.current = locale;
      setLoadingProactive(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, locale, messages.length]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  }, [input]);

  async function sendMessage(text: string) {
    const query = text.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase bağlantısı kurulamadı");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Build history from previous messages
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resolvedWorkspaceId =
        activeWorkspace?.id &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          activeWorkspace.id,
        )
          ? activeWorkspace.id
          : null;

      const response = await fetch("/api/nova/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: query,
          language: locale,
          workspace_id: resolvedWorkspaceId,
          jurisdiction_code: activeWorkspace?.country_code ?? "TR",
          as_of_date: asOfDate,
          answer_mode: answerMode,
          mode: "agent",
          context_surface: "solution_center",
          access_token: session?.access_token ?? null,
          company_workspace_id: companyWorkspaceId,
          current_page: currentPage,
          history,
        }),
      });

      const data: NovaAgentResponse = await response.json().catch(() => ({
        type: "safety_block",
        answer: ui.solutionCenter.unavailable,
      }));

      if (!response.ok) {
        throw { context: new Response(JSON.stringify(data), { status: response.status }) };
      }

      // v13 response: { answer, sources, tools_used, session_id, ... }
      const docs = normalizeDocumentBlocks(data.documents);

      // Save generated documents to DB (if available)
      const queryId = data.query_id || data.session_id || null;
      if (docs.length > 0 && queryId) {
        for (const doc of docs) {
          await supabase.from("solution_documents").insert({
            query_id: queryId,
            doc_type: doc.type,
            doc_title: doc.title,
            doc_content: doc.content,
          });
        }
      }

      // Normalize sources — v13 returns {law, article, title}, frontend expects {doc_title, article_number, article_title}
      const rawSources = Array.isArray(data.sources) ? data.sources : [];
      setMessages((prev) => [...prev, buildAssistantMessageFromAgentResponse(data)]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: await resolveNovaRuntimeErrorMessage(locale, err),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!promptSeed) return;
    if (loading) return;
    if (promptSeedRef.current === promptSeed) return;

    promptSeedRef.current = promptSeed;
    setInput(promptSeed);
    void sendMessage(promptSeed);
  }, [loading, promptSeed]);

  async function toggleSave(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.queryId) return;

    const supabase = createClient();
    if (!supabase) return;

    const newSaved = !msg.saved;

    await supabase
      .from("solution_queries")
      .update({ is_saved: newSaved })
      .eq("id", msg.queryId);

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, saved: newSaved } : m)),
    );
  }

  async function rateMessage(messageId: string, feedback: "positive" | "negative") {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.queryId) return;

    const supabase = createClient();
    if (!supabase) return;

    const { error } = await supabase.rpc("record_nova_feedback", {
      p_query_id: msg.queryId,
      p_feedback: feedback,
      p_comment: null,
    });

    if (error) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)),
    );
  }

  async function handleFollowUpNavigate(action: NovaFollowUpAction) {
    if (action.workflow_step_id) {
      await markNovaWorkflowStep(action.workflow_step_id, "completed");
    }

    if (action.url) {
      router.push(action.url);
    }
  }

  async function handleFollowUpPrompt(action: NovaFollowUpAction) {
    if (action.workflow_step_id) {
      await markNovaWorkflowStep(action.workflow_step_id, "completed");
    }

    if (action.prompt) {
      await sendMessage(action.prompt);
    }
  }

  async function handlePendingAction(actionHint: NovaActionHint, decision: "confirm" | "cancel") {
    const actionRunId = actionHint.action_run_id;
    if (!actionRunId) return;

    setActionInFlightId(actionRunId);
    try {
      const response = await fetch(`/api/nova/actions/${actionRunId}/${decision}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          decision === "confirm"
            ? {
                idempotency_key: crypto.randomUUID(),
                context_surface: "solution_center",
              }
            : {
                context_surface: "solution_center",
              },
        ),
      });

      const data: NovaAgentResponse = await response.json().catch(() => ({
        type: "safety_block",
        answer: ui.solutionCenter.routeTitle,
      }));

      if (!response.ok) {
        throw { context: new Response(JSON.stringify(data), { status: response.status }) };
      }

      setMessages((prev) => [
        ...prev.map((msg) =>
          msg.actionHint?.action_run_id === actionRunId
            ? { ...msg, actionHint: null }
            : msg,
        ),
        buildAssistantMessageFromAgentResponse(data),
      ]);

      const executionStatus =
        data.action_hint && typeof data.action_hint === "object"
          ? data.action_hint.execution_status
          : null;

      if (decision === "confirm" && (executionStatus === "queued" || executionStatus === "processing")) {
        void pollActionRunUntilSettled(actionRunId);
      }
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: await resolveNovaRuntimeErrorMessage(locale, err),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setActionInFlightId(null);
    }
  }

  async function pollActionRunUntilSettled(actionRunId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (actionPollCancelledRef.current) return;

      await new Promise((resolve) => window.setTimeout(resolve, 2500));

      const response = await fetch(`/api/nova/actions/${actionRunId}`, { cache: "no-store" });
      const data: NovaAgentResponse = await response.json().catch(() => ({
        type: "message",
        answer: ui.solutionCenter.unavailable,
      }));

      if (!response.ok) {
        return;
      }

      const executionStatus =
        data.action_hint && typeof data.action_hint === "object"
          ? data.action_hint.execution_status
          : null;

      if (executionStatus === "queued" || executionStatus === "processing") {
        continue;
      }

      setMessages((prev) => [...prev, buildAssistantMessageFromAgentResponse(data)]);
      return;
    }
  }

  async function handleToggleTrace(message: ChatMessage) {
    if (!message.retrievalRunId) return;

    if (openTraceMessageId === message.id) {
      setOpenTraceMessageId(null);
      return;
    }

    setOpenTraceMessageId(message.id);

    if (traceCache[message.retrievalRunId]) {
      return;
    }

    setTraceLoading(true);
    try {
      const response = await fetch(`/api/legal/trace/${message.retrievalRunId}`);
      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        return;
      }

      setTraceCache((prev) => ({
        ...prev,
        [message.retrievalRunId as string]: data as RetrievalTracePayload,
      }));
    } finally {
      setTraceLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 200px)" }}>
      <div className="mb-4 rounded-2xl border border-border bg-card/80 px-4 py-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {t("solutionCenter.title")} Agent
            </p>
            <h1 className="mt-1 text-lg font-semibold text-foreground">
              {ui.solutionCenter.routeTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("solutionCenter.description")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">RAG</Badge>
            <Badge variant="success">Navigation</Badge>
            <Badge variant="warning">{ui.solutionCenter.actionReadyBadge}</Badge>
            {activeWorkspace ? (
              <Badge variant="neutral">{`${activeWorkspace.country_code} / ${activeWorkspace.name}`}</Badge>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              As Of Date
            </span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className={cn(
                "h-11 rounded-xl border px-3 text-sm text-foreground transition-colors transition-shadow",
                "border-border bg-card shadow-[var(--shadow-soft)]",
                "hover:border-primary/40",
                "focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring)] focus-visible:outline-none",
              )}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Answer Mode
            </span>
            <select
              value={answerMode}
              onChange={(e) => setAnswerMode(e.target.value as "extractive" | "polish")}
              className={cn(
                "h-11 rounded-xl border px-3 text-sm text-foreground transition-colors transition-shadow",
                "border-border bg-card shadow-[var(--shadow-soft)]",
                "hover:border-primary/40",
                "focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring)] focus-visible:outline-none",
              )}
            >
              <option value="extractive">Extractive</option>
              <option value="polish">Polish</option>
            </select>
          </label>
          <div className="rounded-xl border border-border bg-secondary/20 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Jurisdiction
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {activeWorkspace?.country_code ?? "Not set"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/20 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {activeWorkspace?.name ?? "Default"}
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1">
        {hasMessages ? (
          <div className="space-y-4 pb-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onToggleSave={toggleSave}
                onFeedback={rateMessage}
                onNavigate={(url) => router.push(url)}
                onFollowUpNavigate={handleFollowUpNavigate}
                onFollowUpPrompt={handleFollowUpPrompt}
                onActionDecision={handlePendingAction}
                actionInFlightId={actionInFlightId}
                onToggleTrace={handleToggleTrace}
                traceOpen={openTraceMessageId === msg.id}
                trace={msg.retrievalRunId ? traceCache[msg.retrievalRunId] ?? null : null}
                traceLoading={traceLoading && openTraceMessageId === msg.id}
              />
            ))}
            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        ) : (
        <WelcomeScreen
          onQuickQuestion={sendMessage}
          proactiveBrief={proactiveBrief}
          loadingProactive={loadingProactive}
          onFollowUpNavigate={handleFollowUpNavigate}
          onFollowUpPrompt={handleFollowUpPrompt}
          title={welcomeTitle}
          description={welcomeDescription}
          quickQuestions={contextualQuickQuestions}
        />
        )}
      </div>

      {/* Input area */}
      <div className="sticky bottom-0 border-t border-border bg-background pt-4 pb-2">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("solutionCenter.inputPlaceholder")}
              rows={1}
              className={cn(
                "w-full resize-none rounded-2xl border px-4 py-3 pr-12 text-sm text-foreground transition-colors transition-shadow",
                "border-border bg-card shadow-[var(--shadow-soft)]",
                "hover:border-primary/40",
                "focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring)] focus-visible:outline-none",
                "placeholder:text-muted-foreground/70",
              )}
            />
          </div>
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            size="lg"
            className="shrink-0 self-end"
          >
            {loading ? (
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </Button>
        </div>

        {hasMessages && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="neutral">
              {messages.filter((m) => m.role === "user").length} {t("solutionCenter.queries")}
            </Badge>
            <Badge variant="success">
              {messages.filter((m) => m.role === "assistant" && m.sources && m.sources.length > 0).length} {t("solutionCenter.referenced")}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
