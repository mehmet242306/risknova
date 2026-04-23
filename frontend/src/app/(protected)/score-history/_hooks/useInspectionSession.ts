"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listChecklistTemplates,
  fetchTemplateById,
  type ChecklistTemplateRecord,
  type TemplateWithQuestions,
} from "@/lib/supabase/checklist-api";
import {
  fetchAnswers,
  getResumableRun,
  createInspectionRun,
  completeRun as apiCompleteRun,
  abandonRun as apiAbandonRun,
  upsertAnswer as apiUpsertAnswer,
  recordDecision as apiRecordDecision,
  updateRun,
  computeRunCounts,
  type InspectionAnswerRecord,
  type InspectionRunMode,
  type InspectionRunRecord,
  type SuggestionDecision,
  type ResponseStatus,
  type DecisionTargetTable,
} from "@/lib/supabase/inspection-api";

export type SessionState = {
  templates: ChecklistTemplateRecord[];
  activeTemplate: TemplateWithQuestions | null;
  activeRun: InspectionRunRecord | null;
  answers: Record<string, InspectionAnswerRecord>;
  loadingTemplates: boolean;
  loadingActive: boolean;
  savingAnswer: boolean;
};

export type SessionActions = {
  refreshTemplates: () => Promise<void>;
  selectTemplate: (templateId: string | null) => Promise<void>;
  startRun: (args: {
    mode: InspectionRunMode;
    siteLabel?: string;
    location?: string;
    lineOrShift?: string;
    companyWorkspaceId?: string | null;
  }) => Promise<InspectionRunRecord | null>;
  saveAnswer: (args: {
    questionId: string;
    responseStatus?: ResponseStatus;
    note?: string;
    photoUrls?: string[];
    voiceNoteUrl?: string | null;
    actionTitle?: string;
    actionDeadline?: string | null;
    actionResponsibleUserId?: string | null;
    naReason?: string;
    suggestionReviewed?: boolean;
  }) => Promise<boolean>;
  recordDecisionFor: (
    questionId: string,
    decision: SuggestionDecision,
    target?: { table: DecisionTargetTable; id: string },
  ) => Promise<boolean>;
  completeRun: () => Promise<boolean>;
  abandonRun: () => Promise<boolean>;
};

