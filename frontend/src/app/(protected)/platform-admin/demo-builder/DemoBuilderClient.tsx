"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultLocale, locales, type Locale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type AccountType = "individual" | "osgb" | "enterprise";

type DeliveryResult =
  | {
      delivered: true;
      mode: "resend";
    }
  | {
      delivered: false;
      mode: "preview";
      reason: string;
      preview: {
        loginEmail: string;
        temporaryPassword: string;
        loginUrl: string;
        resetPasswordUrl: string;
        note: string;
      };
    };

type DemoCreateResult = {
  ok: true;
  demo: {
    userId: string;
    organizationId: string;
    accountType: AccountType;
    locale: Locale;
    organizationName: string;
    companyWorkspaceId: string | null;
    redirectPath: string;
    loginEmail: string;
    temporaryPassword: string;
    accessExpiresAt: string;
  };
  delivery: DeliveryResult;
  seeded: {
    companyWorkspaceId: string | null;
    documentId: string | null;
    welcomeDocumentId: string | null;
    taskId: string | null;
    trainingId: string | null;
    notificationId: string | null;
    novaStarterPrompts: Array<{
      title: string;
      description: string;
      prompt: string;
    }>;
  };
};

const ACCOUNT_OPTIONS: Array<{
  value: AccountType;
  title: string;
  description: string;
}> = [
  {
    value: "individual",
    title: "Bireysel demo",
    description: "Uzman veya bagimsiz profesyonel akislarini gostermek icin yaln demo hesap.",
  },
  {
    value: "osgb",
    title: "OSGB demo",
    description: "Firma, personel, gorevlendirme ve dokuman akislarini gosteren yonetim hesabi.",
  },
  {
    value: "enterprise",
    title: "Kurumsal demo",
    description: "Kurumsal hesap akisi ve platform kapsamini anlatan demo iskeleti.",
  },
];

const LOCALE_LABELS: Record<Locale, string> = {
  tr: "Turkce",
  en: "English",
  ar: "Arabic",
  ru: "Russian",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  hi: "Hindi",
  az: "Azərbaycanca",
  id: "Bahasa Indonesia",
};

