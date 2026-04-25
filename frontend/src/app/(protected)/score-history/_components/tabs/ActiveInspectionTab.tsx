"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Save, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SubcategorySidebar, type SidebarItem } from "../SubcategorySidebar";
import { EvidenceWidget } from "../EvidenceWidget";
import type { SessionState, SessionActions } from "../../_hooks/useInspectionSession";
import { getResponseTone, RESPONSE_COPY } from "../../_lib/constants";
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
    <div className="mt-4 space-y-4">
      <div className="rounded-[1.25rem] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-sky-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:from-amber-950/25 dark:via-slate-950 dark:to-sky-950/20 dark:text-amber-100">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/15 dark:text-amber-100">
            <Save className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Her cevap otomatik kaydedilir.</p>
            <p className="text-xs leading-5 text-muted-foreground">
              AyrÄ± bir gÃ¶nder butonu yok; seÃ§im, not, fotoÄŸraf ve ses kaydÄ± anÄ±nda denetim oturumuna iÅŸlenir.
            </p>
          </div>
          <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-white/10 dark:text-amber-100">
            {activeRun.code ?? activeRun.id.slice(0, 8)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
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
              runId={activeRun.id}
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
    </div>
  );
}

type QuestionCardProps = {
  index: number;
  total: number;
  question: NonNullable<SessionState["activeTemplate"]>["questions"][number];
  answer: SessionState["answers"][string] | undefined;
  runId: string;
  saving: boolean;
  onSetStatus: (status: ResponseStatus) => void;
  onUpdateField: (patch: {
    note?: string;
    actionTitle?: string;
    actionDeadline?: string | null;
    naReason?: string;
    photoUrls?: string[];
    voiceNoteUrl?: string | null;
    voiceTranscript?: string | null;
  }) => void;
};

function QuestionCard({
  index,
  total,
  question,
  answer,
  runId,
  saving,
  onSetStatus,
  onUpdateField,
}: QuestionCardProps) {
  const status = answer?.responseStatus;
  const needsDetail = status === "uygunsuz" || status === "kritik";
  const needsNaReason = status === "na";
  const tone = getResponseTone(status);
  const statusLabel = status ? RESPONSE_COPY[status].label : "Cevap bekliyor";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[1.5rem] border p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5",
        tone.card,
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1.5", tone.accent)} />
      <span className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-white/60 blur-2xl dark:bg-white/5" />
      <div className="relative flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
        <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold", tone.marker)}>
          {index + 1}
        </span>
        <span>Soru {index + 1} / {total}</span>
        <span>·</span>
        <span>{question.section}</span>
        <span>·</span>
        <span>{question.category}</span>
        <span className={cn("ml-auto rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone.info)}>
          {statusLabel}
        </span>
      </div>

      <div className="relative space-y-3 pt-4">
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
                  selected
                    ? "scale-[1.02] shadow-[0_14px_30px_rgba(15,23,42,0.12)] ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-background dark:shadow-[0_14px_30px_rgba(0,0,0,0.35)]"
                    : "",
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
          </div>
        ) : null}

        {answer?.id ? (
          <div className="mt-3">
            <EvidenceWidget
              runId={runId}
              answerId={answer.id}
              photoUrls={answer.photoUrls}
              voiceNoteUrl={answer.voiceNoteUrl}
              voiceTranscript={answer.voiceTranscript}
              onPhotosChange={(paths) => onUpdateField({ photoUrls: paths })}
              onVoiceNoteChange={(path, transcript) =>
                onUpdateField({ voiceNoteUrl: path, voiceTranscript: transcript ?? null })
              }
              disabled={saving}
            />
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
