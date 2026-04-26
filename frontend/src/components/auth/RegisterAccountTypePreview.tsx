"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Globe2,
  Languages,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommercialLeadDialog } from "@/components/auth/CommercialLeadDialog";
import { type CommercialInterestType } from "@/lib/account/register-offers";
import { locales, type Locale } from "@/i18n/routing";

type AccountType = "individual" | "osgb" | "enterprise";
type WizardStep = "account" | "country" | "language" | "role";

type RegisterAccountTypePreviewProps = {
  children: ReactNode;
};

type Choice<T extends string> = {
  value: T;
  title: string;
  description: string;
  icon?: typeof UserRound;
};

const accountChoices: Array<Choice<AccountType>> = [
  {
    value: "individual",
    title: "Bireysel profesyonel",
    description: "Uzman, hekim, DSP veya denetci olarak kendi calisma alaninla basla.",
    icon: UserRound,
  },
  {
    value: "osgb",
    title: "OSGB",
    description: "Firma portfoyu, ekip ve gorevlendirme surecleri icin kurulum talebi olustur.",
    icon: Building2,
  },
  {
    value: "enterprise",
    title: "Firma / Kurumsal",
    description: "Cok lokasyonlu veya ozel mevzuat ihtiyacli kurumsal yapi icin ilerle.",
    icon: Globe2,
  },
];

const countryChoices = [
  { value: "TR", title: "Turkiye", description: "Turkiye mevzuati ve Turkce varsayilan." },
  { value: "AZ", title: "Azerbaycan", description: "Azerbaycan bolgesi ve Azerbaycanca varsayilan." },
  { value: "US", title: "United States", description: "US operasyonlari ve English varsayilan." },
  { value: "GB", title: "United Kingdom", description: "UK operasyonlari ve English varsayilan." },
  { value: "DE", title: "Deutschland", description: "Almanya bolgesi ve Deutsch varsayilan." },
  { value: "FR", title: "France", description: "Fransa bolgesi ve Francais varsayilan." },
  { value: "ES", title: "Espana", description: "Ispanya bolgesi ve Espanol varsayilan." },
  { value: "RU", title: "Rossiya", description: "Rusca dil ve bolge hazirligi." },
  { value: "SA", title: "Saudi Arabia", description: "Arabic dil ve Korfez operasyon hazirligi." },
  { value: "AE", title: "United Arab Emirates", description: "English / Arabic ekipleri icin." },
  { value: "CN", title: "China", description: "Chinese dil ve Asya operasyon hazirligi." },
  { value: "JP", title: "Japan", description: "Japanese dil ve Asya operasyon hazirligi." },
  { value: "KR", title: "Korea", description: "Korean dil ve Asya operasyon hazirligi." },
  { value: "IN", title: "India", description: "Hindi / English ekipleri icin." },
  { value: "ID", title: "Indonesia", description: "Bahasa Indonesia dil tercihi." },
] as const;

const languageLabels: Record<Locale, string> = {
  tr: "Turkce",
  en: "English",
  ar: "Arabic",
  ru: "Russian",
  de: "Deutsch",
  fr: "Francais",
  es: "Espanol",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
  az: "Azerbaycanca",
  id: "Bahasa Indonesia",
};

const countryDefaultLanguage: Record<string, Locale> = {
  TR: "tr",
  AZ: "az",
  US: "en",
  GB: "en",
  DE: "de",
  FR: "fr",
  ES: "es",
  RU: "ru",
  SA: "ar",
  AE: "ar",
  CN: "zh",
  JP: "ja",
  KR: "ko",
  IN: "hi",
  ID: "id",
};

const roleChoices = [
  {
    value: "safety_professional",
    title: "ISG uzmani",
    description: "Risk analizi, saha denetimi, aksiyon ve mevzuat takibi.",
  },
  {
    value: "occupational_physician",
    title: "Isyeri hekimi",
    description: "Saglik gozetimi, hekim surecleri ve calisan kayitlari.",
  },
  {
    value: "safety_officer",
    title: "DSP / saglik personeli",
    description: "Saglik ekibi, saha destek ve takip gorevleri.",
  },
  {
    value: "auditor",
    title: "Denetci",
    description: "Saha denetimi, uygunsuzluk ve raporlama odakli rol.",
  },
  {
    value: "workspace_admin",
    title: "Calisma alani yoneticisi",
    description: "Kullanici, firma, rol ve workspace ayarlarini yonetir.",
  },
] as const;

