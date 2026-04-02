"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Supported languages                                                 */
/* ------------------------------------------------------------------ */

interface Language {
  code: Locale;
  label: string;
  flag: string;
}

const languages: Language[] = [
  { code: "tr", label: "Turkce", flag: "\uD83C\uDDF9\uD83C\uDDF7" },
  { code: "en", label: "English", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
  { code: "ru", label: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", flag: "\uD83C\uDDF7\uD83C\uDDFA" },
  { code: "de", label: "Deutsch", flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  { code: "fr", label: "Francais", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { code: "es", label: "Espanol", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { code: "zh", label: "\u4E2D\u6587", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
  { code: "ja", label: "\u65E5\u672C\u8A9E", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "hi", label: "\u0939\u093F\u0928\u094D\u0926\u0940", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function LanguageSelector({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const { locale, setLocale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => l.code === locale) || languages[0];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectLanguage(lang: Language) {
    setLocale(lang.code);
    setOpen(false);
  }

  const isLight = variant === "light";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors",
          isLight
            ? "text-foreground/70 hover:text-foreground hover:bg-secondary"
            : "text-white/70 hover:text-white hover:bg-white/[0.08]",
        )}
        aria-label="Dil secimi"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="hidden sm:inline">{current.code.toUpperCase()}</span>
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
          className={cn("transition-transform", open && "rotate-180")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border shadow-lg",
            isLight
              ? "border-border bg-card"
              : "border-white/10 bg-[var(--navy-deep)]",
          )}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => selectLanguage(lang)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                isLight
                  ? "hover:bg-secondary text-foreground"
                  : "hover:bg-white/[0.08] text-white/80 hover:text-white",
                current.code === lang.code && (isLight ? "bg-primary/5 text-primary font-medium" : "bg-white/[0.06] text-primary font-medium"),
              )}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
              {current.code === lang.code && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-auto text-primary"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
