"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusAlert } from "@/components/ui/status-alert";
import { setActiveWorkspace, setLocalWorkspaceContext } from "@/lib/supabase/workspace-api";

type CountryOption = {
  code: string;
  name: string;
  defaultLanguage: string;
  timezone: string;
  suggestedWorkspaceName: string;
};

type RoleOption = {
  value: string;
  label: string;
};

type LanguageOption = {
  value: string;
  label: string;
};

type CertificationOption = {
  id: string;
  countryCode: string;
  roleKey: string;
  code: string;
  name: string;
  issuer: string;
  level: string | null;
};

type ExistingMembership = {
  id: string;
  roleKey: string;
  certificationId: string | null;
  isPrimary: boolean;
  workspace: {
    id: string;
    name: string;
    country_code: string;
    default_language: string;
    timezone: string;
  };
};

type OnboardingPayload = {
  profile: {
    id: string;
    fullName: string | null;
    email: string | null;
    title: string | null;
    phone: string | null;
    activeWorkspaceId: string | null;
  };
  organization: {
    id: string;
    name: string;
    countryCode: string | null;
  };
  countries: CountryOption[];
  recommendedCountryCode: string;
  roleOptions: RoleOption[];
  languageOptions: LanguageOption[];
  certifications: CertificationOption[];
  warnings?: string[];
  memberships: ExistingMembership[];
};

type AccountContextPayload = {
  userId: string;
  isPlatformAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  accountType: "individual" | "osgb" | "enterprise" | null;
  membershipRole: "owner" | "admin" | "staff" | "viewer" | null;
  currentPlanCode: string | null;
};

type AccountUsage = {
  maxActiveWorkspaces: number | null;
  maxActiveStaffSeats: number | null;
  hasPersonnelModule: boolean;
  hasTaskTracking: boolean;
  hasAnnouncements: boolean;
  contactRequired: boolean;
  activeWorkspaceCount: number;
  activeStaffCount: number;
};

type AccountContextResponse =
  | {
      ok?: boolean;
      error?: string;
      context?: AccountContextPayload;
      usage?: AccountUsage | null;
      redirectPath?: string;
    }
  | {
      error?: string;
    };

type AccountOnboardingResponse = {
  ok?: boolean;
  error?: string;
  redirectPath?: string;
};

type WorkspaceOnboardingResponse = {
  ok?: boolean;
  error?: string;
  mode?: "local_fallback";
  warning?: string;
  workspace?: {
    id: string;
    name: string;
    countryCode: string;
    defaultLanguage: string;
    timezone: string;
  };
};

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  if (!raw.trim()) return null;
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeOnboardingError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("schema cache") ||
    normalized.includes("does not exist") ||
    normalized.includes("relation")
  ) {
    return "Hesap kurulumu icin gereken yeni veritabani alanlari henuz hazir degil. Lutfen migration uygulandiktan sonra tekrar deneyin.";
  }

  return message || fallback;
}

const selectClassName =
  "h-12 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-10 text-sm text-slate-950 shadow-[var(--shadow-soft)] transition-colors transition-shadow hover:border-primary/40 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring)] dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] [&_option]:bg-white [&_option]:text-slate-950 dark:[&_option]:bg-slate-950 dark:[&_option]:text-slate-100";

function formatPlanLabel(planCode: string | null | undefined) {
  switch (planCode) {
    case "individual_free":
      return "Bireysel Free";
    case "osgb_starter":
      return "OSGB Starter";
    case "enterprise":
      return "Kurumsal";
    default:
      return "Tanimsiz paket";
  }
}

function formatRoleLabel(role: string | null | undefined) {
  if (!role) return "Rol secilmedi";
  return role.replaceAll("_", " ");
}

