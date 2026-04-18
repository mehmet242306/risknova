"use client";

import { useEffect, useState } from "react";
import { Calendar, FileText, GraduationCap, ClipboardList } from "lucide-react";
import { PlannerCore } from "./PlannerClient";
import YearlyWorkPlanTab from "./YearlyWorkPlanTab";
import YearlyTrainingTab from "./YearlyTrainingTab";
import TimesheetClient from "@/app/(protected)/timesheet/TimesheetClient";
import { scanUpcomingAjandaTasks } from "@/lib/supabase/ajanda-sync";

type TabKey = "planlayici" | "yillik-calisma" | "yillik-egitim" | "puantaj";

const TABS: { key: TabKey; label: string; icon: typeof Calendar; desc: string }[] = [
  { key: "planlayici",    label: "Planlayıcı",           icon: Calendar,       desc: "Takvim · görevler · hatırlatıcılar" },
  { key: "yillik-calisma", label: "Yıllık Çalışma Planı", icon: FileText,       desc: "İSG yıllık çalışma planı (resmi form)" },
  { key: "yillik-egitim",  label: "Yıllık Eğitim",         icon: GraduationCap,  desc: "Yıllık eğitim planı — katılımcılar & sertifika takibi" },
  { key: "puantaj",        label: "Puantaj",               icon: ClipboardList,  desc: "Saat/ücret takibi" },
];

export default function PlannerTabsShell() {
  const [active, setActive] = useState<TabKey>("planlayici");

  // Her sayfa açılışında yaklaşan görevler için günlük tarama
  // (aynı gün tekrar çağrılırsa skip — duplike önlemi)
  useEffect(() => {
    void scanUpcomingAjandaTasks({ daysAhead: 7 });
  }, []);

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Planlayıcı</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          İSG görevleri · yıllık çalışma planı · eğitim planı · puantaj — hepsi tek çatı altında.
        </p>
      </div>

      {/* Sekme seçici — belirgin kart butonlar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`group relative flex flex-col items-start gap-1 overflow-hidden rounded-xl border-2 p-3.5 text-left transition-all ${
                isActive
                  ? "border-primary bg-gradient-to-br from-primary/15 to-primary/5 text-foreground shadow-md"
                  : "border-border bg-card text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/50 hover:shadow-sm"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className={`inline-flex size-9 items-center justify-center rounded-lg ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary"}`}>
                  <Icon className="size-4" />
                </span>
                {isActive && (
                  <span className="inline-flex size-2 rounded-full bg-primary" aria-hidden="true" />
                )}
              </div>
              <div className={`text-sm font-semibold ${isActive ? "text-foreground" : ""}`}>{tab.label}</div>
              <div className="text-[10px] leading-4 text-muted-foreground">{tab.desc}</div>
            </button>
          );
        })}
      </div>

      {/* İçerik */}
      <div>
        {active === "planlayici" && <PlannerCore showHeader={false} />}
        {active === "yillik-calisma" && <YearlyWorkPlanTab />}
        {active === "yillik-egitim" && <YearlyTrainingTab />}
        {active === "puantaj" && <TimesheetClient />}
      </div>
    </div>
  );
}
