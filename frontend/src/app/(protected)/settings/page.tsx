"use client";

import { useEffect, useState } from "react";
import { usePersistedState } from "@/lib/use-persisted-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { MevzuatSyncTab } from "./MevzuatSyncTab";
import { AdminAITab } from "./AdminAITab";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/* Admin role check                                                    */
/* ------------------------------------------------------------------ */

const ADMIN_ROLES = ["super_admin", "platform_admin"];

function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(true); // Default: true (development / early stage)

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (!supabase) { setIsAdmin(true); return; }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsAdmin(true); return; } // Giris yapilmissa zaten protected route

        // profile_roles tablosu varsa kontrol et
        const { data: roles, error } = await supabase
          .from("profile_roles")
          .select("role")
          .eq("profile_id", user.id);

        if (error || !roles || roles.length === 0) {
          // Tablo yok veya rol atanmamis = admin kabul et (early stage)
          setIsAdmin(true);
          return;
        }

        setIsAdmin(roles.some((r: { role: string }) => ADMIN_ROLES.includes(r.role)));
      } catch {
        setIsAdmin(true);
      }
    })();
  }, []);

  return isAdmin;
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

type TabKey = "general" | "mevzuat" | "admin_ai";

type TabDef = { key: TabKey; label: string; adminOnly?: boolean };

const allTabs: TabDef[] = [
  { key: "general", label: "Genel" },
  { key: "mevzuat", label: "Mevzuat Senkronizasyonu" },
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
  const [activeTab, setActiveTab] = usePersistedState<TabKey>("settings:tab", "mevzuat");
  const isAdmin = useIsAdmin();

  const visibleTabs = allTabs.filter((t) => !t.adminOnly || isAdmin);

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
        {activeTab === "admin_ai" && isAdmin && <AdminAITab />}
      </div>
    </>
  );
}
