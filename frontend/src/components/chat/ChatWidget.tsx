"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { findBestResponse, findPublicResponse, quickActions, publicQuickActions, type QuickAction } from "@/lib/chat-knowledge";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  ExternalLink,
  Bot,
  User,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  route?: string;
  suggestions?: QuickAction[];
  timestamp: Date;
};

export function ChatWidget({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // İlk açılışta karşılama mesajı
  useEffect(() => {
    if (open && messages.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([
        {
          id: "welcome",
          role: "bot",
          text: isAuthenticated
            ? "Merhaba! Ben RiskNova asistanınız. İSG süreçlerinizle ilgili sorularınızı yanıtlayabilir, sizi doğru sayfaya yönlendirebilirim. Nasıl yardımcı olabilirim?"
            : "Merhaba! Ben RiskNova asistanınız. Platformumuz ve İSG süreçleri hakkında bilgi alabilir, sorularınızı sorabilirsiniz. Tüm özelliklere erişmek için giriş yapın veya hesap oluşturun!",
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

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // Simulated typing delay
    setTimeout(() => {
      const response = isAuthenticated ? findBestResponse(text) : findPublicResponse(text);
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
        text: `${action.label} sayfasına yönlendiriliyorsunuz...`,
        route: action.path,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);

      setTimeout(() => router.push(action.path), 800);
    }, 400);
  }

  function navigateTo(path: string) {
    // Giriş yapmamışsa korumalı sayfalara gitmesin
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
          className="fixed bottom-6 right-6 z-50 inline-flex size-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#FBBF24_100%)] text-white shadow-[0_8px_32px_rgba(184,134,11,0.4)] transition-all hover:scale-105 hover:shadow-[0_12px_40px_rgba(184,134,11,0.5)]"
          aria-label="Sohbet asistanını aç"
        >
          <MessageCircle className="size-6" />
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
                <p className="text-sm font-semibold text-white">RiskNova Asistan</p>
                <p className="text-xs text-white/50">AI destekli rehberlik</p>
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
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}>
                    {msg.text.split("\n").map((line, i) => (
                      <span key={i}>
                        {line.startsWith("**") && line.endsWith("**")
                          ? <strong>{line.slice(2, -2)}</strong>
                          : line.startsWith("• ")
                            ? <span className="block pl-2">• {line.slice(2)}</span>
                            : line
                        }
                        {i < msg.text.split("\n").length - 1 && <br />}
                      </span>
                    ))}
                  </div>

                  {/* Route link */}
                  {msg.route && (
                    <button type="button" onClick={() => navigateTo(msg.route!)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                      <ExternalLink className="size-3" />
                      Sayfaya Git
                    </button>
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
              Şu an: <span className="font-medium text-foreground">{pathname}</span>
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
                placeholder="Bir soru sorun..."
                className="h-10 flex-1 rounded-xl border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button type="submit" disabled={!input.trim()}
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
