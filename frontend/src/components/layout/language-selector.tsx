"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* SVG Flag icons                                                      */
/* ------------------------------------------------------------------ */

function FlagTR() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" className="h-4 w-6 rounded-sm">
      <rect width="1200" height="800" fill="#E30A17"/>
      <circle cx="425" cy="400" r="200" fill="#fff"/>
      <circle cx="475" cy="400" r="160" fill="#E30A17"/>
      <polygon fill="#fff" points="583,400 530,430 543,382 505,352 555,348"/>
    </svg>
  );
}

function FlagGB() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="30" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10"/>
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6"/>
    </svg>
  );
}

function FlagSA() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="30" fill="#006C35"/>
      <text x="30" y="18" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="Arial">AR</text>
    </svg>
  );
}

function FlagRU() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="10" fill="#fff"/>
      <rect width="60" height="10" y="10" fill="#0039A6"/>
      <rect width="60" height="10" y="20" fill="#D52B1E"/>
    </svg>
  );
}

function FlagDE() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="10" fill="#000"/>
      <rect width="60" height="10" y="10" fill="#DD0000"/>
      <rect width="60" height="10" y="20" fill="#FFCE00"/>
    </svg>
  );
}

function FlagFR() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="20" height="30" fill="#002395"/>
      <rect width="20" height="30" x="20" fill="#fff"/>
      <rect width="20" height="30" x="40" fill="#ED2939"/>
    </svg>
  );
}

function FlagES() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="7.5" fill="#AA151B"/>
      <rect width="60" height="15" y="7.5" fill="#F1BF00"/>
      <rect width="60" height="7.5" y="22.5" fill="#AA151B"/>
    </svg>
  );
}

function FlagCN() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="30" fill="#DE2910"/>
      <polygon fill="#FFDE00" points="12,5 13.5,9.5 18,9.5 14.5,12.5 15.8,17 12,14 8.2,17 9.5,12.5 6,9.5 10.5,9.5"/>
    </svg>
  );
}

function FlagJP() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="30" fill="#fff"/>
      <circle cx="30" cy="15" r="9" fill="#BC002D"/>
    </svg>
  );
}

function FlagIN() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="10" fill="#FF9933"/>
      <rect width="60" height="10" y="10" fill="#fff"/>
      <rect width="60" height="10" y="20" fill="#138808"/>
      <circle cx="30" cy="15" r="3" fill="#000080" fillOpacity="0.8"/>
    </svg>
  );
}

function FlagKR() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="30" fill="#fff"/>
      <circle cx="30" cy="15" r="8" fill="#C60C30"/>
      <path d="M30,7 A8,8 0 0,1 30,23 A4,4 0 0,1 30,15 A4,4 0 0,0 30,7Z" fill="#003478"/>
    </svg>
  );
}

function FlagAZ() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="10" fill="#00B5E2"/>
      <rect width="60" height="10" y="10" fill="#E4002B"/>
      <rect width="60" height="10" y="20" fill="#00AF66"/>
      <circle cx="32" cy="15" r="5" fill="#fff"/>
      <circle cx="33.5" cy="15" r="4" fill="#E4002B"/>
      <polygon fill="#fff" points="37,15 35.5,16 36,14.5 34.8,13.5 36.3,13.5"/>
    </svg>
  );
}

function FlagID() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" className="h-4 w-6 rounded-sm">
      <rect width="60" height="15" fill="#CE1126"/>
      <rect width="60" height="15" y="15" fill="#fff"/>
    </svg>
  );
}

const flagComponents: Record<string, () => React.JSX.Element> = {
  tr: FlagTR, en: FlagGB, ar: FlagSA, ru: FlagRU, de: FlagDE,
  fr: FlagFR, es: FlagES, zh: FlagCN, ja: FlagJP, hi: FlagIN,
  ko: FlagKR, az: FlagAZ, id: FlagID,
};

/* ------------------------------------------------------------------ */
/* Supported languages                                                 */
/* ------------------------------------------------------------------ */

interface Language {
  code: Locale;
  label: string;
}

const languages: Language[] = [
  { code: "tr", label: "T\u00fcrk\u00e7e" },
  { code: "en", label: "English" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" },
  { code: "ru", label: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Fran\u00e7ais" },
  { code: "es", label: "Espa\u00f1ol" },
  { code: "zh", label: "\u4E2D\u6587" },
  { code: "ja", label: "\u65E5\u672C\u8A9E" },
  { code: "ko", label: "\uD55C\uAD6D\uC5B4" },
  { code: "az", label: "Az\u0259rbaycan Dili" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "hi", label: "\u0939\u093F\u0928\u094D\u0926\u0940" },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function LanguageSelector({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const { locale, setLocale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  const current = languages.find((l) => l.code === locale) || languages[0];
  const FlagIcon = flagComponents[current.code] || FlagTR;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
        <FlagIcon />
        <span className="hidden sm:inline">{current.code.toUpperCase()}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-transform", open && "rotate-180")}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border shadow-lg",
          isLight ? "border-border bg-card" : "border-white/10 bg-[var(--navy-deep)]",
        )}>
          {languages.map((lang) => {
            const Flag = flagComponents[lang.code] || FlagTR;
            const isActive = current.code === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => selectLanguage(lang)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                  isLight ? "hover:bg-secondary text-foreground" : "hover:bg-white/[0.08] text-white/80 hover:text-white",
                  isActive && (isLight ? "bg-primary/5 text-primary font-medium" : "bg-white/[0.06] text-primary font-medium"),
                )}
              >
                <Flag />
                <span>{lang.label}</span>
                {isActive && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-primary">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
