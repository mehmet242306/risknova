"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardCheck,
  FileEdit,
  FileText,
  Search,
  ShieldAlert,
  Siren,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { PremiumIconBadge, type PremiumIconTone } from "@/components/ui/premium-icon-badge";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/hooks/use-is-admin";
import { usePermission } from "@/lib/hooks/use-permission";
import { usePersistedState } from "@/lib/use-persisted-state";
import { AdminAITab } from "./AdminAITab";
import { AdminDocumentsTab } from "./AdminDocumentsTab";
import { AdminNotificationsTab } from "./AdminNotificationsTab";
import { AdminOverviewTab } from "./AdminOverviewTab";
import { AIUsageTab } from "./AIUsageTab";
import { AuditLogsTab } from "./AuditLogsTab";
import { DatabaseHealthTab } from "./DatabaseHealthTab";
import { DeletedRecordsTab } from "./DeletedRecordsTab";
import { ErrorLogsTab } from "./ErrorLogsTab";
import { KvkkCenterTab } from "./KvkkCenterTab";
import { MevzuatSyncTab } from "./MevzuatSyncTab";
import { RoleManagementTab } from "./RoleManagementTab";
import { SecurityEventsTab } from "./SecurityEventsTab";
import { SelfHealingTab } from "./SelfHealingTab";
import { UserManagementTab } from "./UserManagementTab";

type TabKey =
  | "admin_dashboard"
  | "general"
  | "mevzuat"
  | "security_events"
  | "role_management"
  | "kvkk_center"
  | "self_healing"
  | "error_logs"
  | "users"
  | "ai_usage"
  | "database_health"
  | "admin_notifications"
  | "admin_documents"
  | "audit_logs"
  | "deleted_records"
  | "admin_ai";

type TabSectionKey = "baslangic" | "operasyon" | "guvenlik" | "izleme";

type TabDef = {
  key: TabKey;
  label: string;
  description: string;
  section: TabSectionKey;
  icon: LucideIcon;
  tone: PremiumIconTone;
  adminOnly?: boolean;
  permission?: string;
  quick?: boolean;
};

const sectionMeta: Record<TabSectionKey, { label: string; description: string }> = {
  baslangic: {
    label: "Hizli Baslangic",
    description: "Gunluk takip ve en sik kullanilan yonetim alanlari.",
  },
  operasyon: {
    label: "Operasyon ve Icerik",
    description: "Mevzuat, dokuman ve Nova AI gibi ureten alanlar.",
  },
  guvenlik: {
    label: "Guvenlik ve Uyum",
    description: "Yetki, denetim, KVKK ve kritik kayitlar.",
  },
  izleme: {
    label: "Izleme ve Sistem",
    description: "Hata, performans, veritabani ve dayaniklilik takibi.",
  },
};

