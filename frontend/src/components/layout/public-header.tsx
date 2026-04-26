"use client";

import Link from "next/link";
import { Brand } from "./brand";
import { LanguageSelector } from "./language-selector";
import { useI18n } from "@/lib/i18n";

const navLinkClass =
  "text-sm font-medium text-white/70 transition-colors hover:text-white";

const ghostButtonClass =
  "inline-flex h-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm font-medium text-white transition-colors hover:bg-white/[0.10] sm:h-11 sm:rounded-2xl sm:px-5";

const accentButtonClass =
  "hidden h-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#FBBF24_100%)] px-5 text-sm font-medium text-white shadow-[0_16px_34px_rgba(184,134,11,0.28)] transition-colors hover:brightness-[1.05] sm:inline-flex";

export function PublicHeader() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[var(--navy-deep)]/95 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1480px] px-3 py-3 sm:px-6 sm:py-4 xl:px-8 2xl:px-10">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
          <Brand href="/" compact inverted className="shrink-0 sm:hidden" />
          <Brand href="/" inverted className="hidden min-w-0 sm:inline-flex" />

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
            <nav className="hidden items-center gap-6 lg:flex">
              <Link href="/#features" className={navLinkClass}>
                {t("nav.features")}
              </Link>
              <Link href="/#how-it-works" className={navLinkClass}>
                {t("nav.howItWorks")}
              </Link>
            </nav>

            <LanguageSelector variant="dark" />

            <Link href="/login" className={ghostButtonClass}>
              {t("common.login")}
            </Link>

            <Link href="/register" className={accentButtonClass}>
              {t("common.register")}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
