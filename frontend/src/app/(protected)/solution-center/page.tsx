"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { downloadDocument, type DocumentBlock } from "@/lib/document-generator";
import { useI18n } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Source {
  doc_title: string;
  doc_type: string;
  doc_number: string;
  article_number: string;
  article_title: string;
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
  queryId?: string;
  timestamp: Date;
  saved?: boolean;
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
        <p className="truncate text-xs font-medium text-foreground">
          {source.doc_title}
        </p>
        {source.article_number && (
          <p className="truncate text-[11px] text-muted-foreground">
            Madde {source.article_number}
            {source.article_title ? ` — ${source.article_title}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation card                                                     */
/* ------------------------------------------------------------------ */

function NavigationCard({ navigation, onNavigate }: { navigation: NavigationAction; onNavigate: (url: string) => void }) {
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Sayfa Yonlendirme</span>
          </div>
          <p className="text-sm font-medium text-foreground">{navigation.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{navigation.reason}</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(navigation.url)}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Sayfaya Git
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Document download card                                              */
/* ------------------------------------------------------------------ */

function DocumentDownloadCard({ doc }: { doc: DocumentBlock }) {
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
        <p className="text-xs text-muted-foreground">
          {isPptx ? "PowerPoint Sunumu" : "Word Belgesi"} (.{doc.type})
        </p>
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
  onNavigate,
}: {
  message: ChatMessage;
  onToggleSave?: (id: string) => void;
  onNavigate: (url: string) => void;
}) {
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
              {message.sources.length} mevzuat kaynağı
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

        {/* Actions */}
        {!isUser && (
          <div className="mt-2 flex items-center gap-2">
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
              {message.saved ? "Kaydedildi" : "Kaydet"}
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
              Kopyala
            </button>
          </div>
        )}
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

const novaModes = [
  { label: "Mevzuat", hint: "yorumlasın ve kaynak göstersin", badge: "RAG" },
  { label: "Planlama", hint: "takvime işlesin ve takip etsin", badge: "ACTION" },
  { label: "Doküman", hint: "rapor, sunum ve taslak oluştursun", badge: "DOC" },
  { label: "Yönlendirme", hint: "doğru modülü açsın ve götürsün", badge: "FLOW" },
];

const quickQuestions = [
  "25 Haziran'a eğitim planla",
  "Bu firmadaki açık riskleri özetle",
  "Risk değerlendirme sunumu hazırla",
  "Beni eğitim belgelerine götür",
  "Bu ay yapılacak İSG görevlerini listele",
  "İş kazası bildirimi kaç gün içinde yapılmalı?",
];

void novaModes;
void quickQuestions;

const novaOperationalModes = [
  { label: "Mevzuat", hint: "mevzuati yorumlasin, kaynak gostersin ve riskleri aciklasin", badge: "RAG" },
  { label: "Planlama", hint: "egitim, kurul ve operasyon gorevlerini olustursun", badge: "ACTION" },
  { label: "Olay", hint: "ramak kala ve kaza taslaklarini baslatip sizi yonlendirsin", badge: "INCIDENT" },
  { label: "Dokuman", hint: "editor icin prosedur, rapor ve taslaklar hazirlasin", badge: "DOC" },
];

const novaActionQuestions = [
  "25 Haziran'a yuksekte calisma egitimi planla",
  "28 Haziran icin aylik kurul toplantisi gorevi olustur",
  "Yeni bir ramak kala olay taslagi baslat",
  "Acil durum proseduru icin dokuman taslagi hazirla",
  "Bu firmadaki acik riskleri ozetle",
  "Is kazasi bildirimi kac gun icinde yapilmali?",
];

function WelcomeScreen({ onQuickQuestion }: { onQuickQuestion: (q: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <span className="text-2xl font-bold text-primary">N</span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Nova
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          Nova; mevzuatı yorumlayan, sizi doğru modüllere götüren, belge ve operasyon
          akışlarını başlatan kurumsal İSG ajanıdır.
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {novaOperationalModes.map((mode) => (
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

      <div className="grid w-full max-w-3xl gap-2 sm:grid-cols-2">
        {novaActionQuestions.map((q) => (
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
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch organization_id from user_profiles
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("user_profiles").select("organization_id").eq("auth_user_id", user.id).single();
      if (profile?.organization_id) setOrganizationId(profile.organization_id);
    })();
  }, []);

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

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Oturum bulunamadı");

      // Build history from previous messages
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("solution-chat", {
        body: {
          message: query,
          organization_id: organizationId,
          language: locale,
          history,
        },
      });

      if (error) throw error;

      // v13 response: { answer, sources, tools_used, session_id, ... }
      const docs: DocumentBlock[] = data.documents || [];

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
      const rawSources = data.sources || [];
      const normalizedSources: Source[] = rawSources.map((s: Record<string, string>) => ({
        doc_title: s.doc_title || s.law || "",
        doc_type: s.doc_type || "",
        doc_number: s.doc_number || "",
        article_number: s.article_number || s.article || "",
        article_title: s.article_title || s.title || "",
      }));

      const navigation: NavigationAction | null = data.navigation || null;

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer || data.response || "Yanıt alınamadı.",
        sources: normalizedSources,
        documents: docs,
        navigation,
        queryId: queryId,
        timestamp: new Date(),
        saved: false,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Bir hata oluştu: ${err instanceof Error ? err.message : "Bilinmeyen hata"}. Lütfen tekrar deneyin.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

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
              Mevzuat, yonlendirme ve operasyon aksiyonlari tek akista
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("solutionCenter.description")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">RAG</Badge>
            <Badge variant="success">Navigation</Badge>
            <Badge variant="warning">Action Ready</Badge>
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
                onNavigate={(url) => router.push(url)}
              />
            ))}
            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <WelcomeScreen onQuickQuestion={sendMessage} />
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
