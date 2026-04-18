"use client";

import { useRef, useState, useCallback } from "react";
import {
  Link,
  Sparkles,
  Plus,
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  ChevronRight,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { exportPanelPdf } from "@/lib/export-panel-pdf";
import type { ScatData } from "@/lib/analysis/types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ScatPanelProps {
  incidentTitle: string;
  initialData?: ScatData | null;
  onSave: (data: ScatData) => void;
  onAiRequest: () => Promise<ScatData>;
}

/* ------------------------------------------------------------------ */
/*  Level configuration                                                */
/* ------------------------------------------------------------------ */

interface LevelConfig {
  key: "immediateEvent" | "immediateCauses" | "basicCauses" | "controlDeficiencies";
  title: string;
  subtitle: string;
  borderColor: string;
  circleColor: string;
  badgeVariant: "danger" | "warning" | "warning" | "success";
  isList: boolean;
}

const LEVELS: LevelConfig[] = [
  {
    key: "immediateEvent",
    title: "Anlik Olay",
    subtitle: "Immediate Event",
    borderColor: "border-t-red-500",
    circleColor: "bg-red-500",
    badgeVariant: "danger",
    isList: false,
  },
  {
    key: "immediateCauses",
    title: "Anlik Nedenler",
    subtitle: "Immediate Causes",
    borderColor: "border-t-orange-500",
    circleColor: "bg-orange-500",
    badgeVariant: "warning",
    isList: true,
  },
  {
    key: "basicCauses",
    title: "Temel Nedenler",
    subtitle: "Basic Causes",
    borderColor: "border-t-yellow-500",
    circleColor: "bg-yellow-500",
    badgeVariant: "warning",
    isList: true,
  },
  {
    key: "controlDeficiencies",
    title: "Kontrol Eksiklikleri",
    subtitle: "Control Deficiencies",
    borderColor: "border-t-green-500",
    circleColor: "bg-green-500",
    badgeVariant: "success",
    isList: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

function getDefaultData(): ScatData {
  return {
    immediateEvent: "",
    immediateCauses: [""],
    basicCauses: [""],
    controlDeficiencies: [""],
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ScatPanel({
  incidentTitle,
  initialData,
  onSave,
  onAiRequest,
}: ScatPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ScatData>(
    initialData ?? getDefaultData(),
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  /* ---- single field update ---------------------------------------- */

  const updateImmediateEvent = useCallback((value: string) => {
    setData((prev) => ({ ...prev, immediateEvent: value }));
  }, []);

  /* ---- list helpers ----------------------------------------------- */

  const updateListItem = useCallback(
    (
      listKey: "immediateCauses" | "basicCauses" | "controlDeficiencies",
      index: number,
      value: string,
    ) => {
      setData((prev) => {
        const list = [...prev[listKey]];
        list[index] = value;
        return { ...prev, [listKey]: list };
      });
    },
    [],
  );

  const addListItem = useCallback(
    (listKey: "immediateCauses" | "basicCauses" | "controlDeficiencies") => {
      setData((prev) => ({
        ...prev,
        [listKey]: [...prev[listKey], ""],
      }));
    },
    [],
  );

  const removeListItem = useCallback(
    (
      listKey: "immediateCauses" | "basicCauses" | "controlDeficiencies",
      index: number,
    ) => {
      setData((prev) => {
        const list = prev[listKey];
        if (list.length <= 1) return prev;
        return { ...prev, [listKey]: list.filter((_, i) => i !== index) };
      });
    },
    [],
  );

  /* ---- AI request ------------------------------------------------- */

  const handleAiRequest = useCallback(async () => {
    setAiError(null);
    setAiLoading(true);

    try {
      const result = await onAiRequest();
      setData({
        immediateEvent: result.immediateEvent || data.immediateEvent,
        immediateCauses:
          result.immediateCauses?.length > 0
            ? result.immediateCauses
            : data.immediateCauses,
        basicCauses:
          result.basicCauses?.length > 0
            ? result.basicCauses
            : data.basicCauses,
        controlDeficiencies:
          result.controlDeficiencies?.length > 0
            ? result.controlDeficiencies
            : data.controlDeficiencies,
      });
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "AI istegi basarisiz oldu",
      );
    } finally {
      setAiLoading(false);
    }
  }, [onAiRequest, data]);

  /* ---- save ------------------------------------------------------- */

  const handleSave = useCallback(async () => {
    setSaveLoading(true);
    try {
      await onSave(data);
    } finally {
      setSaveLoading(false);
    }
  }, [data, onSave]);

  /* ---- render helpers --------------------------------------------- */

  const renderListLevel = (
    level: LevelConfig,
    listKey: "immediateCauses" | "basicCauses" | "controlDeficiencies",
  ) => {
    const items = data[listKey];

    return (
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => updateListItem(listKey, index, e.target.value)}
              placeholder={`${level.title} ekleyin...`}
              containerClassName="flex-1"
              className="h-10"
            />
            {items.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeListItem(listKey, index)}
                className="shrink-0 text-muted-foreground hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => addListItem(listKey)}
          className="self-start text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
          Ekle
        </Button>
      </div>
    );
  };

  const hasData =
    data.immediateEvent.trim().length > 0 ||
    data.immediateCauses.some((c) => c.trim().length > 0) ||
    data.basicCauses.some((c) => c.trim().length > 0) ||
    data.controlDeficiencies.some((c) => c.trim().length > 0);

  /* ---- render ----------------------------------------------------- */

  return (
    <div ref={panelRef} className="flex flex-col gap-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
              <Link className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <CardTitle>SCAT Analizi</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {incidentTitle}
              </p>
            </div>
            <Badge variant="warning">4 Seviye</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* 4 Levels */}
      <div className="flex flex-col gap-0 lg:flex-row lg:items-start lg:gap-0">
        {LEVELS.map((level, levelIndex) => {
          const isListLevel = level.isList && level.key !== "immediateEvent";
          const listKey = level.key as
            | "immediateCauses"
            | "basicCauses"
            | "controlDeficiencies";

          return (
            <div key={level.key} className="contents">
              {/* Level card */}
              <Card
                className={`flex-1 overflow-hidden border-t-4 hover:translate-y-0 ${level.borderColor}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 shrink-0 rounded-full ${level.circleColor}`}
                    />
                    <div className="flex-1">
                      <CardTitle className="text-base">{level.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {level.subtitle}
                      </p>
                    </div>
                    {isListLevel && (
                      <Badge variant={level.badgeVariant} className="text-[10px]">
                        {data[listKey].filter((s) => s.trim()).length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {level.key === "immediateEvent" ? (
                    <Input
                      value={data.immediateEvent}
                      onChange={(e) => updateImmediateEvent(e.target.value)}
                      placeholder="Anlik olayi tanimlayin..."
                      className="h-10"
                    />
                  ) : (
                    renderListLevel(level, listKey)
                  )}
                </CardContent>
              </Card>

              {/* Arrow connector between levels (not after last) */}
              {levelIndex < LEVELS.length - 1 && (
                <div className="flex shrink-0 items-center justify-center py-2 lg:px-1 lg:py-0 lg:pt-14">
                  <ChevronRight className="h-5 w-5 rotate-90 text-muted-foreground lg:rotate-0" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Error */}
      {aiError && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {aiError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {/* AI button */}
        <Button
          variant="accent"
          size="md"
          onClick={handleAiRequest}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {aiLoading ? "AI analiz ediyor..." : "AI ile Analiz Et"}
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Eski "PDF" (DOM screenshot) butonu kaldırıldı — yukarıdaki global PDF Aksiyon Bar kullanılıyor. */}

        {/* Save */}
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saveLoading || !hasData}
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
