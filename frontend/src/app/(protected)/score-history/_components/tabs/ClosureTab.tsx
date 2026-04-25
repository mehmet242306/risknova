"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileDown, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubcategorySidebar, type SidebarItem } from "../SubcategorySidebar";
import type { SessionState, SessionActions } from "../../_hooks/useInspectionSession";

type Props = {
  state: SessionState;
  actions: SessionActions;
};

export function ClosureTab({ state, actions }: Props) {
  const { activeTemplate, activeRun, answers } = state;
  const [subItem, setSubItem] = useState<string>("check");
  const [completing, setCompleting] = useState(false);

  const missingItems = useMemo(() => {
    if (!activeTemplate) return [];
    const gaps: string[] = [];
    for (const q of activeTemplate.questions) {
      const a = answers[q.id];
      if (!a?.responseStatus) {
        gaps.push(`"${q.text.slice(0, 60)}..." henüz cevaplanmadı.`);
        continue;
      }
      if (a.responseStatus === "kritik") {
        if (!a.note?.trim()) gaps.push(`"${q.text.slice(0, 40)}..." kritik: not eksik.`);
        if (!a.actionTitle?.trim())
          gaps.push(`"${q.text.slice(0, 40)}..." kritik: aksiyon eksik.`);
        if (!a.actionDeadline) gaps.push(`"${q.text.slice(0, 40)}..." kritik: termin eksik.`);
        if (a.photoUrls.length === 0)
          gaps.push(`"${q.text.slice(0, 40)}..." kritik: fotoğraf eksik.`);
      }
      if (a.responseStatus === "na" && !a.naReason?.trim()) {
        gaps.push(`"${q.text.slice(0, 40)}..." N/A: gerekçe eksik.`);
      }
    }
    return gaps;
  }, [activeTemplate, answers]);

  const sidebarItems: SidebarItem[] = [
    {
      id: "check",
      title: "Denetim kontrolü",
      description: missingItems.length > 0 ? `${missingItems.length} eksik alan` : "Tamamlanmaya hazır",
      badge: missingItems.length > 0 ? "Eksik" : "Hazır",
    },
    {
      id: "report",
      title: "Rapor & Paylaşım",
      description: activeRun?.status === "report_ready" ? "Rapor oluşturuldu" : "Bekleniyor",
      badge: activeRun?.status === "report_ready" ? "Hazır" : "—",
    },
  ];

  if (!activeRun) {
    return (
      <div className="mt-4 rounded-[1.5rem] border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
        <FileDown className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">Aktif denetim yok</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Raporu oluşturmak için önce bir denetim başlatıp cevaplayın.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <SubcategorySidebar
        title="Kapanış Adımları"
        items={sidebarItems}
        activeItemId={subItem}
        onSelect={setSubItem}
      />

      {subItem === "check" ? (
        <div className="rounded-[1.5rem] border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/55 to-teal-50/35 p-5 shadow-sm dark:border-emerald-400/15 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">Denetim özeti</h3>
            <Badge variant="neutral">{activeRun.code ?? "Kayıt bekleniyor"}</Badge>
            <Badge variant="success">%{activeRun.readinessScore} hazırlık</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <StatBox label="Uygun" value={activeRun.uygunCount} tone="emerald" />
            <StatBox label="Uygunsuz" value={activeRun.uygunsuzCount} tone="amber" />
            <StatBox label="Kritik" value={activeRun.kritikCount} tone="red" />
            <StatBox label="N/A" value={activeRun.naCount} tone="slate" />
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {missingItems.length > 0 ? (
                <TriangleAlert className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <span>
                {missingItems.length > 0
                  ? `${missingItems.length} eksik alan tespit edildi`
                  : "Tüm zorunlu alanlar tamam"}
              </span>
            </div>
            {missingItems.length > 0 ? (
              <ul className="max-h-64 space-y-1 overflow-auto rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200">
                {missingItems.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              disabled={missingItems.length > 0 || completing || activeRun.status !== "in_progress"}
              onClick={async () => {
                setCompleting(true);
                await actions.completeRun();
                setCompleting(false);
                setSubItem("report");
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {completing ? "Tamamlanıyor..." : "Denetimi tamamla"}
            </Button>
            <Button variant="outline" onClick={() => actions.abandonRun()}>
              Oturumu iptal et
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/55 to-sky-50/35 p-5 shadow-sm dark:border-emerald-400/15 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <FileDown size={18} className="text-[var(--gold)]" />
            <h3 className="text-lg font-semibold text-foreground">Rapor & Paylaşım</h3>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Denetim tamamlandığında PDF rapor oluşturma, risk analizine aktarma ve paylaşım seçenekleri burada görünür. PDF üretimi S6'da (edge function `inspection-report-pdf`) aktifleşecek.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" disabled>
              <FileDown className="mr-2 h-4 w-4" />
              PDF rapor (S6)
            </Button>
            <Button variant="outline" disabled>
              Risk analizine aktar (S5)
            </Button>
            <Button variant="outline" disabled>
              E-posta gönder (S6)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "red" | "slate";
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-200",
    amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200",
    red: "border-red-200 bg-red-50 text-red-900 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-200",
    slate: "border-slate-200 bg-slate-50 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
  };
  return (
    <div className={`rounded-xl border p-3 ${toneClass[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
