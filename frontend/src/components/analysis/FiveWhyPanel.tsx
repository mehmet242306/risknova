"use client";

import { useRef, useState, useCallback } from "react";
import {
  HelpCircle,
  Sparkles,
  Plus,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { exportPanelPdf } from "@/lib/export-panel-pdf";
import type { FiveWhyData } from "@/lib/analysis/types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface FiveWhyPanelProps {
  incidentTitle: string;
  initialData?: FiveWhyData | null;
  onSave: (data: FiveWhyData) => void;
  onAiRequest: (context: {
    whys: { question: string; answer: string }[];
  }) => Promise<{
    nextQuestion?: string;
    suggestedAnswer?: string;
    rootCause?: string;
    done?: boolean;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_WHYS = 7;

const DEFAULT_WHY: () => { question: string; answer: string } = () => ({
  question: "Neden?",
  answer: "",
});

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FiveWhyPanel({
  incidentTitle,
  initialData,
  onSave,
  onAiRequest,
}: FiveWhyPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [whys, setWhys] = useState<{ question: string; answer: string }[]>(
    initialData?.whys?.length ? initialData.whys : [DEFAULT_WHY()],
  );
  const [rootCause, setRootCause] = useState(initialData?.rootCause ?? "");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  /* ---- helpers ---------------------------------------------------- */

  const updateWhy = useCallback(
    (index: number, field: "question" | "answer", value: string) => {
      setWhys((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  const removeWhy = useCallback(
    (index: number) => {
      if (whys.length <= 1) return;
      setWhys((prev) => prev.filter((_, i) => i !== index));
    },
    [whys.length],
  );

  const addManualWhy = useCallback(() => {
    if (whys.length >= MAX_WHYS) return;
    setWhys((prev) => [...prev, DEFAULT_WHY()]);
  }, [whys.length]);

  /* ---- AI request ------------------------------------------------- */

  const handleAiRequest = useCallback(async () => {
    setAiError(null);
    setAiLoading(true);

    try {
      const result = await onAiRequest({ whys });

      if (result.done && result.rootCause) {
        setRootCause(result.rootCause);
        setIsDone(true);
      } else if (result.nextQuestion) {
        const nextItem = {
          question: result.nextQuestion ?? "Neden?",
          answer: result.suggestedAnswer ?? "",
        };
        setWhys((prev) => {
          // Eğer son satır default/boş ise (ilk iterasyon) → onun YERİNE geç (yeni satır ekleme)
          const last = prev[prev.length - 1];
          const isLastEmpty = last && !last.answer?.trim() &&
            (last.question === "Neden?" || !last.question?.trim());
          if (isLastEmpty) {
            const next = [...prev];
            next[next.length - 1] = nextItem;
            return next;
          }
          // Aksi halde ekle (limit kontrolü)
          if (prev.length >= MAX_WHYS) return prev;
          return [...prev, nextItem];
        });
      } else if (result.rootCause) {
        setRootCause(result.rootCause);
        setIsDone(true);
      }
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "AI istegi basarisiz oldu",
      );
    } finally {
      setAiLoading(false);
    }
  }, [whys, onAiRequest]);

  /* ---- save ------------------------------------------------------- */

  const handleSave = useCallback(async () => {
    setSaveLoading(true);
    try {
      await onSave({ whys, rootCause });
    } finally {
      setSaveLoading(false);
    }
  }, [whys, rootCause, onSave]);

  /* ---- render ----------------------------------------------------- */

  const canAddMore = whys.length < MAX_WHYS && !isDone;
  const hasAnswers = whys.some((w) => w.answer.trim().length > 0);

  return (
    <div ref={panelRef} className="flex flex-col gap-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <HelpCircle className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <CardTitle>5 Neden Analizi</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {incidentTitle}
              </p>
            </div>
            <Badge variant="default">{whys.length} / {MAX_WHYS}</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Timeline of Whys */}
      <div className="relative pl-10">
        {/* Vertical connector line */}
        {whys.length > 1 && (
          <div
            className="absolute left-[18px] top-6 w-0.5 bg-blue-300 dark:bg-blue-700"
            style={{ height: `calc(100% - 48px)` }}
          />
        )}

        <div className="flex flex-col gap-6">
          {whys.map((why, index) => (
            <div key={index} className="relative">
              {/* Numbered circle */}
              <div className="absolute -left-10 top-5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-blue-400 bg-card text-sm font-bold text-blue-600 dark:border-blue-500 dark:text-blue-400 z-10">
                {index + 1}
              </div>

              {/* Q&A Card */}
              <Card className="hover:translate-y-0">
                <CardContent className="pt-5">
                  {/* Question row */}
                  <div className="mb-3 flex items-start gap-2">
                    <Textarea
                      value={why.question}
                      onChange={(e) =>
                        updateWhy(index, "question", e.target.value)
                      }
                      placeholder="Neden?"
                      rows={1}
                      className="min-h-[44px] flex-1 font-medium text-blue-700 dark:text-blue-300"
                    />
                    {whys.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWhy(index)}
                        className="mt-1 text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Answer */}
                  <Textarea
                    value={why.answer}
                    onChange={(e) => updateWhy(index, "answer", e.target.value)}
                    placeholder="Cevabinizi yazin..."
                    rows={2}
                    className="min-h-[72px]"
                  />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* AI Error */}
      {aiError && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {aiError}
        </div>
      )}

      {/* Root Cause */}
      {(rootCause || isDone) && (
        <Card className="border-green-300 dark:border-green-700">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <CardTitle className="text-green-700 dark:text-green-400">
                Kok Neden
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="Kok neden burada gorunecek..."
              rows={3}
              className="min-h-[88px] border-green-200 dark:border-green-800"
            />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {/* AI button — ilk iterasyonda da çalışsın (incident narrative'inden ilk neden-cevap üretir) */}
        <Button
          variant="accent"
          size="md"
          onClick={handleAiRequest}
          disabled={aiLoading || isDone}
          title={hasAnswers
            ? "Mevcut cevaplara göre bir sonraki Neden sorusunu + önerilen cevabı üretir"
            : "Olay anlatımından ilk Neden sorusunu + önerilen cevabı üretir (uzman düzenleyebilir)"}
        >
          {aiLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {aiLoading
            ? "AI düşünüyor..."
            : hasAnswers
              ? "AI ile Sonraki Neden + Cevabı Üret"
              : "AI ile İlk Neden + Cevabı Üret"}
        </Button>

        {/* Manual add */}
        {canAddMore && (
          <Button variant="outline" size="md" onClick={addManualWhy}>
            <Plus className="h-4 w-4" />
            Manuel Soru Ekle
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Eski "PDF" (DOM screenshot) butonu kaldırıldı — yukarıdaki global PDF Aksiyon Bar kullanılıyor. */}

        {/* Save */}
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saveLoading || (!hasAnswers && !rootCause)}
        >
          {saveLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Kaydet
        </Button>
      </div>
    </div>
  );
}
