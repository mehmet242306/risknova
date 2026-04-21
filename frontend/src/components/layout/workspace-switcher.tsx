"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getActiveWorkspace,
  listMyWorkspaces,
  setActiveWorkspace,
  type WorkspaceMembership,
  type WorkspaceRow,
} from "@/lib/supabase/workspace-api";

const COUNTRY_FLAGS: Record<string, string> = {
  TR: "🇹🇷",
  US: "🇺🇸",
  GB: "🇬🇧",
  DE: "🇩🇪",
  FR: "🇫🇷",
  ES: "🇪🇸",
  RU: "🇷🇺",
  CN: "🇨🇳",
  JP: "🇯🇵",
  KR: "🇰🇷",
  IN: "🇮🇳",
  SA: "🇸🇦",
  AZ: "🇦🇿",
  ID: "🇮🇩",
};

function flagFor(code: string): string {
  return COUNTRY_FLAGS[code] ?? "🏳️";
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const t = useTranslations("workspace");
  const tCountry = useTranslations("country");

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [active, setActive] = useState<WorkspaceRow | null>(null);
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [list, current] = await Promise.all([listMyWorkspaces(), getActiveWorkspace()]);
    setMemberships(list);
    setActive(current);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSwitch(workspaceId: string) {
    if (switching || workspaceId === active?.id) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    setError(null);
    const ok = await setActiveWorkspace(workspaceId);
    if (!ok) {
      setError(t("switchError"));
      setSwitching(false);
      return;
    }
    setOpen(false);
    setSwitching(false);
    router.refresh();
    await load();
  }

  function countryName(code: string): string {
    try {
      return tCountry(code);
    } catch {
      return code;
    }
  }

  const activeCode = active?.country_code ?? null;
  const activeLabel = active ? active.name : t("noWorkspace");

  // Hide switcher when the user has 0 workspaces (pre-backfill / incomplete
  // onboarding). Avoids showing an empty dropdown.
  if (!loading && memberships.length === 0) {
    return null;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${t("switcher")}${active ? ` — ${activeLabel}` : ""}`}
        className="inline-flex h-11 max-w-[220px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-2.5 text-[12px] font-semibold text-[var(--nav-icon-color)] transition-all duration-200 hover:border-[var(--gold)]/60 hover:bg-[var(--gold)]/20 hover:text-white"
      >
        <span className="text-base leading-none" aria-hidden>
          {activeCode ? flagFor(activeCode) : "🏳️"}
        </span>
        <span className="hidden max-w-[118px] truncate md:inline lg:max-w-[132px] xl:max-w-[156px]">{activeLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("switcher")}
          className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-elevated)]"
        >
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">{t("switcher")}</h3>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                {t("loading")}
              </div>
            ) : (
              memberships.map(({ workspace, is_primary }) => {
                const isActiveRow = workspace.id === active?.id;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    role="option"
                    aria-selected={isActiveRow}
                    onClick={() => void handleSwitch(workspace.id)}
                    disabled={switching}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      isActiveRow
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground hover:bg-secondary/60"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {flagFor(workspace.country_code)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{workspace.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {countryName(workspace.country_code)}
                        {is_primary ? " · ★" : ""}
                      </div>
                    </div>
                    {isActiveRow && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {t("active")}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <div className="border-t border-border bg-[var(--color-danger)]/10 px-4 py-2 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
