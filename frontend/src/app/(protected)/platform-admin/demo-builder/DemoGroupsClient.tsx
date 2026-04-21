"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DemoAccessStatus } from "@/lib/platform-admin/demo-access";

type AccountType = "individual" | "osgb" | "enterprise";

export type DemoAccountCard = {
  userId: string;
  organizationId: string | null;
  organizationName: string;
  fullName: string;
  email: string;
  locale: Locale;
  accountType: AccountType;
  createdAt: string;
  activeWorkspaceCount: number;
  accessExpiresAt: string | null;
  accessDisabledAt: string | null;
  accessStatus: Exclude<DemoAccessStatus, "not_demo">;
};

export type DemoGroups = Record<AccountType, DemoAccountCard[]>;

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

type ResetAccessResult = {
  ok: true;
  demo: {
    userId: string;
    accountType: AccountType;
    locale: Locale;
    organizationName: string;
    loginEmail: string;
    temporaryPassword: string;
    accessExpiresAt: string;
  };
  delivery: DeliveryResult;
};

type DisableAccessResult = {
  ok: true;
  demo: {
    userId: string;
    loginEmail: string;
    accessDisabledAt: string;
  };
};

const LOCALE_LABELS: Record<Locale, string> = {
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

function accountTypeLabel(value: AccountType) {
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

function accessStatusLabel(status: DemoAccountCard["accessStatus"]) {
  if (status === "disabled") return "Erisim kapali";
  if (status === "expired") return "Suresi doldu";
  return "24 saat demo";
}

export function DemoGroupsClient({ demoGroups }: { demoGroups: DemoGroups }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Olusturulan demolar</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Demo hesaplar burada hesap tipine gore gruplanir. Eski demo kullanicilar icin
            giris e-postasina ulasabilir, yeni gecici sifre uretebilir ve gerekiyorsa maili
            tekrar gonderebilirsin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">
            {demoGroups.individual.length + demoGroups.osgb.length + demoGroups.enterprise.length} demo hesap
          </Badge>
          <Badge variant="neutral">{demoGroups.osgb.length} OSGB</Badge>
          <Badge variant="neutral">{demoGroups.individual.length} bireysel</Badge>
          <Badge variant="neutral">{demoGroups.enterprise.length} kurumsal</Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {(["individual", "osgb", "enterprise"] as AccountType[]).map((groupKey) => (
          <DemoGroupCard key={groupKey} accountType={groupKey} items={demoGroups[groupKey]} />
        ))}
      </div>
    </div>
  );
}

function DemoGroupCard({
  accountType,
  items,
}: {
  accountType: AccountType;
  items: DemoAccountCard[];
}) {
  const [localItems, setLocalItems] = useState(items);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<ResetAccessResult | null>(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Bilgi panoya kopyalandi.");
    } catch {
      setError("Panoya kopyalanamadi.");
    }
  }

  async function renewAccess(item: DemoAccountCard) {
    setLoadingUserId(item.userId);
    setError(null);
    setMessage(null);
    setResetResult(null);

    try {
      const response = await fetch("/api/platform-admin/demo-builder/reset-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: item.userId,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | ResetAccessResult
        | { error?: string }
        | null;

      if (!response.ok || !json || !("ok" in json)) {
        setError(
          json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Demo erisim bilgileri yenilenemedi.",
        );
        return;
      }

      setResetResult(json);
      setLocalItems((current) =>
        current.map((entry) =>
          entry.userId === item.userId
            ? {
                ...entry,
                accessExpiresAt: json.demo.accessExpiresAt,
                accessDisabledAt: null,
                accessStatus: "active",
              }
            : entry,
        ),
      );
      setMessage(
        json.delivery.delivered
          ? "Yeni erisim bilgileri e-posta ile gonderildi."
          : "Yeni erisim bilgileri onizleme olarak hazirlandi.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Demo erisim bilgileri yenilenemedi.",
      );
    } finally {
      setLoadingUserId(null);
    }
  }

  async function disableAccess(item: DemoAccountCard) {
    setLoadingUserId(item.userId);
    setError(null);
    setMessage(null);
    setResetResult(null);

    try {
      const response = await fetch("/api/platform-admin/demo-builder/disable-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: item.userId,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | DisableAccessResult
        | { error?: string }
        | null;

      if (!response.ok || !json || !("ok" in json)) {
        setError(
          json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Demo erisimi engellenemedi.",
        );
        return;
      }

      setLocalItems((current) =>
        current.map((entry) =>
          entry.userId === item.userId
            ? {
                ...entry,
                accessDisabledAt: json.demo.accessDisabledAt,
                accessStatus: "disabled",
              }
            : entry,
        ),
      );
      setMessage("Demo erisimi kapatildi.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Demo erisimi engellenemedi.",
      );
    } finally {
      setLoadingUserId(null);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {accountTypeLabel(accountType)}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            {items.length} demo hesap
          </h3>
        </div>
        <Badge variant={accountType === "osgb" ? "accent" : "neutral"}>
          {accountTypeLabel(accountType)}
        </Badge>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      ) : null}

      {resetResult ? (
        <div className="mt-4 rounded-2xl border border-amber-200/40 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">Yeni erisim bilgisi</Badge>
            {resetResult.delivery.delivered ? (
              <Badge variant="success">Mail gonderildi</Badge>
            ) : (
              <Badge variant="warning">Onizleme modu</Badge>
            )}
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">Hesap</dt>
              <dd className="max-w-[65%] text-right font-medium text-foreground">
                {resetResult.demo.organizationName}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">E-posta</dt>
              <dd className="max-w-[65%] break-all text-right font-medium text-foreground">
                {resetResult.demo.loginEmail}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted-foreground">Gecici sifre</dt>
              <dd className="max-w-[65%] break-all text-right font-medium text-foreground">
                {resetResult.demo.temporaryPassword}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyText(resetResult.demo.loginEmail)}
            >
              E-postayi kopyala
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyText(resetResult.demo.temporaryPassword)}
            >
              Sifreyi kopyala
            </Button>
            <a
              href={
                resetResult.delivery.delivered
                  ? "/login"
                  : resetResult.delivery.preview.loginUrl
              }
              className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-primary shadow-[var(--shadow-soft)] hover:bg-secondary"
            >
              Giris sayfasini ac
            </a>
          </div>
        </div>
      ) : null}

      {localItems.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-5 text-sm text-muted-foreground">
          Bu grupta henuz demo hesap olusturulmadi.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {localItems.map((item) => (
            <div
              key={item.userId}
              className="rounded-2xl border border-border bg-secondary/35 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.organizationName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      item.accessStatus === "disabled"
                        ? "warning"
                        : item.accessStatus === "expired"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {accessStatusLabel(item.accessStatus)}
                  </Badge>
                  <Badge variant="neutral">{LOCALE_LABELS[item.locale] ?? item.locale}</Badge>
                </div>
              </div>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Demo sahibi</dt>
                  <dd className="font-medium text-foreground">{item.fullName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Aktif workspace</dt>
                  <dd className="font-medium text-foreground">{item.activeWorkspaceCount}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Olusturulma</dt>
                  <dd className="font-medium text-foreground">{formatDateTime(item.createdAt)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">
                    {item.accessStatus === "disabled" ? "Erisim kapatildi" : "Erisim bitisi"}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {item.accessStatus === "disabled" && item.accessDisabledAt
                      ? formatDateTime(item.accessDisabledAt)
                      : item.accessExpiresAt
                        ? formatDateTime(item.accessExpiresAt)
                        : "Belirlenmedi"}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyText(item.email)}>
                  E-postayi kopyala
                </Button>
                <Button
                  size="sm"
                  onClick={() => void renewAccess(item)}
                  disabled={loadingUserId === item.userId}
                >
                  {loadingUserId === item.userId ? "Hazirlaniyor..." : "Erisimi yenile"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void disableAccess(item)}
                  disabled={loadingUserId === item.userId || item.accessStatus === "disabled"}
                >
                  {item.accessStatus === "disabled" ? "Erisim kapali" : "Erisimi engelle"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
