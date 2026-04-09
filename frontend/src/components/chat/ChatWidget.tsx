"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { findPublicResponse, quickActions, publicQuickActions, type QuickAction } from "@/lib/chat-knowledge";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  ExternalLink,
  Bot,
  User,
} from "lucide-react";

type NovaSource = {
  doc_title?: string;
  law?: string;
  article?: string;
  article_number?: string;
  article_title?: string;
};

type NovaNavigation = {
  action: "navigate";
  url: string;
  label: string;
  reason: string;
  destination: string;
  auto_navigate: boolean;
};

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  route?: string;
  suggestions?: QuickAction[];
  timestamp: Date;
  sources?: NovaSource[];
  navigation?: NovaNavigation | null;
  isError?: boolean;
};

export function ChatWidget({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Fetch organization_id for authenticated users
  useEffect(() => {
    if (!isAuthenticated || !supabase) return;

    async function fetchOrgId() {
      try {
        const { data: { user } } = await supabase!.auth.getUser();
        if (!user) return;

        const { data } = await supabase!
          .from("user_profiles")
          .select("organization_id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (data?.organization_id) {
          setOrganizationId(data.organization_id);
        }
      } catch (err) {
        console.error("Nova widget org fetch error:", err);
      }
    }

    fetchOrgId();
  }, [isAuthenticated, supabase]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([
        {
          id: "welcome",
          role: "bot",
          text: isAuthenticated
            ? "Merhaba! Ben Nova, RiskNova AI asistaniyim. ISG mevzuati, risk analizi, firma verileri ve platform kullanimi hakkinda sorularinizi yanitlayabilirim. Nasil yardimci olabilirim?"
            : "Merhaba! Ben RiskNova asistaniyiz. Platformumuz ve ISG surecleri hakkinda bilgi alabilir, sorularinizi sorabilirsiniz. Tum ozelliklere erismek icin giris yapin veya hesap olusturun!",
          suggestions: isAuthenticated ? quickActions.slice(0, 4) : publicQuickActions,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, messages.length, isAuthenticated]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || typing) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // Public users: local keyword match (no API)
    if (!isAuthenticated) {
      setTimeout(() => {
        const response = findPublicResponse(text);
        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          text: response.text,
          route: response.route,
          suggestions: response.suggestions,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setTyping(false);
      }, 600 + Math.random() * 400);
      return;
    }

    // Org ID not ready yet
    if (!organizationId || !supabase) {
      setTimeout(() => {
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          text: "Lutfen bir saniye, henuz hazirlaniyorum...",
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
        setTyping(false);
      }, 500);
      return;
    }

    // Authenticated users: Nova edge function
    try {
      const history = messages.slice(-10).map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      const { data, error } = await supabase.functions.invoke("solution-chat", {
        body: {
          message: text,
          organization_id: organizationId,
          session_id: sessionId,
          language: "tr",
          history,
        },
      });

      if (error) {
        throw new Error(error.message || "Nova yanit veremedi");
      }

      // Preserve session
      if (data?.session_id && !sessionId) {
        setSessionId(data.session_id);
      }

      const answer = data?.answer || data?.response || "Yanit alinamadi.";
      const rawSources = data?.sources || [];
      const navigation: NovaNavigation | null = data?.navigation || null;

      const normalizedSources: NovaSource[] = rawSources.map((s: Record<string, string>) => ({
        doc_title: s.doc_title || s.law || "",
        law: s.law,
        article: s.article,
        article_number: s.article_number || s.article || "",
        article_title: s.article_title || s.title || "",
      }));

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        text: answer,
        sources: normalizedSources.length > 0 ? normalizedSources : undefined,
        navigation,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      console.error("Nova widget error:", err);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        text: "Uzgunum, su an cevap veremiyorum. Lutfen biraz sonra tekrar deneyin veya Cozum Merkezi'ni kullanin.",
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setTyping(false);
    }
  }

  function handleQuickAction(action: QuickAction) {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: action.label,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    setTimeout(() => {
      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        text: `${action.label} sayfasina yonlendiriliyorsunuz...`,
        route: action.path,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);

      setTimeout(() => router.push(action.path), 800);
    }, 400);
  }

  function navigateTo(path: string) {
    if (!isAuthenticated && !["/", "/login", "/register", "/forgot-password"].some((p) => path.startsWith(p)) && !path.startsWith("/#")) {
      router.push("/login");
    } else {
      router.push(path);
    }
    setOpen(false);
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group fixed bottom-6 right-6 z-50 inline-flex size-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#FBBF24_100%)] text-white shadow-[0_8px_32px_rgba(184,134,11,0.4)] transition-all hover:scale-110 hover:shadow-[0_12px_40px_rgba(184,134,11,0.5)]"
          aria-label="Sohbet asistanini ac"
        >
          <span className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#FBBF24_100%)] opacity-40 animate-ping" style={{ animationDuration: "2.5s" }} />
          <span className="absolute -inset-1 rounded-full border-2 border-amber-400/30 animate-pulse" style={{ animationDuration: "3s" }} />
          <MessageCircle className="relative size-6 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_rgba(0,0,0,0.2)]"
          style={{ height: "min(600px, calc(100vh - 6rem))" }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-[var(--header-bg)] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_100%)]">
                <Sparkles className="size-4 text-white" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Nova</p>
                <p className="text-xs text-white/50">AI ISG Asistani</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${
                  msg.role === "bot"
                    ? "bg-[var(--gold-glow)] text-[var(--gold)]"
                    : "bg-primary/10 text-primary"
                }`}>
                  {msg.role === "bot" ? <Bot className="size-4" /> : <User className="size-4" />}
                </span>

                <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "text-right" : ""}`}>
                  {/* Text */}
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : msg.isError
                        ? "bg-red-500/10 text-red-400 rounded-tl-sm border border-red-500/20"
                        : "bg-muted text-foreground rounded-tl-sm"
                  }`}>
                    {msg.text.split("\n").map((line, i) => (
                      <span key={i}>
                        {line.startsWith("**") && line.endsWith("**")
                          ? <strong>{line.slice(2, -2)}</strong>
                          : line.startsWith("• ")
                            ? <span className="block pl-2">{line}</span>
                            : line.startsWith("- ")
                              ? <span className="block pl-2">{line}</span>
                              : line
                        }
                        {i < msg.text.split("\n").length - 1 && <br />}
                      </span>
                    ))}
                  </div>

                  {/* Route link (legacy keyword bot) */}
                  {msg.route && (
                    <button type="button" onClick={() => navigateTo(msg.route!)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                      <ExternalLink className="size-3" />
                      Sayfaya Git
                    </button>
                  )}

                  {/* Nova Sources Accordion */}
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-yellow-500/80 hover:text-yellow-400 select-none">
                        {msg.sources.length} mevzuat kaynagi
                      </summary>
                      <div className="mt-2 space-y-1 pl-2 border-l-2 border-yellow-500/20">
                        {msg.sources.slice(0, 5).map((src, i) => (
                          <div key={i} className="text-muted-foreground">
                            <span className="font-medium text-foreground/80">
                              {src.doc_title || src.law}
                            </span>
                            {src.article_number && (
                              <span className="ml-1">— {src.article_number}</span>
                            )}
                          </div>
                        ))}
                        {msg.sources.length > 5 && (
                          <div className="text-muted-foreground italic">
                            +{msg.sources.length - 5} daha...
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {/* Nova Navigation Card */}
                  {msg.navigation && (
                    <div className="mt-2 p-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                      <div className="text-xs text-yellow-500/80 mb-1">Sayfa Yonlendirme</div>
                      <div className="text-xs font-medium mb-2">{msg.navigation.label}</div>
                      <button
                        type="button"
                        onClick={() => {
                          if (msg.navigation) {
                            router.push(msg.navigation.url);
                            setOpen(false);
                          }
                        }}
                        className="w-full px-3 py-1.5 rounded-md bg-gradient-to-r from-yellow-600 to-yellow-500 text-black text-xs font-semibold hover:from-yellow-500 hover:to-yellow-400 transition-all"
                      >
                        Sayfaya Git
                      </button>
                    </div>
                  )}

                  {/* Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestions.map((s) => (
                        <button key={s.path} type="button" onClick={() => handleQuickAction(s)}
                          className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors">
                          <span>{s.icon}</span> {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex gap-2.5">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--gold-glow)] text-[var(--gold)]">
                  <Bot className="size-4" />
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                  <div className="flex gap-1">
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Current page indicator */}
          <div className="border-t border-border bg-muted/50 px-4 py-1.5">
            <p className="text-[10px] text-muted-foreground">
              Su an: <span className="font-medium text-foreground">{pathname}</span>
            </p>
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card p-3">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nova'ya sorun..."
                className="h-10 flex-1 rounded-xl border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button type="submit" disabled={!input.trim() || typing}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_100%)] text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100">
                <Send className="size-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
