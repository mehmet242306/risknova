"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { MevzuatSyncTab } from "./MevzuatSyncTab";

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

const tabs = [
  { key: "general", label: "Genel" },
  { key: "mevzuat", label: "Mevzuat Senkronizasyonu" },
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
  const [activeTab, setActiveTab] = useState("mevzuat");

  return (
    <>
      <PageHeader
        eyebrow="Yonetim"
        title="Ayarlar"
        description="Sistem tercihleri, mevzuat senkronizasyonu ve organizasyon duzeyi yapilandirmalar."
      />

      {/* Tab bar */}
      <nav className="flex gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "general" && <GeneralTab />}
        {activeTab === "mevzuat" && <MevzuatSyncTab />}
      </div>
    </>
  );
}
