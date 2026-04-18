"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./brand";
import { LanguageSelector } from "./language-selector";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { ConsentGate } from "@/components/compliance/ConsentGate";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/hooks/use-is-admin";
import { createClient } from "@/lib/supabase/client";
import { quickSignOut } from "@/lib/auth/quick-sign-out";
import {
  listMyNotifications,
  markAllMyNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRow,
} from "@/lib/supabase/notification-api";

type ProtectedShellProps = { children: ReactNode };

/* Top bar: core modules */
const primaryNav = [
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/companies", key: "nav.companies" },
  { href: "/risk-analysis", key: "nav.riskAnalysis" },
  { href: "/corrective-actions", key: "nav.correctiveActions" },
  { href: "/incidents", key: "nav.incidents" },
  { href: "/isg-library", key: "nav.library" },
];

/* Second bar: other modules */
type NavItem = { href: string; key: string; adminOnly?: boolean };
const secondaryNav: NavItem[] = [
  { href: "/score-history", key: "nav.scoreHistory" },
  { href: "/planner", key: "nav.planner" },
  // { href: "/timesheet", key: "nav.timesheet" }, // Planner içindeki Puantaj sekmesinde
  { href: "/solution-center", key: "nav.solutionCenter" },
  { href: "/digital-twin", key: "nav.digitalTwin", adminOnly: true },
  { href: "/reports", key: "nav.reports" },
  { href: "/settings", key: "nav.settings" },
];

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
      aria-label={dark ? "Açık tema" : "Koyu tema"}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--nav-icon-color)] transition-all duration-200 hover:bg-white/10 hover:text-white"
    >
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Notification Bell                                                   */
/* ------------------------------------------------------------------ */

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    const data = await listMyNotifications(10);
    setNotifications(data);
    setUnreadCount(data.filter((n) => !n.is_read).length);
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
    const ok = await markNotificationAsRead(id);
    if (!ok) return;
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const ok = await markAllMyNotificationsAsRead(unreadIds);
    if (!ok) return;
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
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--nav-icon-color)] transition-all duration-200 hover:bg-white/10 hover:text-white"
        aria-label="Bildirimler"
      >
        <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse" style={{ animationDuration: "2s" }}>
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

function HeaderSignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleClick() {
    if (signingOut) return;
    setSigningOut(true);
    await quickSignOut("/login");
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={signingOut}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/12 px-3 text-[14px] font-semibold text-[var(--nav-icon-color)] transition-all duration-200 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Oturumu kapat"
      title="Oturumu kapat"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span className="hidden lg:inline">{signingOut ? "Çıkılıyor..." : "Çıkış"}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */
export function ProtectedShell({ children }: ProtectedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  const [authReady, setAuthReady] = useState(false);

  const visibleSecondaryNav = secondaryNav.filter((i) => !i.adminOnly || isAdmin === true);
  const visibleAllNav = [...primaryNav, ...visibleSecondaryNav];

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    if (!supabase) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    const authClient = supabase;

    setAuthReady(false);

    async function ensureAuthenticated() {
      const {
        data: { user },
      } = await authClient.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: assuranceData, error: assuranceError } =
        await authClient.auth.mfa.getAuthenticatorAssuranceLevel();

      if (cancelled) return;

      if (
        !assuranceError &&
        assuranceData?.nextLevel === "aal2" &&
        assuranceData.currentLevel !== "aal2"
      ) {
        router.replace(
          `/auth/mfa-challenge?next=${encodeURIComponent(pathname)}`
        );
        return;
      }

      setAuthReady(true);
    }

    void ensureAuthenticated();

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "MFA_CHALLENGE_VERIFIED"
      ) {
        void ensureAuthenticated();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!authReady) {
    return (
      <div className="app-shell">
        <main className="mx-auto flex min-h-[60vh] w-full max-w-[1480px] items-center justify-center px-4 py-6 sm:px-6 xl:px-8 2xl:px-10">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">
              Guvenli oturum dogrulaniyor...
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* ── Sticky header group (both bars stay fixed) ── */}
      <div className="sticky top-0 z-40">
        {/* ── Top Header — Brand + Primary Nav + Actions ── */}
        <header
          className="relative z-10"
          style={{ background: "var(--header-bg-solid)", borderBottom: "1px solid var(--header-border)" }}
        >
          <div className="mx-auto grid h-[92px] w-full max-w-[1480px] grid-cols-[minmax(280px,1fr)_auto_minmax(280px,1fr)] items-center gap-4 px-4 sm:px-6 xl:grid-cols-[minmax(340px,1fr)_auto_minmax(340px,1fr)] xl:px-8 2xl:px-10">
            {/* Left: Brand — absolute so it doesn't affect nav centering */}
            <div className="min-w-0 justify-self-start">
              <Brand href="/dashboard" inverted />
            </div>

            {/* Center: Primary navigation — truly centered in max-w-7xl */}
            <nav className="hidden min-w-0 items-center justify-center gap-1 justify-self-center lg:flex">
              {primaryNav.map((item) => {
                const act = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative inline-flex h-11 min-w-0 items-center rounded-2xl px-3 xl:px-4 text-[14px] xl:text-[15px] font-semibold tracking-[-0.01em] transition-all duration-200",
                      act
                        ? "bg-white/8 text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-white/10"
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

            {/* Right: Actions — absolute so it doesn't affect nav centering */}
            <div className="flex items-center justify-end gap-1 justify-self-end sm:gap-1.5">
              <LanguageSelector variant="dark" />
              <NotificationBell />
              <ThemeToggle />
              <Link
                href="/profile"
                className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-[var(--nav-icon-color)] transition-all duration-200 hover:bg-white/10 hover:text-white"
                aria-label="Profil"
                title="Profil"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="hidden xl:inline">{t("common.profile")}</span>
              </Link>
              <HeaderSignOutButton />
            </div>
          </div>
        </header>

        {/* ── Secondary navigation bar (centered, sticky with header) ── */}
        {/* Gold ayraç — 1 ile 2 arası (üst üste, boşluksuz) */}
        <div className="hidden md:block relative z-0" style={{ background: "var(--secondary-nav-bg-solid)", borderBottom: "1px solid var(--secondary-nav-border)" }}>
          <div className="mx-auto grid h-12 w-full max-w-[1480px] grid-cols-[minmax(280px,1fr)_auto_minmax(280px,1fr)] items-center gap-4 px-4 sm:px-6 xl:grid-cols-[minmax(340px,1fr)_auto_minmax(340px,1fr)] xl:px-8 2xl:px-10">
            <div />
            <div className="min-w-0 justify-self-center overflow-x-auto">
              <div className="flex items-center justify-center gap-1">
                {visibleSecondaryNav.map((item) => {
                  const act = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative inline-flex shrink-0 items-center rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-200 xl:px-4 xl:text-[14px]",
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
            <div />
          </div>
        </div>
      </div>

      {/* ── Mobile navigation (all items, single scrollable row) ── */}
      <div className="border-b md:hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="mx-auto w-full max-w-[1480px] px-4 sm:px-6">
          <div className="flex gap-0.5 overflow-x-auto py-0">
            {visibleAllNav.map((item) => {
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
      <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 xl:px-8 2xl:px-10">
        <div className="page-stack">{children}</div>
      </main>

      {/* ── Chat Widget ── */}
      <ConsentGate />
      <ChatWidget isAuthenticated />
    </div>
  );
}
