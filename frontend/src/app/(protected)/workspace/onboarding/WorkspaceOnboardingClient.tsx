"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
    organization_id: string;
    country_code: string;
    name: string;
    default_language: string;
    timezone: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
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
  membershipId?: string | null;
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
    return "Hesap kurulumu icin gereken yeni veritabani alanlari henuz hazir degil. Lutfen migration tamamlandiginda tekrar deneyin.";
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

function workspaceStateLabel(
  membership: ExistingMembership,
  activeWorkspaceId: string | null,
  selectedWorkspaceId: string | null,
) {
  if (membership.workspace.id === selectedWorkspaceId) return "Secili";
  if (membership.workspace.id === activeWorkspaceId) return "Aktif";
  if (membership.isPrimary) return "Varsayilan";
  return "Hazir";
}

export function WorkspaceOnboardingClient({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [accountLoading, setAccountLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountContext, setAccountContext] = useState<AccountContextPayload | null>(null);
  const [accountUsage, setAccountUsage] = useState<AccountUsage | null>(null);
  const [payload, setPayload] = useState<OnboardingPayload | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
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

    async function loadData() {
      setAccountLoading(true);
      setLoading(true);
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
          setAccountLoading(false);
          setLoading(false);
          return;
        }

        const response = await fetch("/api/workspaces/onboarding", {
          method: "GET",
          credentials: "include",
        });

        const json = await readJsonSafely<OnboardingPayload | { error?: string }>(response);
        if (!response.ok || !json || ("error" in json && json.error)) {
          throw new Error(
            json && "error" in json ? json.error || "Calisma alani verisi alinamadi." : "Calisma alani verisi alinamadi.",
          );
        }

        if (cancelled) return;
        const nextPayload = json as OnboardingPayload;
        setPayload(nextPayload);

        const firstWorkspaceId =
          nextPayload.profile.activeWorkspaceId ??
          nextPayload.memberships[0]?.workspace.id ??
          null;
        setSelectedWorkspaceId(firstWorkspaceId);
      } catch (error) {
        if (!cancelled) {
          setMessage({
            tone: "danger",
            text: error instanceof Error ? error.message : "Calisma alani verisi alinamadi.",
          });
        }
      } finally {
        if (!cancelled) {
          setAccountLoading(false);
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const memberships = payload?.memberships ?? [];
  const workspaceLimit = accountUsage?.maxActiveWorkspaces ?? null;
  const canCreateWorkspace = workspaceLimit === null || memberships.length < workspaceLimit;
  const selectedMembership =
    memberships.find((membership) => membership.workspace.id === selectedWorkspaceId) ?? null;
  const selectedCountry =
    payload?.countries.find((country) => country.code === countryCode) ?? null;
  const availableCertifications = useMemo(
    () =>
      (payload?.certifications ?? []).filter(
        (item) => item.countryCode === countryCode && item.roleKey === roleKey,
      ),
    [countryCode, payload, roleKey],
  );
  const selectedLanguageOption =
    payload?.languageOptions.find((item) => item.value === defaultLanguage) ?? null;
  const missingWorkspaceTables = useMemo(
    () =>
      (payload?.warnings ?? []).some((item) =>
        item.toLowerCase().includes("workspace tablolari"),
      ),
    [payload],
  );
  const pendingWorkspaceSlots =
    workspaceLimit === null ? 0 : Math.max(workspaceLimit - memberships.length, 0);
  const needsAccountTypeSelection = !accountLoading && !accountContext?.accountType;

  useEffect(() => {
    if (!payload) return;

    if (selectedMembership) {
      setCountryCode(selectedMembership.workspace.country_code);
      setDefaultLanguage(selectedMembership.workspace.default_language);
      setRoleKey(selectedMembership.roleKey);
      setCertificationId(selectedMembership.certificationId ?? "");
      setWorkspaceName(selectedMembership.workspace.name);
      setWorkspaceNameDirty(false);
      return;
    }

    const nextCountryCode =
      payload.countries.find((item) => item.code === payload.recommendedCountryCode)?.code ??
      payload.countries[0]?.code ??
      "TR";
    const nextRoleKey =
      payload.roleOptions.find((item) => item.value === "safety_professional")?.value ??
      payload.roleOptions[0]?.value ??
      "viewer";
    const nextLanguage =
      payload.countries.find((item) => item.code === nextCountryCode)?.defaultLanguage ??
      payload.languageOptions[0]?.value ??
      "tr";

    setCountryCode(nextCountryCode);
    setDefaultLanguage(nextLanguage);
    setRoleKey(nextRoleKey);
    setCertificationId("");
    setWorkspaceName(
      payload.countries.find((item) => item.code === nextCountryCode)?.suggestedWorkspaceName ??
        "",
    );
    setWorkspaceNameDirty(false);
  }, [payload, selectedMembership]);

  useEffect(() => {
    if (!payload || !selectedCountry || selectedMembership) return;

    if (!workspaceNameDirty) {
      setWorkspaceName(selectedCountry.suggestedWorkspaceName);
    }
    setDefaultLanguage(selectedCountry.defaultLanguage);
  }, [payload, selectedCountry, selectedMembership, workspaceNameDirty]);

  useEffect(() => {
    setCertificationId((current) => {
      if (!current) return current;
      const stillAvailable = availableCertifications.some((item) => item.id === current);
      return stillAvailable ? current : "";
    });
  }, [availableCertifications]);

  function updatePayloadAfterSave(savedWorkspace: NonNullable<WorkspaceOnboardingResponse["workspace"]>, membershipId?: string | null) {
    setPayload((current) => {
      if (!current) return current;

      const now = new Date().toISOString();
      const existing = current.memberships.find(
        (membership) =>
          membership.workspace.id === savedWorkspace.id || (membershipId ? membership.id === membershipId : false),
      );

      const nextMembership: ExistingMembership = {
        id: membershipId ?? existing?.id ?? `local-membership-${savedWorkspace.id}`,
        roleKey,
        certificationId: certificationId || null,
        isPrimary: true,
        workspace: {
          id: savedWorkspace.id,
          organization_id: current.organization.id,
          country_code: savedWorkspace.countryCode,
          name: savedWorkspace.name,
          default_language: savedWorkspace.defaultLanguage,
          timezone: savedWorkspace.timezone,
          is_active: true,
          created_at: existing?.workspace.created_at ?? now,
          updated_at: now,
        },
      };

      const otherMemberships = current.memberships
        .filter((membership) => membership.workspace.id !== savedWorkspace.id)
        .map((membership) => ({ ...membership, isPrimary: false }));

      return {
        ...current,
        profile: {
          ...current.profile,
          activeWorkspaceId: savedWorkspace.id,
        },
        memberships: [nextMembership, ...otherMemberships],
      };
    });

    setSelectedWorkspaceId(savedWorkspace.id);
    setWorkspaceName(savedWorkspace.name);
    setWorkspaceNameDirty(false);
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
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
        throw new Error(json?.error || "Hesap tipi secimi su anda tamamlanamiyor.");
      }

      router.refresh();
      router.replace(json.redirectPath);
    } catch (error) {
      setMessage({
        tone: "danger",
        text: normalizeOnboardingError(error, "Hesap tipi secimi tamamlanamadi."),
      });
    } finally {
      setAccountSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload) return;

    if (!selectedMembership && !canCreateWorkspace) {
      setMessage({
        tone: "info",
        text: "Paketindeki calisma alani limitine ulastin. Yeni alan acmadan once mevcut alanlardan birini kullan veya paketini yukselt.",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      if (missingWorkspaceTables) {
        const localWorkspace = {
          id: selectedMembership?.workspace.id ?? `local-${countryCode}`,
          name:
            workspaceName || selectedCountry?.suggestedWorkspaceName || "Yerel Calisma Alani",
          countryCode,
          defaultLanguage,
          timezone: selectedCountry?.timezone || "Europe/Istanbul",
        };

        setLocalWorkspaceContext({
          id: localWorkspace.id,
          organizationId: payload.organization.id,
          countryCode: localWorkspace.countryCode,
          name: localWorkspace.name,
          defaultLanguage: localWorkspace.defaultLanguage,
          timezone: localWorkspace.timezone,
          roleKey,
          certificationId: certificationId || null,
          isPrimary: true,
        });

        updatePayloadAfterSave(localWorkspace, `local-membership-${localWorkspace.id}`);
        setMessage({
          tone: "info",
          text: "Workspace tablolari bu ortamda henuz tam degil. Secim yerel baglam olarak kaydedildi ve bu alani kullanabilirsin.",
        });
        router.refresh();
        return;
      }

      const response = await fetch("/api/workspaces/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: selectedMembership?.workspace.id ?? null,
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
        throw new Error(json?.error || "Calisma alani kaydi su anda tamamlanamiyor.");
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

      updatePayloadAfterSave(json.workspace, json.membershipId);
      setMessage({
        tone: json.mode === "local_fallback" ? "info" : "success",
        text:
          json.mode === "local_fallback"
            ? json.warning || `${json.workspace.name} yerel baglam olarak guncellendi.`
            : `${json.workspace.name} kaydedildi ve aktif calisma alani olarak secildi.`,
      });

      router.refresh();

      if (nextPath && nextPath !== "/companies" && nextPath !== "/workspace/onboarding") {
        router.replace(nextPath);
      }
    } catch (error) {
      setMessage({
        tone: "danger",
        text: normalizeOnboardingError(error, "Calisma alani kaydi tamamlanamadi."),
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
        text: "Secilen calisma alani aktif yapilamadi.",
      });
      return;
    }

    setPayload((current) =>
      current
        ? {
            ...current,
            profile: {
              ...current.profile,
              activeWorkspaceId: workspaceId,
            },
          }
        : current,
    );
    setSelectedWorkspaceId(workspaceId);
    router.refresh();

    if (nextPath && nextPath !== "/companies" && nextPath !== "/workspace/onboarding") {
      router.replace(nextPath);
    }
  }

  if (accountLoading || loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Calisma Alani"
          title="Calisma alanlari hazirlaniyor"
          description="RiskNova hesap ve calisma alani baglamini senin icin yükluyor."
        />
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
              <p className="text-sm text-muted-foreground">Veri yukleniyor...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsAccountTypeSelection) {
    const optionClass =
      "rounded-3xl border border-border bg-card p-5 text-left shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--shadow-elevated)]";

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Hesap Tipi"
          title="RiskNova hesabini sec"
          description="Bireysel, OSGB veya kurumsal akisini sec. Sonraki ekranlar buna gore sekillenir."
        />

        {message ? <StatusAlert tone={message.tone}>{message.text}</StatusAlert> : null}

        <Card>
          <CardHeader>
            <CardTitle>Hangi yapiyla baslayacaksin?</CardTitle>
            <CardDescription>
              Bireysel hesap tekil isyeri baglamlariyla, OSGB hesaplari ise coklu firma yonetimiyle ilerler.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => void handleAccountSubmit(event)}>
              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  {
                    value: "individual" as const,
                    title: "Bireysel",
                    description: "Tekil profesyonel veya uzman kullanimi icin.",
                  },
                  {
                    value: "osgb" as const,
                    title: "OSGB",
                    description: "Coklu firma ve ekip yonetimi icin.",
                  },
                  {
                    value: "enterprise" as const,
                    title: "Kurumsal",
                    description: "Kurumsal ihtiyaclar icin iletisim talebi olusturur.",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${optionClass} ${accountType === option.value ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setAccountType(option.value)}
                  >
                    <div className="text-base font-semibold text-foreground">{option.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>

              <Input
                label="Hesap gorunen adi"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                placeholder="Ornek: Mehmet Yildirim"
              />

              {accountType === "enterprise" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Sirket adi"
                    value={enterpriseForm.companyName}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({ ...current, companyName: event.target.value }))
                    }
                  />
                  <Input
                    label="Iletisim kisisi"
                    value={enterpriseForm.contactName}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({ ...current, contactName: event.target.value }))
                    }
                  />
                  <Input
                    label="E-posta"
                    type="email"
                    value={enterpriseForm.email}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                  <Input
                    label="Telefon"
                    value={enterpriseForm.phone}
                    onChange={(event) =>
                      setEnterpriseForm((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={accountSubmitting}>
                  {accountSubmitting ? "Kaydediliyor..." : "Devam et"}
                </Button>
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
          eyebrow="Calisma Alanlari"
          title="Calisma alani verisi okunamadi"
          description="Profil veya workspace baglami eksik oldugu icin bu ekran hazirlanamadi."
        />
        {message ? <StatusAlert tone={message.tone}>{message.text}</StatusAlert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calisma Alanlari"
        title="Hangi calisma alaninda ilerleyeceksin?"
        description="Her calisma alani tek bir isyeri/firma baglamidir. Soldan alan sec, sag tarafta isyeri baglamini duzenle ve gerekiyorsa aktif alan tercihini degistir."
        meta={
          <>
            <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs font-semibold text-foreground">
              Paket: {formatPlanLabel(accountContext?.currentPlanCode)}
            </span>
            <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs font-semibold text-foreground">
              {workspaceLimit === null
                ? `${memberships.length} alan hazir`
                : `${memberships.length} / ${workspaceLimit} alan kullaniliyor`}
            </span>
            <span className="rounded-full border border-border bg-secondary/45 px-3 py-1 text-xs font-semibold text-foreground">
              {payload.profile.activeWorkspaceId ? "Aktif alan secili" : "Alan secimi bekleniyor"}
            </span>
          </>
        }
        actions={
          <Button type="button" variant="outline" onClick={() => router.replace("/profile")}>
            Profili ac
          </Button>
        }
      />

      {message ? <StatusAlert tone={message.tone}>{message.text}</StatusAlert> : null}
      {payload.warnings?.map((warning) => (
        <StatusAlert key={warning} tone="info">
          {warning}
        </StatusAlert>
      ))}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Calisma alanlari</CardTitle>
            <CardDescription>
              Her alan ayri bir isyeri baglami tasir. Buradan secip duzenleyebilir veya aktif alani degistirebilirsin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberships.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
                Henuz hazir bir calisma alani yok. Ilk alani soldaki yeni slotu secip olusturdugunda cekirdek moduller acilacak.
              </div>
            ) : null}

            {memberships.map((membership) => {
              const isSelected = membership.workspace.id === selectedWorkspaceId;
              const isActive = membership.workspace.id === payload.profile.activeWorkspaceId;
              const stateLabel = workspaceStateLabel(
                membership,
                payload.profile.activeWorkspaceId,
                selectedWorkspaceId,
              );

              return (
                <button
                  key={membership.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(membership.workspace.id)}
                  className={`w-full rounded-3xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-primary/45 bg-primary/8 shadow-[0_14px_34px_rgba(15,23,42,0.10)]"
                      : "border-border bg-card hover:border-primary/30 hover:bg-secondary/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {membership.workspace.name}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {membership.workspace.country_code} · {membership.workspace.default_language.toUpperCase()} · {membership.roleKey}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
                      {stateLabel}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {isActive ? "Bu alan su anda sistem genelinde aktif." : "Isterse bu alana gecis yapabilirsin."}
                    </span>
                    {!isActive ? (
                      <span className="text-xs font-semibold text-primary">Goruntule</span>
                    ) : null}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                if (!canCreateWorkspace) return;
                setSelectedWorkspaceId(null);
                setMessage(null);
              }}
              disabled={!canCreateWorkspace}
              className={`w-full rounded-3xl border border-dashed p-4 text-left transition-all ${
                canCreateWorkspace
                  ? "border-primary/35 bg-primary/5 hover:border-primary/55 hover:bg-primary/8"
                  : "cursor-not-allowed border-border bg-secondary/20 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Yeni calisma alani</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Yeni bir isyeri baglami ac, ulke ve dili sec, sonra bu alan uzerinden calis.
                  </p>
                </div>
                <span className="rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">
                  {canCreateWorkspace ? "Yeni" : "Limit"}
                </span>
              </div>
            </button>

            {workspaceLimit !== null ? (
              <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-xs leading-6 text-muted-foreground">
                {pendingWorkspaceSlots > 0
                  ? `${pendingWorkspaceSlots} bos alan daha acabilirsin.`
                  : "Mevcut paketindeki aktif alan limitine ulastin."}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedMembership ? "Secili calisma alani ayrintilari" : "Yeni calisma alani olustur"}
              </CardTitle>
              <CardDescription>
                Isyeri adi, ulke, dil ve rol secimleri burada yonetilir. Nova ve RAG davranisi bu baglama gore calisir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
                <Input
                  id="workspaceName"
                  label="Calisma alani / isyeri adi"
                  value={workspaceName}
                  onChange={(event) => {
                    setWorkspaceNameDirty(true);
                    setWorkspaceName(event.target.value);
                  }}
                  hint={
                    selectedCountry
                      ? `${selectedLanguageOption?.label ?? defaultLanguage.toUpperCase()} dili ve ${selectedCountry.timezone} saat dilimi ile calisacak.`
                      : undefined
                  }
                />

                <div className="grid gap-4 md:grid-cols-3">
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
                        {(payload.countries ?? []).map((option) => (
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
                        ▾
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
                        {(payload.roleOptions ?? []).map((option) => (
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
                  <p className="text-xs leading-5 text-muted-foreground">
                    Ulke ve rol baglamina uygun sertifika secersen alanin uzmanlik etiketi daha net gorunur.
                  </p>
                </div>

                <div className="rounded-3xl border border-border bg-secondary/20 p-4 text-sm leading-6 text-muted-foreground">
                  Bu alandaki ulke secimi resmi mevzuat filtresini, dil secimi ise Nova ve RAG terminolojisini belirler.
                  Her calisma alani tek bir isyeri gibi calisir; modullerde firma secmek yerine aktif alanin baglami kullanilir.
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-3">
                    {selectedMembership && payload.profile.activeWorkspaceId !== selectedMembership.workspace.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleActivateExisting(selectedMembership.workspace.id)}
                      >
                        Bu alani aktif yap
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" onClick={() => router.replace("/profile")}>
                      Kisisel bilgileri ac
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      workspaceName.trim().length < 3 ||
                      (!selectedMembership && !canCreateWorkspace)
                    }
                  >
                    {submitting
                      ? "Kaydediliyor..."
                      : selectedMembership
                        ? "Alan ayarlarini kaydet"
                        : "Calisma alanini olustur"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kisisel bilgiler</CardTitle>
              <CardDescription>
                Bu bilgiler tum sitede ortak kullanilir. Calisma alanlari ise sadece isyeri, ulke ve dil baglamini ayirir.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[
                { label: "Ad soyad", value: payload.profile.fullName || "Henuz eklenmedi" },
                { label: "E-posta", value: payload.profile.email || "Henuz eklenmedi" },
                { label: "Unvan", value: payload.profile.title || "Profilde tamamlanacak" },
                { label: "Telefon", value: payload.profile.phone || "Profilde tamamlanacak" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}

              <div className="md:col-span-2 rounded-2xl border border-border bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
                Profil bilgileri tum deneyimde ortak kalir. Calisma alani degistiginde sadece isyeri baglami, mevzuat filtresi ve dil tercihi degisir.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
