"use client";

import { useState } from "react";
import MevzuatSyncTab from "./MevzuatSyncTab";

type Tab = "general" | "mevzuat";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ayarlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sistem tercihleri ve yapılandırma</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border bg-secondary/50 p-0.5">
        {([["general", "Genel"], ["mevzuat", "Mevzuat Senkronizasyonu"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={["flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              tab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            ].join(" ")}>
            {l}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="rounded-[1.25rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground mb-4">Genel Ayarlar</h2>
          <p className="text-sm text-muted-foreground">Sistem tercihleri, kullanıcı deneyimi ayarları ve organizasyon düzeyi yapılandırmalar burada yer alacaktır.</p>
        </div>
      )}

      {tab === "mevzuat" && <MevzuatSyncTab />}
    </div>
  );
}