export function WorkspaceOnboardingClient({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountContext, setAccountContext] = useState<AccountContextPayload | null>(null);
  const [accountUsage, setAccountUsage] = useState<AccountUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [payload, setPayload] = useState<OnboardingPayload | null>(null);
  const [countryCode, setCountryCode] = useState("TR");
  const [defaultLanguage, setDefaultLanguage] = useState("tr");
  const [roleKey, setRoleKey] = useState("safety_professional");
  const [certificationId, setCertificationId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceNameDirty, setWorkspaceNameDirty] = useState(false);
  const [accountType, setAccountType] = useState<"individual" | "osgb" | "enterprise">("individual");
  const [accountName, setAccountName] = useState("");
  const [enterpriseForm, setEnterpriseForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
    estimatedEmployeeCount: "",
    estimatedLocationCount: "",
  });
  const [message, setMessage] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAccountContext() {
      setAccountLoading(true);
      setMessage(null);

      try {
        const accountResponse = await fetch("/api/account/context", {
          method: "GET",
          credentials: "include",
        });

        const accountJson = await readJsonSafely<AccountContextResponse>(accountResponse);

        if (!accountResponse.ok || !accountJson || !("context" in accountJson) || !accountJson.context) {
          throw new Error(
            accountJson && "error" in accountJson
              ? accountJson.error || "Hesap baglami okunamadi."
              : "Hesap baglami okunamadi.",
          );
        }

        if (cancelled) return;
        setAccountContext(accountJson.context);
        setAccountUsage("usage" in accountJson ? accountJson.usage ?? null : null);

        if (accountJson.context.isPlatformAdmin) {
          router.replace("/platform-admin");
          return;
        }

        if (!accountJson.context.accountType) {
          setLoading(false);
          return;
        }

        const response = await fetch("/api/workspaces/onboarding", {
          method: "GET",
          credentials: "include",
        });

        const json = (await response.json()) as OnboardingPayload | { error?: string };
        if (!response.ok) {
          throw new Error("error" in json ? json.error || "Workspace onboarding verisi alinamadi." : "Workspace onboarding verisi alinamadi.");
        }

        if (cancelled) return;
        const data = json as OnboardingPayload;
        setPayload(data);
        const nextCountryCode =
          data.countries.find((item) => item.code === data.recommendedCountryCode)?.code ??
          data.countries[0]?.code ??
          "TR";
        const nextRoleKey =
          data.roleOptions.find((item) => item.value === "safety_professional")?.value ??
          data.roleOptions[0]?.value ??
          "viewer";
        const nextLanguage =
          data.countries.find((item) => item.code === nextCountryCode)?.defaultLanguage ??
          data.languageOptions[0]?.value ??
          "tr";

        setCountryCode(nextCountryCode);
        setDefaultLanguage(nextLanguage);
        setRoleKey(nextRoleKey);
      } catch (error) {
        if (!cancelled) {
          setAccountUsage(null);
          setMessage({
            tone: "danger",
            text: error instanceof Error ? error.message : "Onboarding verisi alinamadi.",
          });
        }
      } finally {
        if (!cancelled) {
          setAccountLoading(false);
          setLoading(false);
        }
      }
    }

    void loadAccountContext();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const selectedCountry = useMemo(
    () => payload?.countries.find((item) => item.code === countryCode) ?? null,
    [countryCode, payload],
  );

  const availableCertifications = useMemo(
    () =>
      (payload?.certifications ?? []).filter(
        (item) => item.countryCode === countryCode && item.roleKey === roleKey,
      ),
    [countryCode, payload, roleKey],
  );

  const missingWorkspaceTables = useMemo(
    () =>
      (payload?.warnings ?? []).some((item) =>
        item.toLowerCase().includes("workspace tablolar"),
      ),
    [payload],
  );
  const memberships = payload?.memberships ?? [];
  const selectedLanguageOption =
    payload?.languageOptions.find((item) => item.value === defaultLanguage) ?? null;
  const workspaceLimit = accountUsage?.maxActiveWorkspaces ?? null;
  const selectedCountryWorkspace = memberships.find(
    (membership) => membership.workspace.country_code === countryCode,
  );
  const hasAnyWorkspace = memberships.length > 0;
  const pendingWorkspaceSlots = workspaceLimit === null ? 1 : Math.max(workspaceLimit - memberships.length, 0);
  const workspaceLimitReached =
    workspaceLimit !== null &&
    memberships.length >= workspaceLimit &&
    !selectedCountryWorkspace;

  const needsAccountTypeSelection = !accountLoading && !accountContext?.accountType;

  useEffect(() => {
    if (!selectedCountry) return;
    if (!workspaceNameDirty) {
      setWorkspaceName(selectedCountry.suggestedWorkspaceName);
    }
    setDefaultLanguage(selectedCountry.defaultLanguage);
  }, [selectedCountry, workspaceNameDirty]);

  useEffect(() => {
    setCertificationId("");
  }, [countryCode, roleKey]);

  useEffect(() => {
    if (!payload?.countries?.length) return;
    if (!payload.countries.some((item) => item.code === countryCode)) {
      setCountryCode(payload.countries[0].code);
    }
  }, [countryCode, payload]);

  useEffect(() => {
    if (!payload?.roleOptions?.length) return;
    if (!payload.roleOptions.some((item) => item.value === roleKey)) {
      setRoleKey(payload.roleOptions[0].value);
    }
  }, [payload, roleKey]);

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          displayName: accountName || undefined,
          companyName: enterpriseForm.companyName || undefined,
          contactName: enterpriseForm.contactName || undefined,
          email: enterpriseForm.email || undefined,
          phone: enterpriseForm.phone || null,
          message: enterpriseForm.message || null,
          estimatedEmployeeCount: enterpriseForm.estimatedEmployeeCount
            ? Number(enterpriseForm.estimatedEmployeeCount)
            : null,
          estimatedLocationCount: enterpriseForm.estimatedLocationCount
            ? Number(enterpriseForm.estimatedLocationCount)
            : null,
        }),
      });

      const json = await readJsonSafely<AccountOnboardingResponse>(response);

      if (!response.ok || !json?.ok || !json.redirectPath) {
        throw new Error(json?.error || "Hesap tipi secimi su anda tamamlanamiyor. Lutfen tekrar deneyin.");
      }

      router.refresh();
      router.replace(json.redirectPath);
    } catch (error) {
      setMessage({
        tone: "danger",
        text: normalizeOnboardingError(
          error,
          "Hesap tipi secimi tamamlanamadi.",
        ),
      });
    } finally {
      setAccountSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload) return;
    if (workspaceLimitReached) {
      setMessage({
        tone: "info",
        text: "Mevcut paketin icin tanimli aktif calisma alani limitine ulastin. Yeni alan acmadan once mevcut alanlardan birini kullan veya paketini yukselt.",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      if (missingWorkspaceTables) {
        const selectedCountry =
          payload.countries.find((item) => item.code === countryCode) ?? null;

        setLocalWorkspaceContext({
          id: `local-${countryCode}`,
          organizationId: payload.organization.id,
          countryCode,
          name: workspaceName || selectedCountry?.suggestedWorkspaceName || "Yerel Workspace",
          defaultLanguage,
          timezone: selectedCountry?.timezone || "Europe/Istanbul",
          roleKey,
          certificationId: certificationId || null,
          isPrimary: true,
        });

        setMessage({
          tone: "info",
          text: "Workspace tabloları bu veritabanında henüz yok. Seçimin yerel bağlam olarak kaydedildi; Nova seçtiğin ülke ile çalışacak.",
        });

          router.refresh();
          router.replace(nextPath || "/companies");
          return;
        }

      const response = await fetch("/api/workspaces/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode,
          defaultLanguage,
          roleKey,
          certificationId: certificationId || null,
          workspaceName,
          makePrimary: true,
        }),
      });

      const json = await readJsonSafely<WorkspaceOnboardingResponse>(response);
      if (!response.ok || !json?.ok || !json.workspace?.id) {
        throw new Error(json?.error || "Workspace kurulumu su anda tamamlanamiyor.");
      }

      if (json.mode === "local_fallback") {
        setLocalWorkspaceContext({
          id: json.workspace.id,
          organizationId: payload.organization.id,
          countryCode: json.workspace.countryCode,
          name: json.workspace.name,
          defaultLanguage: json.workspace.defaultLanguage,
          timezone: json.workspace.timezone,
          roleKey,
          certificationId: certificationId || null,
          isPrimary: true,
        });
      }

      setMessage({
        tone: json.mode === "local_fallback" ? "info" : "success",
        text:
          json.mode === "local_fallback"
            ? json.warning ||
              `${json.workspace.name} yerel workspace baglami olarak hazirlandi. Nova secilen jurisdiction ile calisacak.`
            : `${json.workspace.name} hazirlandi. Nova artik bu jurisdiction ile calisacak.`,
      });

      router.refresh();
      router.replace(nextPath || "/companies");
    } catch (error) {
      setMessage({
        tone: "danger",
        text: normalizeOnboardingError(
          error,
          "Workspace kurulumu tamamlanamadi.",
        ),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivateExisting(workspaceId: string) {
    setMessage(null);
    const ok = await setActiveWorkspace(workspaceId);
    if (!ok) {
      setMessage({
        tone: "danger",
        text: "Mevcut workspace aktif yapilamadi.",
      });
      return;
    }

    router.refresh();
    router.replace(nextPath || "/companies");
  }

  if (accountLoading || loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Hesap Kurulumu"
          title="Hesap ve calisma baglami hazirlaniyor"
          description="RiskNova yeni hesap modelini mevcut verinle uyumlu sekilde hazirliyor."
        />
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
              <p className="text-sm text-muted-foreground">Onboarding verisi yukleniyor...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsAccountTypeSelection) {
    const optionCardClass =
      "rounded-3xl border border-border bg-card p-5 text-left shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--shadow-elevated)]";

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Hesap Tipi"
          title="RiskNova hesabını seç"
          description="Platform Admin burada bir seçenek değildir. Müşteri tarafında sadece Bireysel, OSGB ve Kurumsal akışları açılır."
        />

        {message ? <StatusAlert tone={message.tone}>{message.text}</StatusAlert> : null}

        <Card>
          <CardHeader>
            <CardTitle>Hangi yapı ile başlayacaksın?</CardTitle>
            <CardDescription>
              Bireysel kullanicilar firma ekleyebilir. OSGB hesaplari ekip, gorevlendirme ve is takibi yonetir. Kurumsal akis su asamada iletisim talebi ile ilerler.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => void handleAccountSubmit(event)}>
              <div className="grid gap-4 lg:grid-cols-3">
                <button
                  type="button"
                  className={`${optionCardClass} ${accountType === "individual" ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setAccountType("individual")}
                >
                  <div className="text-base font-semibold text-foreground">Bireysel</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Bağımsız çalışan uzman, hekim, danışman veya bireysel profesyoneller için.
                  </p>
                </button>

                <button
                  type="button"
                  className={`${optionCardClass} ${accountType === "osgb" ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setAccountType("osgb")}
                >
                  <div className="text-base font-semibold text-foreground">OSGB</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    OSGB firmaları, ekip yönetimi, personel görevlendirme ve iş takibi için.
                  </p>
                </button>

                <button
                  type="button"
                  className={`${optionCardClass} ${accountType === "enterprise" ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setAccountType("enterprise")}
                >
                  <div className="text-base font-semibold text-foreground">Kurumsal</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Çok lokasyonlu, özel ihtiyaçlı kurumlar ve enterprise çözümler için.
                  </p>
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <Input
                  id="accountName"
                  name="accountName"
                  label={accountType === "osgb" ? "OSGB / hesap adı" : "Hesap adı"}
                  placeholder={accountType === "osgb" ? "Ör: Güven OSGB" : "Ör: Ayşe Demir"}
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                />

                {accountType !== "enterprise" ? (
                  <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    {accountType === "individual"
                      ? "Bireysel ücretsiz plan varsayılan olarak 1 aktif firma / workspace ile başlar."
                      : "OSGB Starter planı varsayılan olarak aktif firma ve personel limitleri ile başlar."}
                  </div>
                ) : null}
              </div>

              {accountType === "enterprise" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    id="companyName"
                    label="Şirket adı"
                    value={enterpriseForm.companyName}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({
                        ...current,
                        companyName: event.target.value,
                      }))
                    }
                  />
                  <Input
                    id="contactName"
                    label="İletişim kişisi"
                    value={enterpriseForm.contactName}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({
                        ...current,
                        contactName: event.target.value,
                      }))
                    }
                  />
                  <Input
                    id="enterpriseEmail"
                    type="email"
                    label="E-posta"
                    value={enterpriseForm.email}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                  <Input
                    id="enterprisePhone"
                    label="Telefon"
                    value={enterpriseForm.phone}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                  <Input
                    id="employeeCount"
                    type="number"
                    label="Tahmini çalışan sayısı"
                    value={enterpriseForm.estimatedEmployeeCount}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({
                        ...current,
                        estimatedEmployeeCount: event.target.value,
                      }))
                    }
                  />
                  <Input
                    id="locationCount"
                    type="number"
                    label="Tahmini lokasyon sayısı"
                    value={enterpriseForm.estimatedLocationCount}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({
                        ...current,
                        estimatedLocationCount: event.target.value,
                      }))
                    }
                  />
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-foreground" htmlFor="enterpriseMessage">
                      Not / ihtiyaç özeti
                    </label>
                    <textarea
                      id="enterpriseMessage"
                      value={enterpriseForm.message}
                      onChange={(event) =>
                        setEnterpriseForm((current) => ({
                          ...current,
                          message: event.target.value,
                        }))
                      }
                      className="min-h-28 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)]"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={accountSubmitting}>
                  {accountSubmitting
                    ? "Kaydediliyor..."
                    : accountType === "enterprise"
                      ? "Iletisim talebi gonder"
                      : "Devam et"}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Platform admin kullanıcıları bu akıştan bağımsız olarak her zaman admin paneline yönlendirilir.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Calisma Alani Kurulumu"
          title="Calisma alani baglami henuz hazir degil"
          description="Calisma alani sistemi migration veya profil baglami eksik oldugu icin onboarding verisi okunamadi."
        />
        {message ? <StatusAlert tone={message.tone}>{message.text}</StatusAlert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ilk Kurulum"
        title="Profilini dogrula, calisma alanini ac"
        description="Kisisel bilgiler tum deneyimde ortak kalir. Calisma alanlari ise firma baglami, ulke, dil ve RAG davranisini belirler. Ilk alani olusturmadan temel moduller acilmaz."
        meta={
          <>
            <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs font-semibold text-foreground">
              Paket: {formatPlanLabel(accountContext?.currentPlanCode)}
            </span>
            <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs font-semibold text-foreground">
              {workspaceLimit === null
                ? `${memberships.length} alan aktif`
                : `${memberships.length} / ${workspaceLimit} alan kullaniliyor`}
            </span>
            <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs font-semibold text-foreground">
              {hasAnyWorkspace ? "Calisma alani hazir" : "Calisma alani bekleniyor"}
            </span>
          </>
        }
      />

      {message ? <StatusAlert tone={message.tone}>{message.text}</StatusAlert> : null}
      {payload.warnings?.map((warning) => (
        <StatusAlert key={warning} tone="info">
          {warning}
        </StatusAlert>
      ))}

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calisma alanlari</CardTitle>
              <CardDescription>
                Paketine gore acabilecegin alanlari burada gorursun. Her alan firma baglami, ulke, dil ve RAG filtresini kendi icinde tasir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {memberships.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-4 text-sm text-muted-foreground">
                  Henuz aktif bir calisma alani yok. Ilk alani actiginda Firmalar, Risk Analizi, DOF, Aksiyon, ISG Kutuphanesi, Saha Denetimi ve Nova kullanima acilacak.
                </div>
              ) : null}

              {memberships.map((membership) => {
                const isActiveWorkspace = payload.profile.activeWorkspaceId === membership.workspace.id;
                return (
                  <div
                    key={membership.id}
                    className="rounded-2xl border border-border bg-secondary/20 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{membership.workspace.name}</p>
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
                            {isActiveWorkspace ? "Aktif" : membership.isPrimary ? "Birincil" : "Hazir"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {membership.workspace.country_code} · {membership.workspace.default_language.toUpperCase()} · {formatRoleLabel(membership.roleKey)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isActiveWorkspace}
                        onClick={() => void handleActivateExisting(membership.workspace.id)}
                      >
                        {isActiveWorkspace ? "Aktif alan" : "Aktif yap"}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {Array.from({ length: pendingWorkspaceSlots }).map((_, index) => (
                <div
                  key={`pending-slot-${index}`}
                  className="rounded-2xl border border-dashed border-border bg-background/70 p-4"
                >
                  <p className="text-sm font-semibold text-foreground">
                    Olusturulmayi bekleyen calisma alani #{index + 1}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    Bu slot, sececegin ulke, dil ve rol ile dolacak. Firma yapisi ve RAG cevabi bu alanin baglamina gore calisacak.
                  </p>
                </div>
              ))}

              {workspaceLimitReached ? (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-900">
                  Secili paket icin aktif calisma alani limiti dolu. Yeni alan acmak yerine mevcut alanlardan birini aktiflestir veya paketini yukselt.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
          <CardHeader>
            <CardTitle>{selectedCountryWorkspace ? "Calisma alanini guncelle" : "Yeni calisma alani olustur"}</CardTitle>
            <CardDescription>
              Ulke, dil, rol ve varsa sertifikani sec. Nova ve RAG bu secimlerle filtrelenir; firma baglami bu alanin icinde ayrisir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="countryCode">
                    Ulke
                  </label>
                  <div className="relative">
                    <select
                      id="countryCode"
                      className={selectClassName}
                      value={countryCode}
                      onChange={(event) => setCountryCode(event.target.value)}
                    >
                      {(payload?.countries ?? []).map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.name} ({option.code})
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500 dark:text-slate-300">
                      ▾
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="defaultLanguage">
                    Dil
                  </label>
                  <div className="relative">
                    <select
                      id="defaultLanguage"
                      className={selectClassName}
                      value={defaultLanguage}
                      onChange={(event) => setDefaultLanguage(event.target.value)}
                    >
                      {(payload.languageOptions ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500 dark:text-slate-300">
                      â–¾
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="roleKey">
                    Rol
                  </label>
                  <div className="relative">
                    <select
                      id="roleKey"
                      className={selectClassName}
                      value={roleKey}
                      onChange={(event) => setRoleKey(event.target.value)}
                    >
                      {(payload?.roleOptions ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500 dark:text-slate-300">
                      ▾
                    </span>
                  </div>
                </div>
              </div>

              <Input
                id="workspaceName"
                label="Calisma alani adi"
                value={workspaceName}
                onChange={(event) => {
                  setWorkspaceNameDirty(true);
                  setWorkspaceName(event.target.value);
                }}
                hint={
                  selectedCountry
                    ? `${selectedLanguageOption?.label ?? defaultLanguage.toUpperCase()} dili ve ${selectedCountry.timezone} saat dilimi ile acilacak.`
                    : undefined
                }
              />

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="certificationId">
                  Sertifika
                </label>
                <div className="relative">
                  <select
                    id="certificationId"
                    className={selectClassName}
                    value={certificationId}
                    onChange={(event) => setCertificationId(event.target.value)}
                  >
                    <option value="">Sertifika secmeden devam et</option>
                    {availableCertifications.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.code} - {option.name}
                        {option.level ? ` (${option.level})` : ""} - {option.issuer}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500 dark:text-slate-300">
                    ▾
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sertifika opsiyonel. Secersen ekip rolunu ve jurisdiction bazli yetkinligi daha net etiketleriz.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                Bu alan acildiginda Nova resmi mevzuati secilen ulke ve dile gore filtreler. Sonraki adimda firma evraklarini yukleyerek tenant-private RAG katmanini da bu alan icine baglarsin.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={() => router.replace("/profile")}>
                  Profili duzenle
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || workspaceName.trim().length < 3 || workspaceLimitReached}
                >
                  {submitting
                    ? "Calisma alani kuruluyor..."
                    : selectedCountryWorkspace
                      ? "Alan ayarlarini kaydet"
                      : "Calisma alanini hazirla"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Kisisel bilgiler</CardTitle>
              <CardDescription>
                Buradaki profil bilgileri tum modullerde kullanilir. Calisma alani ise sadece firma ve mevzuat baglamini ayirir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ad soyad</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{payload.profile.fullName || "Henuz eklenmedi"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">E-posta</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{payload.profile.email || "Henuz eklenmedi"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Unvan</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{payload.profile.title || "Profilde tamamlanacak"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Telefon</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{payload.profile.phone || "Profilde tamamlanacak"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Hesap</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{payload.organization.name}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Paket</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{formatPlanLabel(accountContext?.currentPlanCode)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/80 p-4 text-sm text-muted-foreground">
                Profil bilgileri tum sitede ortak kalir. Firma, ulke, dil ve RAG davranisi ise secilen calisma alani bazinda ayrisir.
              </div>

              <Button type="button" variant="outline" onClick={() => router.replace("/profile")}>
                Profil sayfasini ac
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calisma alani olmadan kilitli kalacak alanlar</CardTitle>
              <CardDescription>
                Kullanici once profilini dogrular, sonra alanini acar. Alan acilana kadar asagidaki moduller pasif kalir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(payload?.memberships ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Henuz bir calisma alani yok. Ilk jurisdiction alanini burada kuracagiz.
                </p>
              ) : (
                payload?.memberships.map((membership) => (
                  <div
                    key={membership.id}
                    className="rounded-2xl border border-border bg-secondary/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {membership.workspace.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {membership.workspace.country_code} · {membership.roleKey}
                          {membership.isPrimary ? " · primary" : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleActivateExisting(membership.workspace.id)}
                      >
                        Aktif yap
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workspace olmadan kilitlenecek alanlar</CardTitle>
              <CardDescription>
                Kullanici once profilini dogrular, sonra alanini acar. Alan acilana kadar asagidaki moduller pasif kalir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {["Firmalar", "Risk Analizi", "DOF", "Aksiyon", "ISG Kutuphanesi", "Saha Denetimi", "Ajanda", "Nova", "Raporlar"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                {hasAnyWorkspace
                  ? "En az bir calisma alani hazir. Devam etmek icin mevcut alanlardan birini aktif tutman yeterli."
                  : "Su an tesvik noktasindasin: once ilk calisma alanini ac, sonra platformun cekirdek modullerini birlikte kullanmaya basla."}
              </div>

              <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                Secilen ulke resmi mevzuat filtresini, secilen dil ise Nova ve RAG cevaplarinin dilini ve terminolojisini belirler.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