export function useInspectionSession(): [SessionState, SessionActions] {
  const [templates, setTemplates] = useState<ChecklistTemplateRecord[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<TemplateWithQuestions | null>(null);
  const [activeRun, setActiveRun] = useState<InspectionRunRecord | null>(null);
  const [answers, setAnswers] = useState<Record<string, InspectionAnswerRecord>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingActive, setLoadingActive] = useState(false);
  const [savingAnswer, setSavingAnswer] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    const data = await listChecklistTemplates({ includeArchived: false });
    if (mountedRef.current) {
      setTemplates(data);
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

  const selectTemplate = useCallback(
    async (templateId: string | null) => {
      if (!templateId) {
        setActiveTemplate(null);
        setActiveRun(null);
        setAnswers({});
        return;
      }
      setLoadingActive(true);
      const tmpl = await fetchTemplateById(templateId);
      if (!mountedRef.current) return;
      setActiveTemplate(tmpl);

      const resumable = await getResumableRun(templateId, "official");
      if (!mountedRef.current) return;
      setActiveRun(resumable);

      if (resumable) {
        const list = await fetchAnswers(resumable.id);
        if (!mountedRef.current) return;
        const byQ: Record<string, InspectionAnswerRecord> = {};
        for (const a of list) byQ[a.questionId] = a;
        setAnswers(byQ);
      } else {
        setAnswers({});
      }
      setLoadingActive(false);
    },
    [],
  );

  const startRun = useCallback<SessionActions["startRun"]>(
    async (args) => {
      if (!activeTemplate) return null;
      const run = await createInspectionRun({
        templateId: activeTemplate.id,
        runMode: args.mode,
        siteLabel: args.siteLabel ?? null,
        location: args.location ?? null,
        lineOrShift: args.lineOrShift ?? null,
        companyWorkspaceId: args.companyWorkspaceId ?? null,
        totalQuestions: activeTemplate.questions.length,
        clientGeneratedAt: new Date().toISOString(),
      });
      if (run && mountedRef.current) {
        setActiveRun(run);
        setAnswers({});
      }
      return run;
    },
    [activeTemplate],
  );

  const syncRunCounts = useCallback(
    async (nextAnswers: Record<string, InspectionAnswerRecord>) => {
      if (!activeRun || !activeTemplate) return;
      const list = Object.values(nextAnswers);
      const criticals = list.filter((a) => a.responseStatus === "kritik");
      const allCritical =
        criticals.length === 0 ||
        criticals.every(
          (a) =>
            Boolean(a.actionTitle?.trim()) &&
            Boolean(a.actionDeadline) &&
            a.photoUrls.length > 0,
        );
      const counts = computeRunCounts(
        list,
        activeTemplate.questions.length,
        true,
        allCritical,
      );
      await updateRun(activeRun.id, {
        answeredCount: counts.answered,
        uygunCount: counts.uygun,
        uygunsuzCount: counts.uygunsuz,
        kritikCount: counts.kritik,
        naCount: counts.na,
        readinessScore: counts.readinessScore,
        totalQuestions: activeTemplate.questions.length,
      });
      if (mountedRef.current) {
        setActiveRun((current) =>
          current
            ? {
                ...current,
                answeredCount: counts.answered,
                uygunCount: counts.uygun,
                uygunsuzCount: counts.uygunsuz,
                kritikCount: counts.kritik,
                naCount: counts.na,
                readinessScore: counts.readinessScore,
              }
            : current,
        );
      }
    },
    [activeRun, activeTemplate],
  );

  const saveAnswer = useCallback<SessionActions["saveAnswer"]>(
    async (args) => {
      if (!activeRun) return false;
      setSavingAnswer(true);
      const saved = await apiUpsertAnswer({
        runId: activeRun.id,
        questionId: args.questionId,
        responseStatus: args.responseStatus,
        note: args.note,
        photoUrls: args.photoUrls,
        voiceNoteUrl: args.voiceNoteUrl,
        actionTitle: args.actionTitle,
        actionDeadline: args.actionDeadline ?? undefined,
        actionResponsibleUserId: args.actionResponsibleUserId ?? undefined,
        naReason: args.naReason,
        suggestionReviewed: args.suggestionReviewed,
      });
      if (!mountedRef.current) return Boolean(saved);
      if (saved) {
        const next = { ...answers, [args.questionId]: saved };
        setAnswers(next);
        void syncRunCounts(next);
      }
      setSavingAnswer(false);
      return Boolean(saved);
    },
    [activeRun, answers, syncRunCounts],
  );

  const recordDecisionFor = useCallback<SessionActions["recordDecisionFor"]>(
    async (questionId, decision, target) => {
      const existing = answers[questionId];
      if (!existing) return false;
      const ok = await apiRecordDecision(existing.id, decision, target);
      if (ok && mountedRef.current) {
        setAnswers((current) => ({
          ...current,
          [questionId]: {
            ...current[questionId],
            decision,
            decisionTargetTable: target?.table ?? null,
            decisionTargetId: target?.id ?? null,
            decisionAt: new Date().toISOString(),
            suggestionReviewed: true,
          },
        }));
      }
      return ok;
    },
    [answers],
  );

  const completeRun = useCallback<SessionActions["completeRun"]>(async () => {
    if (!activeRun) return false;
    const ok = await apiCompleteRun(activeRun.id);
    if (ok && mountedRef.current) {
      setActiveRun((current) =>
        current
          ? { ...current, status: "completed", completedAt: new Date().toISOString() }
          : current,
      );
    }
    return ok;
  }, [activeRun]);

  const abandonRun = useCallback<SessionActions["abandonRun"]>(async () => {
    if (!activeRun) return false;
    const ok = await apiAbandonRun(activeRun.id);
    if (ok && mountedRef.current) {
      setActiveRun((current) => (current ? { ...current, status: "abandoned" } : current));
    }
    return ok;
  }, [activeRun]);

  const state = useMemo<SessionState>(
    () => ({
      templates,
      activeTemplate,
      activeRun,
      answers,
      loadingTemplates,
      loadingActive,
      savingAnswer,
    }),
    [templates, activeTemplate, activeRun, answers, loadingTemplates, loadingActive, savingAnswer],
  );

  const actions = useMemo<SessionActions>(
    () => ({
      refreshTemplates,
      selectTemplate,
      startRun,
      saveAnswer,
      recordDecisionFor,
      completeRun,
      abandonRun,
    }),
    [refreshTemplates, selectTemplate, startRun, saveAnswer, recordDecisionFor, completeRun, abandonRun],
  );

  return [state, actions];
}
