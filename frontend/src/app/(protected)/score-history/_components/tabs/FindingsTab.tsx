"use client";

import { useMemo, useState } from "react";
import { TriangleAlert, Link2, ShieldAlert, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SubcategorySidebar, type SidebarItem } from "../SubcategorySidebar";
import type { SessionState, SessionActions } from "../../_hooks/useInspectionSession";
import { RESPONSE_COPY } from "../../_lib/constants";

type Props = {
  state: SessionState;
  actions: SessionActions;
};

export function FindingsTab({ state, actions }: Props) {
  const { activeTemplate, answers } = state;
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const findings = useMemo(() => {
    if (!activeTemplate) return [];
    return activeTemplate.questions
      .map((q) => ({ q, a: answers[q.id] }))
      .filter(({ a }) => a?.responseStatus === "uygunsuz" || a?.responseStatus === "kritik");
  }, [activeTemplate, answers]);

  const sidebarItems = useMemo<SidebarItem[]>(
    () =>
      findings.map(({ q, a }) => ({
        id: q.id,
        title: q.text.length > 60 ? `${q.text.slice(0, 57)}...` : q.text,
        description: `${q.category} · ${a?.decision === "pending" ? "Karar bekliyor" : "İncelendi"}`,
        badge: a?.responseStatus === "kritik" ? "Kritik" : "Uygunsuz",
      })),
    [findings],
  );

  const selected = findings.find(({ q }) => q.id === selectedQuestionId) ?? findings[0];

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <SubcategorySidebar
        title={`Tespitler (${findings.length})`}
        items={sidebarItems}
        activeItemId={selected?.q.id ?? null}
        onSelect={setSelectedQuestionId}
        emptyLabel="Henüz tespit yok. Uygunsuz veya kritik cevaplar burada görünür."
      />

      {selected ? (
        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-rose-200/70 bg-gradient-to-br from-white via-rose-50/55 to-orange-50/35 p-5 shadow-sm dark:border-rose-400/15 dark:from-slate-950 dark:via-rose-950/20 dark:to-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TriangleAlert
                    size={18}
                    className={cn(
                      selected.a?.responseStatus === "kritik"
                        ? "text-red-600"
                        : "text-amber-600",
                    )}
                  />
                  <h3 className="text-lg font-semibold text-foreground">
                    {selected.q.text}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selected.q.section} · {selected.q.category}
                </p>
              </div>
              <Badge
                variant={
                  RESPONSE_COPY[selected.a!.responseStatus!]?.badgeVariant ?? "neutral"
                }
              >
                {RESPONSE_COPY[selected.a!.responseStatus!]?.label}
              </Badge>
            </div>

            <div className="grid gap-4 pt-4 md:grid-cols-2">
              <DetailField label="Saha notu" value={selected.a?.note} />
              <DetailField label="Önerilen aksiyon" value={selected.a?.actionTitle} />
              <DetailField
                label="Termin"
                value={selected.a?.actionDeadline ?? undefined}
              />
              <DetailField
                label="Fotoğraf sayısı"
                value={String(selected.a?.photoUrls.length ?? 0)}
              />
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/55 to-amber-50/30 p-5 shadow-sm dark:border-violet-400/15 dark:from-slate-950 dark:via-violet-950/20 dark:to-slate-950">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert size={18} className="text-[var(--gold)]" />
              <h4 className="text-base font-semibold text-foreground">Nova bağlantı önerileri</h4>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Öneri üretimi için Nova edge function'ı henüz aktifleştirilmedi (S4). Şimdilik manuel karar verebilirsiniz.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  actions.recordDecisionFor(selected.q.id, "linked_risk")
                }
              >
                <Link2 className="mr-2 h-4 w-4" />
                Mevcut riske bağla
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  actions.recordDecisionFor(selected.q.id, "linked_action")
                }
              >
                <Link2 className="mr-2 h-4 w-4" />
                Açık aksiyona bağla
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  actions.recordDecisionFor(selected.q.id, "started_dof")
                }
              >
                DÖF başlat
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  actions.recordDecisionFor(selected.q.id, "created_risk")
                }
              >
                Yeni risk taslağı
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actions.recordDecisionFor(selected.q.id, "ignored")}
              >
                Yok say
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actions.recordDecisionFor(selected.q.id, "reviewed")}
              >
                <ListChecks className="mr-2 h-4 w-4" />
                Sadece incele
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-dashed border-rose-200/70 bg-rose-50/40 px-8 py-16 text-center dark:border-rose-400/15 dark:bg-rose-950/15">
          <TriangleAlert size={32} className="text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">Henüz tespit yok</p>
          <p className="text-sm text-muted-foreground">
            Aktif inceleme sırasında uygunsuz veya kritik cevaplar burada tespit olarak görünür.
          </p>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">
        {value && value.trim() ? value : <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}
