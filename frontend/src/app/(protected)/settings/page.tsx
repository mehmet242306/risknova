"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePersistedState } from "@/lib/use-persisted-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { MevzuatSyncTab } from "./MevzuatSyncTab";
import { AdminAITab } from "./AdminAITab";
import { AuditLogsTab } from "./AuditLogsTab";
import { DeletedRecordsTab } from "./DeletedRecordsTab";
import { SecurityEventsTab } from "./SecurityEventsTab";
import { useIsAdmin } from "@/lib/hooks/use-is-admin";

/* ------------------------------------------------------------------ */
/* Admin role check                                                    */
/* ------------------------------------------------------------------ */
//
// GÜVENLİK (Parça C, 2026-04-11):
// Eski lokal useIsAdmin hook'u 5 katlı fail-OPEN idi (default true, client yok
// true, user yok true, profile_roles tablosu yok true, catch true). Bu yüzden
// her authenticated kullanıcı admin sanılıyordu. Ayrıca `profile_roles` tablosu
// DB'de hiç yoktu, her sorgu hata dönüyordu ve hata fallback'i "true" idi.
//
// Yeni yaklaşım:
// - Global `useIsAdmin` hook'u (frontend/src/lib/hooks/use-is-admin.ts) kullanılır
// - O hook is_super_admin() RPC'sini çağırır (Adım 0.5 Parça A'da oluşturuldu)
// - Dönüş: boolean | null (null = loading, true = super admin, false = değil)
// - Tüm fail path'ler false döner (fail-CLOSED)
// Referans: docs/database-hardening-plan.md §13 (Adım 0.5)

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

type TabKey = "general" | "mevzuat" | "security_events" | "audit_logs" | "deleted_records" | "admin_ai";

type TabDef = { key: TabKey; label: string; adminOnly?: boolean };

const allTabs: TabDef[] = [
  { key: "general", label: "Genel" },
  { key: "mevzuat", label: "Mevzuat Senkronizasyonu" },
  { key: "security_events", label: "Guvenlik Olaylari", adminOnly: true },
  { key: "audit_logs", label: "Audit Loglari", adminOnly: true },
  { key: "deleted_records", label: "Silinmis Kayitlar", adminOnly: true },
  { key: "admin_ai", label: "Nova AI", adminOnly: true },
];

/* ------------------------------------------------------------------ */
/* General settings placeholder                                        */
/* ------------------------------------------------------------------ */

function GeneralTab() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground">Genel Ayarlar</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Sistem tercihleri, kullanici deneyimi ayarlari ve organizasyon duzeyi yapilandirmalar burada yer alacaktir.
      </p>
      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary/40" />
          Tema ve gorunum tercihleri
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary/40" />
          Bildirim ayarlari
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary/40" />
          Dil ve bolge secimi
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary/40" />
          API anahtarlari ve entegrasyonlar
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = usePersistedState<TabKey>("settings:tab", "mevzuat");
  const isAdmin = useIsAdmin(); // boolean | null (null = loading)

  // Tab görünürlüğü: admin tabları SADECE isAdmin === true ise görünür
  // (null/loading veya false durumlarda admin tablar gizli — fail-CLOSED)
  const visibleTabs = allTabs.filter((t) => !t.adminOnly || isAdmin === true);

  useEffect(() => {
    if (visibleTabs.some((tab) => tab.key === activeTab)) {
      return;
    }
    setActiveTab("general");
  }, [activeTab, setActiveTab, visibleTabs]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "general" || requestedTab === "mevzuat" || requestedTab === "security_events" || requestedTab === "audit_logs" || requestedTab === "deleted_records" || requestedTab === "admin_ai") {
      setActiveTab(requestedTab);
    }
  }, [searchParams, setActiveTab]);

  return (
    <>
      <PageHeader
        eyebrow="Yonetim"
        title="Ayarlar"
        description="Sistem tercihleri, mevzuat senkronizasyonu ve organizasyon duzeyi yapilandirmalar."
      />

      {/* Tab bar */}
      <nav className="flex gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {tab.key === "admin_ai" && <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent)] text-[9px] font-bold text-white">N</span>}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "mevzuat" && <MevzuatSyncTab />}
        {activeTab === "security_events" && isAdmin === true && <SecurityEventsTab />}
        {activeTab === "audit_logs" && isAdmin === true && <AuditLogsTab />}
        {activeTab === "deleted_records" && isAdmin === true && <DeletedRecordsTab />}
        {activeTab === "admin_ai" && isAdmin === true && <AdminAITab />}
      </div>
    </>
  );
}