const stepOrder: WizardStep[] = ["account", "country", "language", "role"];

const stepCopy: Record<WizardStep, { eyebrow: string; title: string; description: string }> = {
  account: {
    eyebrow: "1 / 4",
    title: "Hangi hesap turuyle basliyorsun?",
    description: "Bu cevap kayit sonrasi acilacak akisi belirler.",
  },
  country: {
    eyebrow: "2 / 4",
    title: "Calisma alaninin ulkesi hangisi?",
    description: "Mevzuat, RAG kapsami ve varsayilan workspace bu secime gore kurulur.",
  },
  language: {
    eyebrow: "3 / 4",
    title: "Arayuz ve belge dili ne olsun?",
    description: "Simdilik tum sayfalar cevrilmemis olsa da tercih hesap kaydina yazilir.",
  },
  role: {
    eyebrow: "4 / 4",
    title: "Ilk rolun ne olacak?",
    description: "Bu rol onboarding tarafinda ilk calisma alaninin temelini olusturur.",
  },
};

function choiceButtonClass(active: boolean) {
  return `w-full rounded-2xl border p-4 text-left transition-colors ${
    active
      ? "border-[var(--gold)] bg-[var(--gold)]/10 ring-1 ring-[var(--gold)]/25"
      : "border-border bg-card hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/5"
  }`;
}

