"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusAlert } from "@/components/ui/status-alert";
import { Textarea } from "@/components/ui/textarea";
import { hasAccountTypeAccess } from "@/lib/account/account-type-access";
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

type WorkspaceCompanyProfile = {
  companyWorkspaceId: string | null;
  name: string;
  shortName: string;
  kind: string;
  companyType: string;
  address: string;
  city: string;
  district: string;
  sector: string;
  naceCode: string;
  hazardClass: string;
  taxNumber: string;
  taxOffice: string;
  sgkWorkplaceNumber: string;
  fax: string;
  employerTitle: string;
  employeeCount: number;
  shiftModel: string;
  phone: string;
  email: string;
  contactPerson: string;
  employerName: string;
  employerRepresentative: string;
  notes: string;
  locations: string[];
  departments: string[];
};

type ExistingMembership = {
  id: string;
  roleKey: string;
  certificationId: string | null;
  isPrimary: boolean;
  companyWorkspaceId?: string | null;
  companyProfile?: WorkspaceCompanyProfile | null;
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
  allowedAccountTypes: Array<"individual" | "osgb" | "enterprise">;
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
  companyWarning?: string | null;
  membershipId?: string | null;
  companyWorkspaceId?: string | null;
  companyProfile?: WorkspaceCompanyProfile | null;
  workspace?: {
    id: string;
    name: string;
    countryCode: string;
    defaultLanguage: string;
    timezone: string;
  };
};

const DEMO_TEMPLATE_ID = "__demo-template__";

function createDemoWorkspaceProfile(): {
  workspaceName: string;
  countryCode: string;
  defaultLanguage: string;
  roleKey: string;
  companyProfile: WorkspaceCompanyProfile;
} {
  const workspaceName = "Demo - RiskNova Operasyonu";
  return {
    workspaceName,
    countryCode: "TR",
    defaultLanguage: "tr",
    roleKey: "safety_professional",
    companyProfile: {
      companyWorkspaceId: null,
      name: "RiskNova Demo Operasyon Merkezi",
      shortName: "RiskNova Demo",
      kind: "Ozel Sektor",
      companyType: "bagimsiz",
      address: "Kozyatagi Mah. Teknoloji Cad. No:12",
      city: "Istanbul",
      district: "Kadikoy",
      sector: "Yazilim ve Danismanlik",
      naceCode: "62.01.01",
      hazardClass: "Az Tehlikeli",
      taxNumber: "1112223334",
      taxOffice: "Kozyatagi",
      sgkWorkplaceNumber: "3400012345678901",
      fax: "",
      employerTitle: "Genel Mudurluk",
      employeeCount: 18,
      shiftModel: "Gunduz vardiyasi",
      phone: "+90 216 555 01 01",
      email: "demo@getrisknova.com",
      contactPerson: "Demo Kullanici",
      employerName: "RiskNova Teknoloji A.S.",
      employerRepresentative: "Operasyon Direktoru",
      notes:
        "Bu hazir taslak demo amaclidir. Kaydettiginde kendi calisma alani baglamina gore duzenleyebilirsin.",
      locations: ["Merkez Ofis", "Toplanti Alani", "Arsiv Odasi"],
      departments: ["Yonetim", "Operasyon", "Yazilim", "Destek"],
    },
  };
}

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

function createEmptyCompanyProfile(workspaceName = ""): WorkspaceCompanyProfile {
  return {
    companyWorkspaceId: null,
    name: workspaceName,
    shortName: workspaceName,
    kind: "Ozel Sektor",
    companyType: "bagimsiz",
    address: "",
    city: "",
    district: "",
    sector: "",
    naceCode: "",
    hazardClass: "",
    taxNumber: "",
    taxOffice: "",
    sgkWorkplaceNumber: "",
    fax: "",
    employerTitle: "",
    employeeCount: 0,
    shiftModel: "",
    phone: "",
    email: "",
    contactPerson: "",
    employerName: "",
    employerRepresentative: "",
    notes: "",
    locations: [],
    departments: [],
  };
}