const allTabs: TabDef[] = [
  {
    key: "admin_dashboard",
    label: "Admin Dashboard",
    description: "Tum sistemi tek bakista ozetleyin ve detaylara hizli gecin.",
    section: "baslangic",
    icon: BarChart3,
    tone: "gold",
    permission: "admin.dashboard.view",
    quick: true,
  },
  {
    key: "general",
    label: "Genel",
    description: "Temel sistem tercihleri, bildirimler ve genel platform davranisi.",
    section: "baslangic",
    icon: ClipboardCheck,
    tone: "emerald",
    quick: true,
  },
  {
    key: "users",
    label: "Kullanicilar",
    description: "Kullanici, rol ve erisim yonetimini buradan takip edin.",
    section: "baslangic",
    icon: Building2,
    tone: "cobalt",
    permission: "admin.users.manage",
    quick: true,
  },
  {
    key: "admin_notifications",
    label: "Bildirim Merkezi",
    description: "Kritik uyari, idari bildirim ve aksiyon gerektiren olaylar.",
    section: "baslangic",
    icon: Siren,
    tone: "amber",
    permission: "admin.notifications.view",
    quick: true,
  },
  {
    key: "mevzuat",
    label: "Mevzuat Senkronizasyonu",
    description: "Mevzuat akisi, kaynaklar ve guncel veri senkronu.",
    section: "operasyon",
    icon: FileText,
    tone: "teal",
  },
  {
    key: "admin_documents",
    label: "Belgeler",
    description: "Versionlu hukuki ve operasyonel dokuman merkezi.",
    section: "operasyon",
    icon: FileEdit,
    tone: "indigo",
    permission: "admin.documents.manage",
    quick: true,
  },
  {
    key: "admin_ai",
    label: "Nova AI",
    description: "Nova AI davranisi, prompt akislari ve admin denetimi.",
    section: "operasyon",
    icon: Sparkles,
    tone: "plum",
    adminOnly: true,
  },
  {
    key: "kvkk_center",
    label: "KVKK Merkezi",
    description: "Consent, silme, export, retention ve aktarim kayitlari.",
    section: "guvenlik",
    icon: ShieldAlert,
    tone: "violet",
    permission: "compliance.kvkk.manage",
    quick: true,
  },
  {
    key: "security_events",
    label: "Guvenlik Olaylari",
    description: "Basarisiz girisler, rate limitler ve supheli hareketler.",
    section: "guvenlik",
    icon: AlertTriangle,
    tone: "danger",
    permission: "security.events.view",
    quick: true,
  },
  {
    key: "role_management",
    label: "Rol Yonetimi",
    description: "RBAC yapisi, izinler ve erisim kapsamlarini yonetin.",
    section: "guvenlik",
    icon: ShieldAlert,
    tone: "orange",
    permission: "security.roles.manage",
  },
  {
    key: "audit_logs",
    label: "Audit Loglari",
    description: "Kim neyi ne zaman degistirdi takibi ve denetim izi.",
    section: "guvenlik",
    icon: FileText,
    tone: "neutral",
    adminOnly: true,
  },
  {
    key: "deleted_records",
    label: "Silinmis Kayitlar",
    description: "Soft delete edilen kayitlarin geri alma ve inceleme alani.",
    section: "guvenlik",
    icon: AlertTriangle,
    tone: "risk",
    adminOnly: true,
  },
  {
    key: "error_logs",
    label: "Hata Loglari",
    description: "Sistem hatalari, endpoint sorunlari ve cozum takibi.",
    section: "izleme",
    icon: AlertTriangle,
    tone: "risk",
    permission: "admin.error_logs.view",
    quick: true,
  },
  {
    key: "ai_usage",
    label: "AI Kullanim",
    description: "Model dagilimi, maliyet, cache ve kullanim trendleri.",
    section: "izleme",
    icon: TrendingUp,
    tone: "gold",
    permission: "admin.ai_usage.view",
    quick: true,
  },
  {
    key: "database_health",
    label: "Veritabani",
    description: "Tablo boyutu, baglanti durumu ve yavas sorgu gorunurlugu.",
    section: "izleme",
    icon: BarChart3,
    tone: "cobalt",
    permission: "admin.database_health.view",
    quick: true,
  },
  {
    key: "self_healing",
    label: "Self-Healing",
    description: "Health, queue, backup ve kendini toparlama akislari.",
    section: "izleme",
    icon: Sparkles,
    tone: "success",
    permission: "self_healing.view",
    quick: true,
  },
];