export function RegisterAccountTypePreview({ children }: RegisterAccountTypePreviewProps) {
  const [step, setStep] = useState<WizardStep>("account");
  const [wizardOpen, setWizardOpen] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [languageCode, setLanguageCode] = useState<Locale | null>(null);
  const [roleKey, setRoleKey] = useState<(typeof roleChoices)[number]["value"] | null>(null);
  const [activeLeadType, setActiveLeadType] =
    useState<CommercialInterestType | null>(null);

  const stepIndex = stepOrder.indexOf(step);
  const selectedAccount = accountChoices.find((item) => item.value === accountType) ?? null;
  const selectedCountry = countryChoices.find((item) => item.value === countryCode) ?? null;
  const selectedLanguage = languageCode ? languageLabels[languageCode] : null;
  const selectedRole = roleChoices.find((item) => item.value === roleKey) ?? null;

  const summary = useMemo(
    () =>
      [
        selectedAccount?.title,
        selectedCountry?.title,
        selectedLanguage,
        selectedRole?.title,
      ].filter(Boolean),
    [selectedAccount, selectedCountry, selectedLanguage, selectedRole],
  );

  useEffect(() => {
    if (!accountType || !countryCode || !languageCode || !roleKey) return;

    window.localStorage.setItem(
      "risknova-register-context",
      JSON.stringify({
        accountType,
        countryCode,
        languageCode,
        roleKey,
      }),
    );
  }, [accountType, countryCode, languageCode, roleKey]);

  function advance(nextStep: WizardStep) {
    window.setTimeout(() => setStep(nextStep), 120);
  }

  function finish(nextRole: (typeof roleChoices)[number]["value"]) {
    setRoleKey(nextRole);
    setCompleted(true);
    setWizardOpen(false);
  }

  function goBack() {
    const previous = stepOrder[Math.max(stepIndex - 1, 0)];
    setStep(previous);
  }

  function restartWizard() {
    setWizardOpen(true);
    setCompleted(false);
    setStep("account");
  }

  function renderStep() {
    if (step === "account") {
      return accountChoices.map((item) => {
        const Icon = item.icon ?? UserRound;
        const active = item.value === accountType;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setAccountType(item.value);
              advance("country");
            }}
            className={choiceButtonClass(active)}
          >
            <span className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/12 text-[var(--gold)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {item.title}
                  {active ? <CheckCircle2 className="h-4 w-4 text-[var(--gold)]" /> : null}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </span>
          </button>
        );
      });
    }

    if (step === "country") {
      return countryChoices.map((item) => {
        const active = item.value === countryCode;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setCountryCode(item.value);
              setLanguageCode(countryDefaultLanguage[item.value] ?? "en");
              advance("language");
            }}
            className={choiceButtonClass(active)}
          >
            <span className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/12 text-[var(--gold)]">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {item.title}
                  {active ? <CheckCircle2 className="h-4 w-4 text-[var(--gold)]" /> : null}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </span>
          </button>
        );
      });
    }

    if (step === "language") {
      return locales.map((locale) => {
        const active = locale === languageCode;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => {
              setLanguageCode(locale);
              advance("role");
            }}
            className={choiceButtonClass(active)}
          >
            <span className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/12 text-[var(--gold)]">
                <Languages className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {languageLabels[locale]}
              </span>
              {active ? <CheckCircle2 className="ml-auto h-4 w-4 text-[var(--gold)]" /> : null}
            </span>
          </button>
        );
      });
    }

    return roleChoices.map((item) => {
      const active = item.value === roleKey;
      return (
        <button
          key={item.value}
          type="button"
          onClick={() => finish(item.value)}
          className={choiceButtonClass(active)}
        >
          <span className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/12 text-[var(--gold)]">
              <UserRound className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {item.title}
                {active ? <CheckCircle2 className="h-4 w-4 text-[var(--gold)]" /> : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {item.description}
              </span>
            </span>
          </span>
        </button>
      );
    });
  }

  return (
    <>
      {wizardOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-3 py-5 backdrop-blur-sm sm:items-center sm:px-6">
          <div className="w-full max-w-xl rounded-3xl border border-[var(--gold)]/25 bg-background shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
                  <ShieldCheck className="h-4 w-4" />
                  {stepCopy[step].eyebrow}
                </div>
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                    aria-label="Onceki soru"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                <h2 className="text-2xl font-semibold leading-tight text-foreground">
                  {stepCopy[step].title}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {stepCopy[step].description}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {stepOrder.map((item, index) => (
                  <span
                    key={item}
                    className={`h-1.5 rounded-full ${
                      index <= stepIndex ? "bg-[var(--gold)]" : "bg-border"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="max-h-[58vh] space-y-2 overflow-y-auto px-5 py-4 sm:px-6">
              {renderStep()}
            </div>
          </div>
        </div>
      ) : null}

      {completed && accountType && countryCode && languageCode && roleKey ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/8 px-4 py-3 text-sm leading-6 text-muted-foreground">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">Kayit yolu hazir</div>
                <div className="mt-1">{summary.join(" / ")}</div>
              </div>
              <button
                type="button"
                onClick={restartWizard}
                className="shrink-0 text-xs font-semibold text-[var(--gold)] underline underline-offset-4"
              >
                Degistir
              </button>
            </div>
          </div>

          {accountType === "individual" ? (
            <>
              <input form="register-individual-form" type="hidden" name="accountType" value="individual" />
              <input form="register-individual-form" type="hidden" name="countryCode" value={countryCode} />
              <input form="register-individual-form" type="hidden" name="languageCode" value={languageCode} />
              <input form="register-individual-form" type="hidden" name="roleKey" value={roleKey} />
              {children}
            </>
          ) : (
            <div className="rounded-3xl border border-[var(--gold)]/25 bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="text-sm font-semibold text-foreground">
                {accountType === "osgb" ? "OSGB icin kurulum gorusmesi" : "Firma / kurumsal kurulum gorusmesi"}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Secilen ulke, dil ve rol bilgisiyle gelistirici ekibe kisa bir talep birakabilirsiniz.
              </p>
              <Button
                type="button"
                className="mt-4 w-full"
                onClick={() => setActiveLeadType(accountType === "osgb" ? "osgb" : "enterprise")}
              >
                Gelistirici ile iletisime gec
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button type="button" className="w-full" onClick={() => setWizardOpen(true)}>
          Kayit sorularini baslat
        </Button>
      )}

      <CommercialLeadDialog
        accountType={activeLeadType ?? "enterprise"}
        open={activeLeadType !== null}
        onClose={() => setActiveLeadType(null)}
        countryCode={countryCode ?? "TR"}
        languageCode={languageCode ?? "tr"}
      />
    </>
  );
}
