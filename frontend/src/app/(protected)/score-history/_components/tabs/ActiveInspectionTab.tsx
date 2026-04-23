"use client";

import { useMemo, useState } from "react";
import { Camera, CheckCircle2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SubcategorySidebar, type SidebarItem } from "../SubcategorySidebar";
import type { SessionState, SessionActions } from "../../_hooks/useInspectionSession";
import { RESPONSE_COPY } from "../../_lib/constants";
import type { ResponseStatus } from "@/lib/supabase/inspection-api";

type Props = {
  state: SessionState;
  actions: SessionActions;
};

export function ActiveInspectionTab({ state, actions }: Props) {
  const { activeTemplate, activeRun, answers, savingAnswer } = state;
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const questions = activeTemplate?.questions ?? [];
  const grouped = useMemo(() => {
    const map: Record<string, typeof questions> = {};
    for (const q of questions) {
      if (!map[q.section]) map[q.section] = [];
      map[q.section].push(q);
    }
    return map;
  }, [questions]);

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const base: SidebarItem[] = [
      {
        id: "__all__",
        title: "Tüm sorular",
        description: `${questions.length} soru`,
        badge: activeRun
          ? `${activeRun.answeredCount}/${activeRun.totalQuestions || questions.length}`
          : "—",
      },
    ];
    for (const [section, qs] of Object.entries(grouped)) {
      const answered = qs.filter((q) => answers[q.id]?.responseStatus).length;
      base.push({
        id: `section:${section}`,
        title: section,
        description: `${qs.length} soru`,
        badge: `${answered}/${qs.length}`,
      });
    }
    return base;
  }, [questions, grouped, answers, activeRun]);

  const visibleQuestions = useMemo(() => {
    if (!selectedSection || selectedSection === "__all__") return questions;
    return questions.filter((q) => q.section === selectedSection);
  }, [questions, selectedSection]);

  if (!activeTemplate) {
    return (
      <div className="mt-4 rounded-[1.5rem] border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
        <Target className="mx-auto mb-3 h-10 w-10 text-[var(--gold)]" />
        <p className="text-base font-semibold text-foreground">Önce bir checklist seçin</p>
        <p className="mt-1 text-sm text-muted-foreground">
          "Checklistler" sekmesinden bir şablon seçip denetimi başlatın.
        </p>
      </div>
    );
  }

  if (!activeRun) {
    return (
      <div className="mt-4 rounded-[1.5rem] border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
        <Target className="mx-auto mb-3 h-10 w-10 text-[var(--gold)]" />
        <p className="text-base font-semibold text-foreground">Denetim henüz başlatılmadı</p>
        <p className="mt-1 text-sm text-muted-foreground">
          "Checklistler" sekmesinden "Denetimi başlat" ile resmi oturumu veya "Sanal prova" ile test oturumu açın.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <SubcategorySidebar
        title="Bölümler"
        items={sidebarItems}
        activeItemId={selectedSection ?? "__all__"}
        onSelect={(id) => {
          setSelectedSection(id.startsWith("section:") ? id.replace("section:", "") : "__all__");
        }}
      />

      <div className="space-y-3">
        {visibleQuestions.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/20 px-8 py-12 text-center text-sm text-muted-foreground">
            Bu bölümde soru yok.
          </div>
        ) : (
          visibleQuestions.map((question, index) => (
            <QuestionCard
              key={question.id}
              index={index}
              total={visibleQuestions.length}
              question={question}
              answer={answers[question.id]}
              saving={savingAnswer}
              onSetStatus={(status) =>
                actions.saveAnswer({ questionId: question.id, responseStatus: status })
              }
              onUpdateField={(patch) => actions.saveAnswer({ questionId: question.id, ...patch })}
            />
          ))
        )}
      </div>
    </div>
  );
}

type QuestionCardProps = {
  index: number;
  total: number;
  question: NonNullable<SessionState["activeTemplate"]>["questions"][number];
  answer: SessionState["answers"][string] | undefined;
  saving: boolean;
  onSetStatus: (status: ResponseStatus) => void;
  onUpdateField: (patch: {
    note?: string;
    actionTitle?: string;
    actionDeadline?: string | null;
    naReason?: string;
  }) => void;
};

function QuestionCard({
  index,
  total,
  question,
  answer,
  saving,
  onSetStatus,
  onUpdateField,
}: QuestionCardProps) {
  const status = answer?.responseStatus;
  const needsDetail = status === "uygunsuz" || status === "kritik";
  const needsNaReason = status === "na";

  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold)]/15 text-[11px] font-semibold text-[var(--gold)]">
          {index + 1}
        </span>
        <span>Soru {index + 1} / {total}</span>
        <span>·</span>
        <span>{question.section}</span>
        <span>·</span>
        <span>{question.category}</span>
      </div>

      <div className="space-y-3 pt-4">
        <p className="text-base font-medium leading-7 text-foreground">{question.text}</p>
        {question.ruleHint ? (
          <p className="text-xs leading-5 text-muted-foreground">{question.ruleHint}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
          {(Object.keys(RESPONSE_COPY) as ResponseStatus[]).map((rs) => {
            const meta = RESPONSE_COPY[rs];
            const selected = status === rs;
            return (
              <button
                key={rs}
                type="button"
                disabled={saving}
                onClick={() => onSetStatus(rs)}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-semibold transition",
                  meta.buttonClassName,
                  selected ? "ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-background" : "",
                )}
              >
                {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                {meta.label}
              </button>
            );
          })}
        </div>

        {needsDetail ? (
          <div className="mt-3 space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Tespit ayrıntıları</p>
              {status === "kritik" ? (
                <Badge variant="danger">Kritik: fotoğraf + aksiyon zorunlu</Badge>
              ) : null}
            </div>
            <Textarea
              placeholder="Saha notu"
              defaultValue={answer?.note ?? ""}
              onBlur={(e) => onUpdateField({ note: e.currentTarget.value })}
              rows={2}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Önerilen aksiyon"
                defaultValue={answer?.actionTitle ?? question.suggestedActionTitle ?? ""}
                onBlur={(e) => onUpdateField({ actionTitle: e.currentTarget.value })}
              />
              <Input
                type="date"
                defaultValue={answer?.actionDeadline ?? ""}
                onBlur={(e) => onUpdateField({ actionDeadline: e.currentTarget.value || null })}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Camera className="h-4 w-4" />
              <span>
                {answer?.photoUrls?.length ?? 0} fotoğraf yüklendi (yükleme UI'ı bir sonraki sürümde)
              </span>
            </div>
          </div>
        ) : null}

        {needsNaReason ? (
          <div className="mt-3 rounded-2xl border border-border bg-muted/20 p-4">
            <Textarea
              placeholder="N/A gerekçesi (zorunlu)"
              defaultValue={answer?.naReason ?? ""}
              onBlur={(e) => onUpdateField({ naReason: e.currentTarget.value })}
              rows={2}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