function accountLabel(value: AccountType) {
  if (value === "osgb") return "OSGB";
  if (value === "enterprise") return "Kurumsal";
  return "Bireysel";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DemoBuilderClient() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("osgb");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("TR");
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [companyName, setCompanyName] = useState("");
  const [includeSampleData, setIncludeSampleData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoCreateResult | null>(null);

  const selectedOption = useMemo(
    () => ACCOUNT_OPTIONS.find((item) => item.value === accountType) ?? ACCOUNT_OPTIONS[0],
    [accountType],
  );

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore clipboard failures in unsupported browsers
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/platform-admin/demo-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountType,
          displayName,
          email,
          countryCode,
          locale,
          includeSampleData,
          companyName,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | DemoCreateResult
        | { error?: string }
        | null;

      if (!response.ok || !json || !("ok" in json)) {
        const message =
          json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Demo hesabi olusturulamadi.";
        setResult(null);
        setError(message);
        return;
      }

      setResult(json);
      router.refresh();
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Demo hesabi olusturulamadi.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Tek tik demo olustur</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          Kullanici istedigi anda demo hesap ac, giris bilgisini paylas ve istenirse ilk ornek
          firma/workspace ile sistemi hazirla.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-3 lg:grid-cols-3">
          {ACCOUNT_OPTIONS.map((option) => {
            const active = option.value === accountType;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setAccountType(option.value)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-amber-400/40 bg-amber-500/10 shadow-[0_16px_34px_rgba(245,158,11,0.12)]"
                    : "border-border bg-card hover:border-amber-200/40 hover:bg-secondary/70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{option.title}</h3>
                  {active ? <Badge variant="accent">Secili</Badge> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Hesap / demo adi">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              className={inputClassName}
              placeholder="Ornek: Yildirim Demo"
            />
          </Field>
          <Field label="Kullanici e-postasi">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className={inputClassName}
              placeholder="demo@risknova.test"
            />
          </Field>
          <Field label="Ulke kodu">
            <input
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))}
              className={inputClassName}
              placeholder="TR"
            />
          </Field>
          <Field label="Demo dili">
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className={inputClassName}
            >
              {locales.map((value) => (
                <option key={value} value={value}>
                  {LOCALE_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ilk firma / workspace adi">
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className={inputClassName}
              placeholder={
                accountType === "osgb"
                  ? "Ornek: Demo Musteri Firmasi"
                  : accountType === "enterprise"
                    ? "Ornek: Demo Kampus"
                    : "Ornek: Demo Calisma Alani"
              }
            />
          </Field>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-4">
          <input
            type="checkbox"
            checked={includeSampleData}
            onChange={(event) => setIncludeSampleData(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Ornek veri ve ilk demo kayitlarini ekle
            </span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              Ilk firma/workspace, ornek dokuman ve uygun hesap tipinde demo gorev iskeleti olusturulur.
            </span>
          </span>
        </label>

        {error ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Demo hazirlaniyor..." : "Demo hesabi olustur"}
          </Button>
          <Badge variant="neutral">{accountLabel(accountType)} akisi</Badge>
          {includeSampleData ? <Badge variant="success">Ornek veri acik</Badge> : null}
          <span className="text-sm text-muted-foreground">{selectedOption.description}</span>
        </div>
      </form>

      {result ? (
        <section className="rounded-3xl border border-success/20 bg-success/5 p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Demo hazir</Badge>
            <Badge variant="accent">{accountLabel(result.demo.accountType)}</Badge>
            {result.delivery.delivered ? (
              <Badge variant="default">Mail gonderildi</Badge>
            ) : (
              <Badge variant="warning">Onizleme modu</Badge>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ResultCard
              title="Giris bilgileri"
              rows={[
                ["Hesap", result.demo.organizationName],
                ["Dil", LOCALE_LABELS[result.demo.locale]],
                ["E-posta", result.demo.loginEmail],
                ["Gecici sifre", result.demo.temporaryPassword],
                ["Erisim bitisi", formatDateTime(result.demo.accessExpiresAt)],
                ["Ilk yonlendirme", result.demo.redirectPath],
              ]}
              actions={
                <>
                  <Button variant="outline" size="sm" onClick={() => void copyText(result.demo.loginEmail)}>
                    E-postayi kopyala
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText(result.demo.temporaryPassword)}
                  >
                    Sifreyi kopyala
                  </Button>
                </>
              }
            />

            <ResultCard
              title="Dagitim ve tohumlama"
              rows={[
                ["Mail modu", result.delivery.delivered ? "Resend" : "Onizleme"],
                ["Ornek workspace", result.seeded.companyWorkspaceId ? "Olusturuldu" : "Yok"],
                ["Ornek dokuman", result.seeded.documentId ? "Hazir" : "Yok"],
                ["Hos geldin dokumani", result.seeded.welcomeDocumentId ? "Hazir" : "Yok"],
                ["Ilk egitim kaydi", result.seeded.trainingId ? "Hazir" : "Yok"],
                ["Ilk bildirim", result.seeded.notificationId ? "Hazir" : "Yok"],
                ["Ornek gorev", result.seeded.taskId ? "Hazir" : "Yok"],
              ]}
              actions={
                result.delivery.delivered ? null : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void copyText(
                          JSON.stringify(
                            result.delivery.mode === "preview" ? result.delivery.preview : {},
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      Onizlemeyi kopyala
                    </Button>
                    <a
                      href={result.delivery.mode === "preview" ? result.delivery.preview.loginUrl : "/login"}
                      className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-primary shadow-[var(--shadow-soft)] hover:bg-secondary"
                    >
                      Giris sayfasini ac
                    </a>
                  </>
                )
              }
            />
          </div>

          {result.seeded.novaStarterPrompts.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Nova baslangic promptlari</h3>
                <Badge variant="accent">{result.seeded.novaStarterPrompts.length} hazir prompt</Badge>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                {result.seeded.novaStarterPrompts.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border bg-secondary/40 p-4"
                  >
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    <p className="mt-3 line-clamp-4 text-xs leading-6 text-foreground/80">
                      {item.prompt}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText(item.prompt)}
                      >
                        Promptu kopyala
                      </Button>
                      <a
                        href={`/solution-center?prompt=${encodeURIComponent(item.prompt)}`}
                        className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-primary shadow-[var(--shadow-soft)] hover:bg-secondary"
                      >
                        Nova'da ac
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!result.delivery.delivered && result.delivery.mode === "preview" ? (
            <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
              Mail servisi tanimli olmadigi icin demo bilgileri gonderilmedi. Bu oturumda
              onizleme bilgilerini manuel paylasabilirsin.
            </div>
          ) : null}

          {!["tr", "en"].includes(result.demo.locale) ? (
            <div className="mt-4 rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
              Secilen dil hesap tercihine yazildi. Bu locale icin tam ceviri olmayan yerlerde sistem
              varsayilan dil fallback'i kullanabilir.
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function ResultCard({
  title,
  rows,
  actions,
}: {
  title: string;
  rows: Array<[string, string]>;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="max-w-[65%] break-all text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const inputClassName =
  "h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-amber-300 focus:ring-2 focus:ring-amber-200/50";
