"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { LanguageSelector } from "./language-selector";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type ProtectedShellProps = { children: ReactNode };

/* Top bar: core modules */
const primaryNav = [
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/companies", key: "nav.companies" },
  { href: "/risk-analysis", key: "nav.riskAnalysis" },
  { href: "/incidents", key: "nav.incidents" },
];

/* Second bar: other modules */
const secondaryNav = [
  { href: "/score-history", key: "nav.scoreHistory" },
  { href: "/planner", key: "nav.planner" },
  { href: "/timesheet", key: "nav.timesheet" },
  { href: "/solution-center", key: "nav.solutionCenter" },
  { href: "/reports", key: "nav.reports" },
  { href: "/settings", key: "nav.settings" },
];

const allNav = [...primaryNav, ...secondaryNav];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

/* ------------------------------------------------------------------ */
/* Theme toggle                                                        */
/* ------------------------------------------------------------------ */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem("risknova-theme");
    const isDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDark);
    mountedRef.current = true;
  }, []);

  function toggle() {
    const root = document.documentElement;
    const currentlyDark = root.getAttribute("data-theme") === "dark";
    const next = !currentlyDark;
    root.setAttribute("data-theme", next ? "dark" : "light");
    root.classList.toggle("dark", next);
    localStorage.setItem("risknova-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Acik tema" : "Koyu tema"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--nav-icon-color)] transition-all duration-200 hover:bg-white/12 hover:text-white"
    >
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Notification Bell                                                   */
/* ------------------------------------------------------------------ */

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  level: string;
  link: string | null;
  actor_name: string | null;
  is_read: boolean;
  created_at: string;
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, type, level, link, actor_name, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) {
      setNotifications(data as NotificationItem[]);
      setUnreadCount(data.filter((n: { is_read: boolean }) => !n.is_read).length);
    }
  }, []);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  // Periodically refresh (every 30s)
  useEffect(() => {
    const interval = setInterval(() => { void loadNotifications(); }, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAsRead(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    const supabase = createClient();
    if (!supabase) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Az önce";
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    return `${days} gün önce`;
  }

  function levelColor(level: string) {
    if (level === "critical") return "bg-red-500";
    if (level === "warning") return "bg-amber-500";
    return "bg-blue-500";
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) void loadNotifications(); }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--nav-icon-color)] transition-all duration-200 hover:bg-white/12 hover:text-white hover:shadow-[0_0_8px_rgba(251,191,36,0.2)]"
        aria-label="Bildirimler"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse" style={{ animationDuration: "2s" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elevated)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Bildirimler</h3>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="text-[11px] font-medium text-primary hover:underline">
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Henüz bildirim yok
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-border/50 px-4 py-3 transition-colors ${n.is_read ? "opacity-60" : "bg-primary/5"}`}
                >
                  {n.link ? (
                    <Link
                      href={n.link}
                      onClick={() => { void markAsRead(n.id); setOpen(false); }}
                      className="block"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${levelColor(n.level)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground">{n.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{n.message}</p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            {n.actor_name && <span>{n.actor_name}</span>}
                            <span>{timeAgo(n.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-start gap-2.5" onClick={() => void markAsRead(n.id)} role="button" tabIndex={0}>
                      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${levelColor(n.level)}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{n.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{n.message}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {n.actor_name && <span>{n.actor_name}</span>}
                          <span>{timeAgo(n.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-primary hover:underline"
            >
              Tümünü Gör
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */
export function ProtectedShell({ children }: ProtectedShellProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="app-shell">
      {/* ── Sticky header group (both bars stay fixed) ── */}
      <div className="sticky top-0 z-40">
        {/* ── Top Header — Brand + Primary Nav + Actions ── */}
        <header
          style={{ background: "var(--header-bg-solid)", borderBottom: "1px solid var(--header-border)" }}
        >
          <div className="h-[2px] w-full bg-[linear-gradient(90deg,transparent_5%,var(--gold)_50%,transparent_95%)]" />
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Left: Brand */}
            <Brand href="/dashboard" compact inverted />

            {/* Center: Primary navigation (core modules) */}
            <nav className="hidden items-center gap-0.5 md:flex">
              {primaryNav.map((item) => {
                const act = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold transition-all duration-200",
                      act
                        ? "bg-white/12 text-white shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                        : "text-[var(--header-muted)] hover:bg-[var(--header-hover-bg)] hover:text-white",
                    )}
                  >
                    {t(item.key)}
                    {act && (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--gold)]" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5">
              <LanguageSelector variant="dark" />
              <NotificationBell />
              <ThemeToggle />
              <Link
                href="/profile"
                className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-medium text-[var(--nav-icon-color)] transition-all duration-200 hover:bg-white/12 hover:text-white"
              >
                {t("common.profile")}
              </Link>
            </div>
          </div>
        </header>

        {/* ── Secondary navigation bar (centered, sticky with header) ── */}
        {/* Gold ayraç — 1 ile 2 arası (üst üste, boşluksuz) */}
        <div className="hidden h-[2px] md:block" style={{ background: "var(--gold)", marginBottom: "-1px", position: "relative", zIndex: 1 }} />
        <div className="hidden md:block" style={{ background: "var(--secondary-nav-bg-solid)", borderBottom: "1px solid var(--secondary-nav-border)" }}>
          <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-0.5 overflow-x-auto px-4 py-1.5 sm:px-6 lg:px-8">
            {secondaryNav.map((item) => {
              const act = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex shrink-0 items-center rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all duration-200",
                    act
                      ? "text-[var(--secondary-nav-active)] bg-[var(--secondary-nav-hover-bg)]"
                      : "text-[var(--secondary-nav-text)] hover:text-[var(--secondary-nav-hover-text)] hover:bg-[var(--secondary-nav-hover-bg)]",
                  )}
                >
                  {t(item.key)}
                  {act && (
                    <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-[var(--secondary-nav-active)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile navigation (all items, single scrollable row) ── */}
      <div className="border-b md:hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="flex gap-0.5 overflow-x-auto py-0">
            {allNav.map((item) => {
              const act = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex shrink-0 items-center px-3 py-3 text-sm font-medium transition-colors",
                    act
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(item.key)}
                  {act && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="page-stack">{children}</div>
      </main>

      {/* ── Chat Widget ── */}
      <ChatWidget isAuthenticated />
    </div>
  );
}
