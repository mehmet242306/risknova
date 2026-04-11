"use client";

import Link from "next/link";
import { Brand } from "./brand";
import { LanguageSelector } from "./language-selector";
import { useI18n } from "@/lib/i18n";

const navLinkClass =
  "text-sm font-medium text-white/70 transition-colors hover:text-white";

const ghostButtonClass =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-sm font-medium text-white transition-colors hover:bg-white/[0.10]";

const accentButtonClass =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#FBBF24_100%)] px-5 text-sm font-medium text-white shadow-[0_16px_34px_rgba(184,134,11,0.28)] transition-colors hover:brightness-[1.05]";

export function PublicHeader() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[var(--navy-deep)]/95 backdrop-blur-xl">
      <div className="page-shell py-4">
        <div className="flex items-center justify-between gap-4">
          <Brand href="/" inverted />

          <div className="flex items-center gap-3">
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