function normalizeStringListText(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function listToTextarea(value: string[]) {
  return value.join("\n");
}

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

function goToWorkspaceLabel(
  membership: ExistingMembership | null,
  activeWorkspaceId: string | null,
) {
  if (!membership) return "Calisma alanina git";
  return membership.workspace.id === activeWorkspaceId
    ? "Calisma alanina git"
    : "Bu alani aktif yap ve git";
}

export function WorkspaceOnboardingClient({
  nextPath,
  initialMessage,
}: {
  nextPath?: string;
  initialMessage?: string;
}) {
  const router = useRouter();
  const demoTemplate = useMemo(() => createDemoWorkspaceProfile(), []);
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
  const [companyNameDirty, setCompanyNameDirty] = useState(false);
  const [companyShortNameDirty, setCompanyShortNameDirty] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<WorkspaceCompanyProfile>(
    createEmptyCompanyProfile(),
  );
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
  const [message, setMessage] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(
    initialMessage ? { tone: "success", text: initialMessage } : null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setAccountLoading(true);
      setLoading(true);
      setMessage(initialMessage ? { tone: "success", text: initialMessage } : null);

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
          DEMO_TEMPLATE_ID;
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
  }, [initialMessage, router]);

  const memberships = payload?.memberships ?? [];
  const workspaceLimit = accountUsage?.maxActiveWorkspaces ?? null;
  const canCreateWorkspace = workspaceLimit === null || memberships.length < workspaceLimit;
  const isDemoTemplateSelected = selectedWorkspaceId === DEMO_TEMPLATE_ID;
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
  const allowedAccountTypes = accountContext?.allowedAccountTypes ?? ["individual"];

  function updateCompanyProfile(patch: Partial<WorkspaceCompanyProfile>) {
    setCompanyProfile((current) => ({ ...current, ...patch }));
  }

  useEffect(() => {
    if (!payload) return;

    if (selectedMembership) {
      setCountryCode(selectedMembership.workspace.country_code);
      setDefaultLanguage(selectedMembership.workspace.default_language);
      setRoleKey(selectedMembership.roleKey);
      setCertificationId(selectedMembership.certificationId ?? "");
      setWorkspaceName(selectedMembership.workspace.name);
      setWorkspaceNameDirty(false);
      setCompanyProfile(
        selectedMembership.companyProfile
          ? {
              ...selectedMembership.companyProfile,
              companyWorkspaceId:
                selectedMembership.companyWorkspaceId ??
                selectedMembership.companyProfile.companyWorkspaceId ??
                null,
            }
          : createEmptyCompanyProfile(selectedMembership.workspace.name),
      );
      setCompanyNameDirty(false);
      setCompanyShortNameDirty(false);
      return;
    }

    if (isDemoTemplateSelected) {
      setCountryCode(demoTemplate.countryCode);
      setDefaultLanguage(demoTemplate.defaultLanguage);
      setRoleKey(demoTemplate.roleKey);
      setCertificationId("");
      setWorkspaceName(demoTemplate.workspaceName);
      setWorkspaceNameDirty(false);
      setCompanyProfile({ ...demoTemplate.companyProfile });
      setCompanyNameDirty(false);
      setCompanyShortNameDirty(false);
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
    setCompanyProfile(
      createEmptyCompanyProfile(
        payload.countries.find((item) => item.code === nextCountryCode)?.suggestedWorkspaceName ?? "",
      ),
    );
    setCompanyNameDirty(false);
    setCompanyShortNameDirty(false);
  }, [demoTemplate, isDemoTemplateSelected, payload, selectedMembership]);

  useEffect(() => {
    if (!payload || !selectedCountry || selectedMembership || isDemoTemplateSelected) return;

    if (!workspaceNameDirty) {
      setWorkspaceName(selectedCountry.suggestedWorkspaceName);
    }
    setDefaultLanguage(selectedCountry.defaultLanguage);
  }, [isDemoTemplateSelected, payload, selectedCountry, selectedMembership, workspaceNameDirty]);

  const resolvedNextPath =
    nextPath && nextPath !== "/companies" && nextPath !== "/workspace/onboarding"
      ? nextPath
      : "/dashboard";

  useEffect(() => {
    setCertificationId((current) => {
      if (!current) return current;
      const stillAvailable = availableCertifications.some((item) => item.id === current);
      return stillAvailable ? current : "";
    });
  }, [availableCertifications]);

  useEffect(() => {
    if (!workspaceName.trim()) return;

    if (!companyNameDirty) {
      setCompanyProfile((current) => ({ ...current, name: workspaceName }));
    }

    if (!companyShortNameDirty) {
      setCompanyProfile((current) => ({ ...current, shortName: workspaceName }));
    }
  }, [companyNameDirty, companyShortNameDirty, workspaceName]);

  function updatePayloadAfterSave(
    savedWorkspace: NonNullable<WorkspaceOnboardingResponse["workspace"]>,
    membershipId?: string | null,
    savedCompanyProfile?: WorkspaceCompanyProfile | null,
    savedCompanyWorkspaceId?: string | null,
  ) {
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
        companyWorkspaceId: savedCompanyWorkspaceId ?? savedCompanyProfile?.companyWorkspaceId ?? null,
        companyProfile: savedCompanyProfile ?? null,
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
    if (savedCompanyProfile) {
      setCompanyProfile(savedCompanyProfile);
      setCompanyNameDirty(false);
      setCompanyShortNameDirty(false);
    }
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

        updatePayloadAfterSave(
          localWorkspace,
          `local-membership-${localWorkspace.id}`,
          companyProfile,
          companyProfile.companyWorkspaceId,
        );
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
          companyWorkspaceId:
            companyProfile.companyWorkspaceId ?? selectedMembership?.companyWorkspaceId ?? null,
          companyProfile: {
            ...companyProfile,
            locations: Array.from(new Set(companyProfile.locations.map((item) => item.trim()).filter(Boolean))),
            departments: Array.from(new Set(companyProfile.departments.map((item) => item.trim()).filter(Boolean))),
          },
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

      updatePayloadAfterSave(
        json.workspace,
        json.membershipId,
        json.companyProfile ?? companyProfile,
        json.companyWorkspaceId ?? companyProfile.companyWorkspaceId,
      );
      setMessage({
        tone:
          json.mode === "local_fallback" || json.companyWarning
            ? "info"
            : "success",
        text:
          json.mode === "local_fallback"
            ? json.warning || `${json.workspace.name} yerel baglam olarak guncellendi.`
            : json.companyWarning
              ? json.companyWarning
            : `${json.workspace.name} kaydedildi ve aktif calisma alani olarak secildi.`,
      });

      router.refresh();

      router.replace(resolvedNextPath);
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
    router.replace(resolvedNextPath);
  }

  async function handleGoToWorkspace() {
    if (!payload) return;

    if (selectedMembership) {
      if (selectedMembership.workspace.id === payload.profile.activeWorkspaceId) {
        router.replace("/dashboard");
        return;
      }

      await handleActivateExisting(selectedMembership.workspace.id);
      return;
    }

    router.replace("/dashboard");
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
    const accountOptions = [
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
    ];

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
              Bireysel hesaplar tekil calisma alani baglamiyla, OSGB hesaplari ise coklu firma yonetimiyle ilerler.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => void handleAccountSubmit(event)}>
              <div className="rounded-2xl border border-border/70 bg-secondary/35 px-4 py-3 text-sm text-muted-foreground">
                Bu ekranda bireysel akis her zaman acik. OSGB ve kurumsal secenekleri yalnizca admin
                tarafindan yetki verildiginde aktif olur.
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {accountOptions.map((option) => {
                  const isAllowed = hasAccountTypeAccess(allowedAccountTypes, option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!isAllowed}
                      aria-disabled={!isAllowed}
                      className={`${optionClass} ${
                        accountType === option.value ? "ring-2 ring-primary" : ""
                      } ${
                        !isAllowed
                          ? "cursor-not-allowed border-dashed border-border/80 bg-muted/35 text-muted-foreground opacity-70 hover:translate-y-0 hover:border-border/80 hover:shadow-none"
                          : ""
                      }`}
                      onClick={() => {
                        if (!isAllowed) return;
                        setAccountType(option.value);
                      }}
                    >
                    <div className="text-base font-semibold text-foreground">{option.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
                    {!isAllowed ? (
                      <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                        Admin onayi gereklidir.
                      </p>
                    ) : null}
                  </button>
                  );
                })}
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
    <div className="space-y-6 rounded-[2rem] border border-border bg-card/90 p-5 shadow-[var(--shadow-elevated)] backdrop-blur sm:p-6 xl:p-8">
      <PageHeader
        eyebrow="Calisma Alanlari"
        title="Hangi calisma alaninda ilerleyeceksin?"
        description="Ilk adimda sadece calisma alanini sec veya yeni alan olustur. Sol panelden secim yap, sag tarafta o alana ait kaydi tamamla; bu alani aktiflestirdiginde risk analizi, dokumanlar, kutuphane ve saha modulleri aktif alan baglaminda calisir."
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
          selectedMembership ? (
            <Button
              type="button"
              onClick={() => void handleGoToWorkspace()}
              className="h-14 min-w-[240px] rounded-2xl px-6 text-base font-bold shadow-[0_16px_34px_rgba(217,162,27,0.28)]"
            >
              {goToWorkspaceLabel(selectedMembership, payload.profile.activeWorkspaceId)}
            </Button>
          ) : null
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
              Her alan ayri bir operasyon baglami tasir. Buradan secip duzenleyebilir veya aktif alani degistirebilirsin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberships.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
                Henuz hazir bir calisma alani yok. Ilk alani soldaki yeni slotu secip olusturdugunda cekirdek moduller acilacak.
              </div>
            ) : null}

            {memberships.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedWorkspaceId(DEMO_TEMPLATE_ID);
                  setMessage(null);
                }}
                className={`w-full rounded-3xl border p-4 text-left transition-all ${
                  isDemoTemplateSelected
                    ? "border-primary/45 bg-primary/8 shadow-[0_14px_34px_rgba(15,23,42,0.10)]"
                    : "border-border bg-card hover:border-primary/30 hover:bg-secondary/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {demoTemplate.workspaceName}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Hazir demo taslak · TR · safety_professional
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-foreground">
                    Demo
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Verileri dolu bir ornekle hizli baslamak icin bunu secebilirsin.
                  </span>
                  <span className="text-xs font-semibold text-primary">Hazir</span>
                </div>
              </button>
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
                    Tamamen bos bir kayitla baslamak istersen bunu sec. Firma ve calisma alani bilgilerini sag tarafta kendin doldurursun.
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
                {selectedMembership
                  ? "Secili calisma alani ayrintilari"
                  : isDemoTemplateSelected
                    ? "Demo calisma alani taslagi"
                    : "Yeni calisma alani olustur"}
                </CardTitle>
                <CardDescription>
                Soldan bir alan sec. Sag tarafta o alana bagli firma / calisma alani kaydini doldur; ulke ve dil Nova baglamini, firma bilgileri ise tum operasyon modullerini besler.
                </CardDescription>
              </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
                <Input
                  id="workspaceName"
                  label="Calisma alani etiketi"
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
                  Her calisma alani kendi operasyon baglamiyla calisir; bu alani aktiflestirdiginde modullerde tekrar ayri bir alan secmek yerine aktif alanin baglami kullanilir.
                </div>

                <div className="rounded-3xl border border-border bg-background/80 p-5">
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Firma / calisma alani kaydi
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Eski firmalar ekraninda doldurulan ana bilgiler burada yasasin. Sol panelden alan sectiginde sag tarafta bu calisma alanina ait kaydi duzenlersin.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Firma / calisma alani resmi adi"
                      value={companyProfile.name}
                      onChange={(event) => {
                        setCompanyNameDirty(true);
                        updateCompanyProfile({ name: event.target.value });
                      }}
                    />
                    <Input
                      label="Kisa ad / gorunen ad"
                      value={companyProfile.shortName}
                      onChange={(event) => {
                        setCompanyShortNameDirty(true);
                        updateCompanyProfile({ shortName: event.target.value });
                      }}
                    />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="companyKind">
                        Calisma alani tipi
                      </label>
                      <div className="relative">
                        <select
                          id="companyKind"
                          className={selectClassName}
                          value={companyProfile.kind}
                          onChange={(event) => updateCompanyProfile({ kind: event.target.value })}
                        >
                          <option value="Ozel Sektor">Ozel Sektor</option>
                          <option value="Kamu Kurumu">Kamu Kurumu</option>
                          <option value="Belediye">Belediye</option>
                          <option value="STK / Vakif">STK / Vakif</option>
                          <option value="Santiye">Santiye</option>
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500 dark:text-slate-300">
                          ▾
                        </span>
                      </div>
                    </div>
                    <Input
                      label="Sektor"
                      value={companyProfile.sector}
                      onChange={(event) => updateCompanyProfile({ sector: event.target.value })}
                    />
                    <Input
                      label="NACE kodu"
                      value={companyProfile.naceCode}
                      onChange={(event) => updateCompanyProfile({ naceCode: event.target.value })}
                    />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="hazardClass">
                        Tehlike sinifi
                      </label>
                      <div className="relative">
                        <select
                          id="hazardClass"
                          className={selectClassName}
                          value={companyProfile.hazardClass}
                          onChange={(event) => updateCompanyProfile({ hazardClass: event.target.value })}
                        >
                          <option value="">Seciniz</option>
                          <option value="Az Tehlikeli">Az Tehlikeli</option>
                          <option value="Tehlikeli">Tehlikeli</option>
                          <option value="Cok Tehlikeli">Cok Tehlikeli</option>
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500 dark:text-slate-300">
                          ▾
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Input
                      label="Adres"
                      value={companyProfile.address}
                      onChange={(event) => updateCompanyProfile({ address: event.target.value })}
                    />
                    <Input
                      label="Il"
                      value={companyProfile.city}
                      onChange={(event) => updateCompanyProfile({ city: event.target.value })}
                    />
                    <Input
                      label="Ilce"
                      value={companyProfile.district}
                      onChange={(event) => updateCompanyProfile({ district: event.target.value })}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Input
                      label="Telefon"
                      value={companyProfile.phone}
                      onChange={(event) => updateCompanyProfile({ phone: event.target.value })}
                    />
                    <Input
                      label="E-posta"
                      value={companyProfile.email}
                      onChange={(event) => updateCompanyProfile({ email: event.target.value })}
                    />
                    <Input
                      label="Yetkili kisi"
                      value={companyProfile.contactPerson}
                      onChange={(event) => updateCompanyProfile({ contactPerson: event.target.value })}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Input
                      label="SGK isyeri sicil no"
                      value={companyProfile.sgkWorkplaceNumber}
                      onChange={(event) =>
                        updateCompanyProfile({ sgkWorkplaceNumber: event.target.value })
                      }
                    />
                    <Input
                      label="Vergi no"
                      value={companyProfile.taxNumber}
                      onChange={(event) => updateCompanyProfile({ taxNumber: event.target.value })}
                    />
                    <Input
                      label="Vergi dairesi"
                      value={companyProfile.taxOffice}
                      onChange={(event) => updateCompanyProfile({ taxOffice: event.target.value })}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <Input
                      label="Calisan sayisi"
                      type="number"
                      value={String(companyProfile.employeeCount)}
                      onChange={(event) =>
                        updateCompanyProfile({
                          employeeCount: Number(event.target.value || 0),
                        })
                      }
                    />
                    <Input
                      label="Vardiya modeli"
                      value={companyProfile.shiftModel}
                      onChange={(event) => updateCompanyProfile({ shiftModel: event.target.value })}
                    />
                    <Input
                      label="Isveren unvani"
                      value={companyProfile.employerTitle}
                      onChange={(event) => updateCompanyProfile({ employerTitle: event.target.value })}
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Input
                      label="Isveren"
                      value={companyProfile.employerName}
                      onChange={(event) => updateCompanyProfile({ employerName: event.target.value })}
                    />
                    <Input
                      label="Isveren vekili"
                      value={companyProfile.employerRepresentative}
                      onChange={(event) =>
                        updateCompanyProfile({ employerRepresentative: event.target.value })
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="locations">
                        Lokasyonlar
                      </label>
                      <Textarea
                        id="locations"
                        rows={6}
                        value={listToTextarea(companyProfile.locations)}
                        onChange={(event) =>
                          updateCompanyProfile({
                            locations: normalizeStringListText(event.target.value),
                          })
                        }
                        placeholder="Her satira bir lokasyon yaz."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="departments">
                        Bolumler
                      </label>
                      <Textarea
                        id="departments"
                        rows={6}
                        value={listToTextarea(companyProfile.departments)}
                        onChange={(event) =>
                          updateCompanyProfile({
                            departments: normalizeStringListText(event.target.value),
                          })
                        }
                        placeholder="Her satira bir bolum yaz."
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="companyNotes">
                      Notlar
                    </label>
                    <Textarea
                      id="companyNotes"
                      rows={4}
                      value={companyProfile.notes}
                      onChange={(event) => updateCompanyProfile({ notes: event.target.value })}
                      placeholder="Bu calisma alaniyla ilgili operasyon ve saha notlarini yaz."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => router.replace("/profile")}>
                      Profili ac
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      workspaceName.trim().length < 3 ||
                      companyProfile.name.trim().length < 2 ||
                      (!selectedMembership && !canCreateWorkspace)
                    }
                  >
                    {submitting
                      ? "Kaydediliyor..."
                      : selectedMembership
                        ? "Alan ayarlarini kaydet"
                        : isDemoTemplateSelected
                          ? "Demo alanini kaydet ve panele gec"
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
                Bu bilgiler tum sitede ortak kullanilir. Calisma alanlari ise sadece operasyon, ulke ve dil baglamini ayirir.
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
                Profil bilgileri tum deneyimde ortak kalir. Calisma alani degistiginde sadece operasyon baglami, mevzuat filtresi ve dil tercihi degisir.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
