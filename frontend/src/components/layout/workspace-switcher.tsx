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
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
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

  function countryName(code: string) {
    try {
      return tCountry(code);
    } catch {
      return code;
    }
  }

  const activeLabel = active ? active.name : t("noWorkspace");
  const activeCountry = active?.country_code ?? "--";

  if (!loading && memberships.length === 0) {
    return null;
  }

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void load();
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="group inline-flex h-12 w-[248px] items-center justify-between rounded-2xl border border-[rgba(231,205,163,0.28)] bg-[linear-gradient(180deg,rgba(231,205,163,0.18)_0%,rgba(231,205,163,0.08)_100%)] px-3.5 text-left text-[var(--gold-light)] shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition-all duration-200 hover:border-[rgba(231,205,163,0.5)] hover:bg-[linear-gradient(180deg,rgba(231,205,163,0.24)_0%,rgba(231,205,163,0.12)_100%)] hover:text-white"
        title={`${t("switcher")}${active ? ` - ${activeLabel}` : ""}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--gold-light)]">
              {activeCountry}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--header-muted)]">
              {t("switcher")}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-bold">{activeLabel}</p>
        </div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t("switcher")}
          className="absolute right-0 top-full z-50 mt-3 w-[320px] overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
        >
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {t("switcher")}
            </p>
            <p className="mt-1 text-sm text-foreground">
              Calisma alanini degistirdiginde tum moduller yeni isyeri baglamina gore calisir.
            </p>
          </div>

          <div className="max-h-[320px] overflow-y-auto py-2">
            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
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
                    className={`mx-2 flex w-[calc(100%-1rem)] items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                      isActiveRow
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground hover:bg-secondary/60"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span className="mt-0.5 rounded-full border border-border bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">
                      {workspace.country_code}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{workspace.name}</p>
                        {isActiveRow ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {t("active")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {countryName(workspace.country_code)}
                        {is_primary ? " · varsayilan" : ""}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/workspace/onboarding");
              }}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Calisma alanlarini yonet
            </button>
          </div>

          {error ? (
            <div className="border-t border-border bg-[var(--color-danger)]/10 px-5 py-2 text-xs text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