function GeneralTab() {
  const cards = [
    {
      title: "Kullanici Deneyimi",
      description: "Tema, dil, gorunum ve gundelik kullanim tercihleri.",
      icon: ClipboardCheck,
      tone: "emerald" as const,
      items: ["Tema ve gorunum", "Dil ve bolge", "Temel arayuz tercihleri"],
    },
    {
      title: "Bildirimler",
      description: "Kim, ne zaman, hangi kanal uzerinden uyarilacak takibi.",
      icon: Siren,
      tone: "amber" as const,
      items: ["Bildirim ayarlari", "Kritik olay dagitimi", "Hatirlatma davranislari"],
    },
    {
      title: "Entegrasyonlar",
      description: "Servis baglantilari ve temel platform davranis ayarlari.",
      icon: FileEdit,
      tone: "cobalt" as const,
      items: ["API ve servis baglantilari", "Platform bazli tercih alanlari", "Yonetim omurgasi"],
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-semibold text-foreground">Genel Ayarlar</h3>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          Bu alan teknik ayarlarin yigilmasi yerine, temel sistem tercihlerini kolay takip
          edebileceginiz sakin bir merkez olarak yeniden duzenlendi.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <section
            key={card.title}
            className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-start gap-3">
              <PremiumIconBadge icon={card.icon} tone={card.tone} size="xs" />
              <div className="min-w-0 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{card.title}</h4>
                <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {card.items.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary/40" />
                  {item}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = usePersistedState<TabKey>("settings:tab", "admin_dashboard");
  const [tabQuery, setTabQuery] = useState("");
  const deferredTabQuery = useDeferredValue(tabQuery);
  const isAdmin = useIsAdmin();
  const canViewAdminDashboard = usePermission("admin.dashboard.view");
  const canViewErrorLogs = usePermission("admin.error_logs.view");
  const canManageUsers = usePermission("admin.users.manage");
  const canViewAiUsage = usePermission("admin.ai_usage.view");
  const canViewDatabaseHealth = usePermission("admin.database_health.view");
  const canViewNotifications = usePermission("admin.notifications.view");
  const canManageDocuments = usePermission("admin.documents.manage");
  const canViewSecurityEvents = usePermission("security.events.view");
  const canManageRoles = usePermission("security.roles.manage");
  const canManageKvkk = usePermission("compliance.kvkk.manage");
  const canViewSelfHealing = usePermission("self_healing.view");

  const permissionState = useMemo<Record<string, boolean>>(
    () => ({
      "admin.dashboard.view": canViewAdminDashboard === true,
      "admin.error_logs.view": canViewErrorLogs === true,
      "admin.users.manage": canManageUsers === true,
      "admin.ai_usage.view": canViewAiUsage === true,
      "admin.database_health.view": canViewDatabaseHealth === true,
      "admin.notifications.view": canViewNotifications === true,
      "admin.documents.manage": canManageDocuments === true,
      "compliance.kvkk.manage": canManageKvkk === true,
      "self_healing.view": canViewSelfHealing === true,
      "security.events.view": canViewSecurityEvents === true,
      "security.roles.manage": canManageRoles === true,
    }),
    [
      canManageDocuments,
      canManageKvkk,
      canManageRoles,
      canManageUsers,
      canViewAdminDashboard,
      canViewAiUsage,
      canViewDatabaseHealth,
      canViewErrorLogs,
      canViewNotifications,
      canViewSecurityEvents,
      canViewSelfHealing,
    ],
  );

  const visibleTabs = useMemo(
    () =>
      allTabs.filter((tab) => {
        if (tab.adminOnly) return isAdmin === true;
        if (tab.permission) return permissionState[tab.permission] === true;
        return true;
      }),
    [isAdmin, permissionState],
  );

  const filteredTabs = useMemo(() => {
    const query = deferredTabQuery.trim().toLowerCase();
    if (!query) {
      return visibleTabs;
    }

    return visibleTabs.filter((tab) => {
      const haystack =
        `${tab.label} ${tab.description} ${sectionMeta[tab.section].label}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredTabQuery, visibleTabs]);

  const groupedTabs = useMemo(
    () =>
      (Object.keys(sectionMeta) as TabSectionKey[])
        .map((sectionKey) => ({
          sectionKey,
          ...sectionMeta[sectionKey],
          tabs: filteredTabs.filter((tab) => tab.section === sectionKey),
        }))
        .filter((group) => group.tabs.length > 0),
    [filteredTabs],
  );

  const quickAccessTabs = useMemo(
    () => visibleTabs.filter((tab) => tab.quick).slice(0, 5),
    [visibleTabs],
  );

  const activeTabDef = visibleTabs.find((tab) => tab.key === activeTab) ?? visibleTabs[0] ?? null;
  const activeSectionMeta = activeTabDef ? sectionMeta[activeTabDef.section] : null;
  const siblingTabs = activeTabDef
    ? visibleTabs
        .filter((tab) => tab.section === activeTabDef.section && tab.key !== activeTabDef.key)
        .slice(0, 3)
    : [];

  useEffect(() => {
    if (visibleTabs.some((tab) => tab.key === activeTab)) {
      return;
    }

    setActiveTab(visibleTabs[0]?.key ?? "general");
  }, [activeTab, setActiveTab, visibleTabs]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (
      requestedTab === "admin_dashboard" ||
      requestedTab === "general" ||
      requestedTab === "mevzuat" ||
      requestedTab === "error_logs" ||
      requestedTab === "users" ||
      requestedTab === "ai_usage" ||
      requestedTab === "database_health" ||
      requestedTab === "admin_notifications" ||
      requestedTab === "admin_documents" ||
      requestedTab === "kvkk_center" ||
      requestedTab === "self_healing" ||
      requestedTab === "security_events" ||
      requestedTab === "role_management" ||
      requestedTab === "audit_logs" ||
      requestedTab === "deleted_records" ||
      requestedTab === "admin_ai"
    ) {
      setActiveTab(requestedTab);
    }
  }, [searchParams, setActiveTab]);

  function handleTabChange(nextTab: TabKey) {
    startTransition(() => {
      setActiveTab(nextTab);
    });
  }

  if (!activeTabDef) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
        Bu hesap icin goruntulenebilir ayar sekmesi bulunamadi.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(248,244,235,0.98))] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-4">
            <PremiumIconBadge icon={ClipboardCheck} tone="gold" size="md" />
            <div className="space-y-2">
              <span className="eyebrow">Yonetim Merkezi</span>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Ayarlar</h1>
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                Guvenlik, uyum, operasyon ve sistem ekranlarini tek merkezde daha rahat takip edin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-border bg-white/80 px-3 py-2 text-xs font-medium text-muted-foreground">
              {visibleTabs.length} aktif ekran
            </span>
            {activeSectionMeta ? (
              <span className="inline-flex items-center rounded-full border border-border bg-white/80 px-3 py-2 text-xs font-medium text-muted-foreground">
                {activeSectionMeta.label}
              </span>
            ) : null}
            {isAdmin === true ? (
              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Admin gorunumu
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {quickAccessTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
                activeTab === tab.key
                  ? "border-primary/35 bg-primary/10 text-foreground shadow-[var(--shadow-soft)]"
                  : "border-border bg-white/75 text-muted-foreground hover:border-primary/25 hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ayar Menusu</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Aradiginiz ekranlari aratarak veya kategoriye gore secerek ilerleyin.
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={tabQuery}
                  onChange={(event) => setTabQuery(event.target.value)}
                  placeholder="Ayar ara..."
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/40"
                />
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {groupedTabs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                  Aramaniza uygun ayar bulunamadi.
                </div>
              ) : (
                groupedTabs.map((group) => (
                  <div key={group.sectionKey} className="space-y-2.5">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {group.label}
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {group.tabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => handleTabChange(tab.key)}
                          className={cn(
                            "group w-full rounded-xl border px-3 py-2.5 text-left transition",
                            activeTab === tab.key
                              ? "border-primary/35 bg-primary/10 shadow-[var(--shadow-soft)]"
                              : "border-border bg-background hover:border-primary/25 hover:bg-secondary/60",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <PremiumIconBadge icon={tab.icon} tone={tab.tone} size="xs" />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">{tab.label}</span>
                                  {tab.key === "admin_ai" ? (
                                    <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                                      N
                                    </span>
                                  ) : null}
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
                              </div>
                              {activeTab === tab.key ? (
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {tab.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <PremiumIconBadge icon={activeTabDef.icon} tone={activeTabDef.tone} size="sm" />
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                      {activeTabDef.label}
                    </h2>
                    {activeSectionMeta ? (
                      <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {activeSectionMeta.label}
                      </span>
                    ) : null}
                  </div>
                  <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                    {activeTabDef.description}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[250px]">
                <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Aktif alan
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">{activeTabDef.label}</div>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Kategori
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {activeSectionMeta?.label}
                  </div>
                </div>
              </div>
            </div>

            {siblingTabs.length > 0 ? (
              <div className="mt-4 border-t border-border pt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Ayni kategoride diger ekranlar
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {siblingTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleTabChange(tab.key)}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/25 hover:text-primary"
                    >
                      <tab.icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <div className="space-y-4">
            {activeTab === "admin_dashboard" && canViewAdminDashboard === true && (
              <AdminOverviewTab onNavigate={(tab) => handleTabChange(tab)} />
            )}
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "mevzuat" && <MevzuatSyncTab />}
            {activeTab === "error_logs" && canViewErrorLogs === true && <ErrorLogsTab />}
            {activeTab === "users" && canManageUsers === true && (
              <UserManagementTab onNavigateRoleManagement={() => handleTabChange("role_management")} />
            )}
            {activeTab === "ai_usage" && canViewAiUsage === true && <AIUsageTab />}
            {activeTab === "database_health" && canViewDatabaseHealth === true && (
              <DatabaseHealthTab />
            )}
            {activeTab === "admin_notifications" && canViewNotifications === true && (
              <AdminNotificationsTab />
            )}
            {activeTab === "admin_documents" && canManageDocuments === true && <AdminDocumentsTab />}
            {activeTab === "kvkk_center" && canManageKvkk === true && <KvkkCenterTab />}
            {activeTab === "self_healing" && canViewSelfHealing === true && <SelfHealingTab />}
            {activeTab === "security_events" && canViewSecurityEvents === true && (
              <SecurityEventsTab />
            )}
            {activeTab === "role_management" && canManageRoles === true && <RoleManagementTab />}
            {activeTab === "audit_logs" && isAdmin === true && <AuditLogsTab />}
            {activeTab === "deleted_records" && isAdmin === true && <DeletedRecordsTab />}
            {activeTab === "admin_ai" && isAdmin === true && <AdminAITab />}
          </div>
        </div>
      </div>
    </div>
  );
}
