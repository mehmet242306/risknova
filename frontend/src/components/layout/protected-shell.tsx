"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { LanguageSelector } from "./language-selector";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ProtectedShellProps = { children: ReactNode };

const navigationKeys = [
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/companies", key: "nav.companies" },
  { href: "/risk-analysis", key: "nav.riskAnalysis" },
  { href: "/incidents", key: "nav.incidents" },
  { href: "/score-history", key: "nav.scoreHistory" },
  { href: "/planner", key: "nav.planner" },
  { href: "/timesheet", key: "nav.timesheet" },
  { href: "/solution-center", key: "nav.solutionCenter" },
  { href: "/reports", key: "nav.reports" },
  { href: "/settings", key: "nav.settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

/* ------------------------------------------------------------------ */
/* Theme toggle – direct DOM, no React state dependency for toggling   */
/* ------------------------------------------------------------------ */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const mountedRef = useRef(false);

  /* Read initial theme on mount */
  useEffect(() => {
    const stored = localStorage.getItem("risknova-theme");
    const isDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark); // eslint-disable-line react-hooks/set-state-in-effect
    /* Ensure DOM is in sync */
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDark);
    mountedRef.current = true;
  }, []);

  function toggle() {
    const root = document.documentElement;
    const currentlyDark = root.getAttribute("data-theme") === "dark";
    const next = !currentlyDark;

    /* Apply immediately to DOM */
    root.setAttribute("data-theme", next ? "dark" : "light");
    root.classList.toggle("dark", next);
    localStorage.setItem("risknova-theme", next ? "dark" : "light");

    /* Sync React state for icon */
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Açık tema" : "Koyu tema"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--header-muted)] transition-colors hover:bg-white/10 hover:text-white"
    >
      {dark ? (
        /* Sun icon */
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      ) : (
        /* Moon icon */
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      )}
    </button>
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
      {/* ── Top Header — 56px, solid dark navy ── */}
      <header
        className="sticky top-0 z-40"
        style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--header-border)" }}
      >
        <div className="h-0.5 w-full bg-[linear-gradient(90deg,transparent,var(--gold),transparent)]" />
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Brand */}
          <Brand href="/dashboard" compact inverted />

          {/* Center: Desktop navigation */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {navigationKeys.map((item) => {
              const act = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex h-14 items-center px-3.5 text-sm font-medium transition-colors",
                    act
                      ? "text-[var(--header-active)]"
                      : "text-[var(--header-muted)] hover:text-[var(--header-active)]",
                  )}
                >
                  {t(item.key)}
                  {act && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--primary)]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <LanguageSelector variant="dark" />
            <ThemeToggle />
            <Link
              href="/profile"
              className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-[var(--header-muted)] transition-colors hover:bg-white/10 hover:text-white"
            >
              {t("common.profile")}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile navigation ── */}
      <div className="border-b md:hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="flex gap-0.5 overflow-x-auto py-0">
            {navigationKeys.map((item) => {
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
