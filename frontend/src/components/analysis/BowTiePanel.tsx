"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import {
  Target,
  Sparkles,
  Plus,
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ZoomableContainer } from "@/components/ui/zoomable-container";
import { exportPanelPdf } from "@/lib/export-panel-pdf";
import type { BowTieData } from "@/lib/analysis/types";
import { renderBowTieSvg } from "@/lib/bowtie-pdf-template";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface BowTiePanelProps {
  incidentTitle: string;
  initialData?: BowTieData | null;
  onSave: (data: BowTieData) => void;
  onAiRequest: () => Promise<BowTieData>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SVG_W = 1200;
const SVG_H = 500;
const CENTER_X = SVG_W / 2;
const CENTER_Y = SVG_H / 2;
const TOP_EVENT_W = 160;
const TOP_EVENT_H = 50;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `bt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultData(): BowTieData {
  return {
    hazard: "",
    topEvent: "",
    threats: [],
    consequences: [],
    preventiveBarriers: [],
    mitigatingBarriers: [],
  };
}

function wrapText(text: string, maxChars = 18): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + (cur ? " " : "") + w).length <= maxChars) {
      cur = cur ? cur + " " + w : w;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

/* ------------------------------------------------------------------ */
/*  SVG Diagram renderer                                               */
/* ------------------------------------------------------------------ */

function BowTieSvg({ data }: { data: BowTieData }) {
  const threats = data.threats;
  const consequences = data.consequences;
  const preventive = data.preventiveBarriers;
  const mitigating = data.mitigatingBarriers;

  // Compute dynamic height
  const maxItems = Math.max(threats.length, consequences.length, 3);
  const dynamicH = Math.max(SVG_H, maxItems * 90 + 120);

  // Threat positions (left side)
  const threatPositions = threats.map((_, i) => ({
    x: 100,
    y: 60 + (i * (dynamicH - 120)) / Math.max(threats.length, 1),
  }));

  // Consequence positions (right side)
  const consequencePositions = consequences.map((_, i) => ({
    x: SVG_W - 100,
    y: 60 + (i * (dynamicH - 120)) / Math.max(consequences.length, 1),
  }));

  const cY = dynamicH / 2;

  // Barrier X positions
  const preventBarrierX = CENTER_X - 140;
  const mitigateBarrierX = CENTER_X + 140;

  return (
    <div className="w-full overflow-x-auto rounded-2xl bg-[#0d1220]">
      <svg
        viewBox={`0 0 ${SVG_W} ${dynamicH}`}
        className="w-full"
        style={{ minWidth: 800, display: "block" }}
      >
        {/* Background */}
        <rect width={SVG_W} height={dynamicH} fill="#0d1220" />

        {/* Grid lines */}
        {Array.from({ length: Math.floor(SVG_W / 60) + 1 }, (_, i) => (
          <line
            key={`g-${i}`}
            x1={i * 60}
            y1={0}
            x2={i * 60}
            y2={dynamicH}
            stroke="#12182e"
            strokeWidth={1}
          />
        ))}

        {/* Center: Top Event Box */}
        <rect
          x={CENTER_X - TOP_EVENT_W / 2}
          y={cY - TOP_EVENT_H / 2}
          width={TOP_EVENT_W}
          height={TOP_EVENT_H}
          rx={6}
          fill="#d4a017"
        />
        {wrapText(data.topEvent || "Ust Olay", 18).map((line, i) => (
          <text
            key={`te-${i}`}
            x={CENTER_X}
            y={cY - 4 + i * 14}
            textAnchor="middle"
            fill="#0a0e1a"
            fontSize={11}
            fontWeight={700}
            fontFamily="monospace"
          >
            {line}
          </text>
        ))}

        {/* Hazard label above center */}
        {data.hazard && (
          <>
            <rect
              x={CENTER_X - 70}
              y={cY - TOP_EVENT_H / 2 - 36}
              width={140}
              height={24}
              rx={4}
              fill="#e05a5a"
              fillOpacity={0.15}
              stroke="#e05a5a"
              strokeWidth={0.8}
            />
            <text
              x={CENTER_X}
              y={cY - TOP_EVENT_H / 2 - 20}
              textAnchor="middle"
              fill="#e05a5a"
              fontSize={9}
              fontWeight={600}
              fontFamily="monospace"
            >
              {data.hazard.slice(0, 22)}
            </text>
          </>
        )}

        {/* ---- LEFT SIDE: Threats ---- */}
        {threats.map((threat, i) => {
          const pos = threatPositions[i];
          if (!pos) return null;
          const boxW = 130;
          const causesLines = threat.causes.length;
          const boxH = Math.max(36, 24 + causesLines * 14);

          return (
            <g key={`threat-${threat.id}`}>
              {/* Connection line to center */}
              <line
                x1={pos.x + boxW / 2}
                y1={pos.y + boxH / 2}
                x2={CENTER_X - TOP_EVENT_W / 2}
                y2={cY}
                stroke="#e05a5a"
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />

              {/* Threat box */}
              <rect
                x={pos.x - boxW / 2}
                y={pos.y}
                width={boxW}
                height={boxH}
                rx={5}
                fill="#e05a5a"
                fillOpacity={0.12}
                stroke="#e05a5a"
                strokeWidth={1}
              />
              <text
                x={pos.x}
                y={pos.y + 16}
                textAnchor="middle"
                fill="#e05a5a"
                fontSize={10}
                fontWeight={700}
                fontFamily="monospace"
              >
                {threat.label.slice(0, 18)}
              </text>

              {/* Causes */}
              {threat.causes.map((cause, ci) => (
                <text
                  key={ci}
                  x={pos.x}
                  y={pos.y + 30 + ci * 13}
                  textAnchor="middle"
                  fill="#8a9cc0"
                  fontSize={8}
                  fontFamily="monospace"
                >
                  - {cause.slice(0, 20)}
                </text>
              ))}
            </g>
          );
        })}

        {/* ---- Preventive Barriers ---- */}
        {preventive.map((barrier, i) => {
          // Find which threat it links to
          const threatIdx = threats.findIndex((t) => t.id === barrier.threatId);
          const threatPos = threatPositions[threatIdx];
          const bY = threatPos
            ? (threatPos.y + 18 + cY) / 2
            : cY - 60 + i * 30;
          const color = barrier.working ? "#5ae0a0" : "#e05a5a";

          return (
            <g key={`pb-${barrier.id}`}>
              <rect
                x={preventBarrierX - 50}
                y={bY - 10}
                width={100}
                height={22}
                rx={4}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={1}
                strokeDasharray={barrier.working ? "0" : "4 2"}
              />
              <text
                x={preventBarrierX}
                y={bY + 4}
                textAnchor="middle"
                fill={color}
                fontSize={8}
                fontWeight={600}
                fontFamily="monospace"
              >
                {barrier.label.slice(0, 14)}
              </text>
            </g>
          );
        })}

        {/* ---- RIGHT SIDE: Consequences ---- */}
        {consequences.map((cons, i) => {
          const pos = consequencePositions[i];
          if (!pos) return null;
          const boxW = 130;
          const effectsLines = cons.effects.length;
          const boxH = Math.max(36, 24 + effectsLines * 14);

          return (
            <g key={`cons-${cons.id}`}>
              {/* Connection line from center */}
              <line
                x1={CENTER_X + TOP_EVENT_W / 2}
                y1={cY}
                x2={pos.x - boxW / 2}
                y2={pos.y + boxH / 2}
                stroke="#5a9ee0"
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />

              {/* Consequence box */}
              <rect
                x={pos.x - boxW / 2}
                y={pos.y}
                width={boxW}
                height={boxH}
                rx={5}
                fill="#5a9ee0"
                fillOpacity={0.12}
                stroke="#5a9ee0"
                strokeWidth={1}
              />
              <text
                x={pos.x}
                y={pos.y + 16}
                textAnchor="middle"
                fill="#5a9ee0"
                fontSize={10}
                fontWeight={700}
                fontFamily="monospace"
              >
                {cons.label.slice(0, 18)}
              </text>

              {/* Effects */}
              {cons.effects.map((effect, ei) => (
                <text
                  key={ei}
                  x={pos.x}
                  y={pos.y + 30 + ei * 13}
                  textAnchor="middle"
                  fill="#8a9cc0"
                  fontSize={8}
                  fontFamily="monospace"
                >
                  - {effect.slice(0, 20)}
                </text>
              ))}
            </g>
          );
        })}

        {/* ---- Mitigating Barriers ---- */}
        {mitigating.map((barrier, i) => {
          const consIdx = consequences.findIndex(
            (c) => c.id === barrier.consequenceId,
          );
          const consPos = consequencePositions[consIdx];
          const bY = consPos
            ? (consPos.y + 18 + cY) / 2
            : cY - 60 + i * 30;
          const color = barrier.working ? "#5ae0a0" : "#e05a5a";

          return (
            <g key={`mb-${barrier.id}`}>
              <rect
                x={mitigateBarrierX - 50}
                y={bY - 10}
                width={100}
                height={22}
                rx={4}
                fill={color}
                fillOpacity={0.15}
                stroke={color}
                strokeWidth={1}
                strokeDasharray={barrier.working ? "0" : "4 2"}
              />
              <text
                x={mitigateBarrierX}
                y={bY + 4}
                textAnchor="middle"
                fill={color}
                fontSize={8}
                fontWeight={600}
                fontFamily="monospace"
              >
                {barrier.label.slice(0, 14)}
              </text>
            </g>
          );
        })}

        {/* Side labels */}
        <text
          x={100}
          y={30}
          textAnchor="middle"
          fill="#e05a5a"
          fontSize={12}
          fontWeight={700}
          fontFamily="monospace"
        >
          TEHDITLER
        </text>
        <text
          x={SVG_W - 100}
          y={30}
          textAnchor="middle"
          fill="#5a9ee0"
          fontSize={12}
          fontWeight={700}
          fontFamily="monospace"
        >
          SONUCLAR
        </text>
        <text
          x={preventBarrierX}
          y={30}
          textAnchor="middle"
          fill="#5ae0a0"
          fontSize={10}
          fontWeight={600}
          fontFamily="monospace"
        >
          Onleyici Bariyerler
        </text>
        <text
          x={mitigateBarrierX}
          y={30}
          textAnchor="middle"
          fill="#5ae0a0"
          fontSize={10}
          fontWeight={600}
          fontFamily="monospace"
        >
          Azaltici Bariyerler
        </text>

        {/* Empty state */}
        {threats.length === 0 && consequences.length === 0 && (
          <text
            x={SVG_W / 2}
            y={dynamicH - 40}
            textAnchor="middle"
            fill="#4a5578"
            fontSize={13}
            fontFamily="monospace"
          >
            Tehdit ve sonuc ekleyerek Bow-Tie diyagramini olusturun
          </text>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BowTiePanel({
  incidentTitle,
  initialData,
  onSave,
  onAiRequest,
}: BowTiePanelProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BowTieData>(
    initialData ?? defaultData(),
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  /* ---- updaters --------------------------------------------------- */

  const updateField = useCallback(
    <K extends keyof BowTieData>(field: K, value: BowTieData[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /* ---- Threats ---------------------------------------------------- */

  const addThreat = useCallback(() => {
    setData((prev) => ({
      ...prev,
      threats: [
        ...prev.threats,
        { id: makeId(), label: "", causes: [] },
      ],
    }));
  }, []);

  const removeThreat = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      threats: prev.threats.filter((t) => t.id !== id),
      preventiveBarriers: prev.preventiveBarriers.filter(
        (b) => b.threatId !== id,
      ),
    }));
  }, []);

  const updateThreatLabel = useCallback((id: string, label: string) => {
    setData((prev) => ({
      ...prev,
      threats: prev.threats.map((t) =>
        t.id === id ? { ...t, label } : t,
      ),
    }));
  }, []);

  const addThreatCause = useCallback((threatId: string) => {
    setData((prev) => ({
      ...prev,
      threats: prev.threats.map((t) =>
        t.id === threatId ? { ...t, causes: [...t.causes, ""] } : t,
      ),
    }));
  }, []);

  const updateThreatCause = useCallback(
    (threatId: string, causeIdx: number, value: string) => {
      setData((prev) => ({
        ...prev,
        threats: prev.threats.map((t) => {
          if (t.id !== threatId) return t;
          const causes = [...t.causes];
          causes[causeIdx] = value;
          return { ...t, causes };
        }),
      }));
    },
    [],
  );

  const removeThreatCause = useCallback(
    (threatId: string, causeIdx: number) => {
      setData((prev) => ({
        ...prev,
        threats: prev.threats.map((t) => {
          if (t.id !== threatId) return t;
          return { ...t, causes: t.causes.filter((_, i) => i !== causeIdx) };
        }),
      }));
    },
    [],
  );

  /* ---- Consequences ----------------------------------------------- */

  const addConsequence = useCallback(() => {
    setData((prev) => ({
      ...prev,
      consequences: [
        ...prev.consequences,
        { id: makeId(), label: "", effects: [] },
      ],
    }));
  }, []);

  const removeConsequence = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      consequences: prev.consequences.filter((c) => c.id !== id),
      mitigatingBarriers: prev.mitigatingBarriers.filter(
        (b) => b.consequenceId !== id,
      ),
    }));
  }, []);

  const updateConsequenceLabel = useCallback((id: string, label: string) => {
    setData((prev) => ({
      ...prev,
      consequences: prev.consequences.map((c) =>
        c.id === id ? { ...c, label } : c,
      ),
    }));
  }, []);

  const addConsequenceEffect = useCallback((consId: string) => {
    setData((prev) => ({
      ...prev,
      consequences: prev.consequences.map((c) =>
        c.id === consId ? { ...c, effects: [...c.effects, ""] } : c,
      ),
    }));
  }, []);

  const updateConsequenceEffect = useCallback(
    (consId: string, effectIdx: number, value: string) => {
      setData((prev) => ({
        ...prev,
        consequences: prev.consequences.map((c) => {
          if (c.id !== consId) return c;
          const effects = [...c.effects];
          effects[effectIdx] = value;
          return { ...c, effects };
        }),
      }));
    },
    [],
  );

  const removeConsequenceEffect = useCallback(
    (consId: string, effectIdx: number) => {
      setData((prev) => ({
        ...prev,
        consequences: prev.consequences.map((c) => {
          if (c.id !== consId) return c;
          return { ...c, effects: c.effects.filter((_, i) => i !== effectIdx) };
        }),
      }));
    },
    [],
  );

  /* ---- Preventive Barriers ---------------------------------------- */

  const addPreventiveBarrier = useCallback(() => {
    setData((prev) => ({
      ...prev,
      preventiveBarriers: [
        ...prev.preventiveBarriers,
        {
          id: makeId(),
          label: "",
          threatId: prev.threats[0]?.id ?? "",
          working: true,
        },
      ],
    }));
  }, []);

  const removePreventiveBarrier = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      preventiveBarriers: prev.preventiveBarriers.filter((b) => b.id !== id),
    }));
  }, []);

  const updatePreventiveBarrier = useCallback(
    (
      id: string,
      field: "label" | "threatId" | "working",
      value: string | boolean,
    ) => {
      setData((prev) => ({
        ...prev,
        preventiveBarriers: prev.preventiveBarriers.map((b) =>
          b.id === id ? { ...b, [field]: value } : b,
        ),
      }));
    },
    [],
  );

  /* ---- Mitigating Barriers ---------------------------------------- */

  const addMitigatingBarrier = useCallback(() => {
    setData((prev) => ({
      ...prev,
      mitigatingBarriers: [
        ...prev.mitigatingBarriers,
        {
          id: makeId(),
          label: "",
          consequenceId: prev.consequences[0]?.id ?? "",
          working: true,
        },
      ],
    }));
  }, []);

  const removeMitigatingBarrier = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      mitigatingBarriers: prev.mitigatingBarriers.filter((b) => b.id !== id),
    }));
  }, []);

  const updateMitigatingBarrier = useCallback(
    (
      id: string,
      field: "label" | "consequenceId" | "working",
      value: string | boolean,
    ) => {
      setData((prev) => ({
        ...prev,
        mitigatingBarriers: prev.mitigatingBarriers.map((b) =>
          b.id === id ? { ...b, [field]: value } : b,
        ),
      }));
    },
    [],
  );

  /* ---- AI --------------------------------------------------------- */

  const handleAiRequest = useCallback(async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const result = await onAiRequest();
      setData(result);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "AI istegi basarisiz oldu",
      );
    } finally {
      setAiLoading(false);
    }
  }, [onAiRequest]);

  /* ---- save ------------------------------------------------------- */

  const handleSave = useCallback(async () => {
    setSaveLoading(true);
    try {
      await onSave(data);
    } finally {
      setSaveLoading(false);
    }
  }, [data, onSave]);

  /* ---- stats ------------------------------------------------------ */

  const totalItems = useMemo(
    () =>
      data.threats.length +
      data.consequences.length +
      data.preventiveBarriers.length +
      data.mitigatingBarriers.length,
    [data],
  );

  /* ---- render ----------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
              <Target className="h-5 w-5 text-cyan-500" />
            </div>
            <div className="flex-1">
              <CardTitle>Bow-Tie / Kelebek Analizi</CardTitle>
              <CardDescription className="mt-1">
                {incidentTitle}
              </CardDescription>
            </div>
            <Badge variant="default">{totalItems} oge</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Hazard + Top Event inputs */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row">
          <div className="flex-1">
            <Input
              label="Tehlike (Hazard)"
              value={data.hazard}
              onChange={(e) => updateField("hazard", e.target.value)}
              placeholder="Ornegin: Yuksekten dusme riski"
            />
          </div>
          <div className="flex-1">
            <Input
              label="Ust Olay (Top Event)"
              value={data.topEvent}
              onChange={(e) => updateField("topEvent", e.target.value)}
              placeholder="Ornegin: Iskele coktu"
            />
          </div>
        </CardContent>
      </Card>

      {/* SVG Diagram — PDF ile AYNI kaynak (renderBowTieSvg → DRY tutarlılık) */}
      <div className="rounded-2xl border border-border bg-white p-4 dark:bg-zinc-50">
        <div
          ref={diagramRef}
          dangerouslySetInnerHTML={{
            __html: renderBowTieSvg({ ...data, problemStatement: incidentTitle }),
          }}
        />
      </div>

      {/* ---- THREATS Section ---- */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-red-600 dark:text-red-400">
              Tehditler
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addThreat}>
              <Plus className="h-3.5 w-3.5" />
              Tehdit Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {data.threats.map((threat) => (
              <div
                key={threat.id}
                className="rounded-xl border border-red-500/20 bg-red-500/5 p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={threat.label}
                    onChange={(e) =>
                      updateThreatLabel(threat.id, e.target.value)
                    }
                    placeholder="Tehdit adi"
                    className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors focus-visible:border-primary"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeThreat(threat.id)}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Causes */}
                <div className="ml-4 flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Nedenler:
                  </span>
                  {threat.causes.map((cause, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={cause}
                        onChange={(e) =>
                          updateThreatCause(threat.id, ci, e.target.value)
                        }
                        placeholder="Neden"
                        className="h-8 flex-1 rounded-lg border border-border bg-card px-3 text-xs text-foreground transition-colors focus-visible:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeThreatCause(threat.id, ci)}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addThreatCause(threat.id)}
                    className="self-start text-xs text-primary hover:underline"
                  >
                    + Neden Ekle
                  </button>
                </div>
              </div>
            ))}

            {data.threats.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Henuz tehdit eklenmedi.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- CONSEQUENCES Section ---- */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-blue-600 dark:text-blue-400">
              Sonuclar
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addConsequence}>
              <Plus className="h-3.5 w-3.5" />
              Sonuc Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {data.consequences.map((cons) => (
              <div
                key={cons.id}
                className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={cons.label}
                    onChange={(e) =>
                      updateConsequenceLabel(cons.id, e.target.value)
                    }
                    placeholder="Sonuc adi"
                    className="h-9 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors focus-visible:border-primary"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeConsequence(cons.id)}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Effects */}
                <div className="ml-4 flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Etkiler:
                  </span>
                  {cons.effects.map((effect, ei) => (
                    <div key={ei} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={effect}
                        onChange={(e) =>
                          updateConsequenceEffect(cons.id, ei, e.target.value)
                        }
                        placeholder="Etki"
                        className="h-8 flex-1 rounded-lg border border-border bg-card px-3 text-xs text-foreground transition-colors focus-visible:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeConsequenceEffect(cons.id, ei)}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addConsequenceEffect(cons.id)}
                    className="self-start text-xs text-primary hover:underline"
                  >
                    + Etki Ekle
                  </button>
                </div>
              </div>
            ))}

            {data.consequences.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Henuz sonuc eklenmedi.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- PREVENTIVE Barriers ---- */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-base text-emerald-600 dark:text-emerald-400">
                Onleyici Bariyerler
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addPreventiveBarrier}
              disabled={data.threats.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              Bariyer Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {data.preventiveBarriers.map((barrier) => (
              <div
                key={barrier.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3"
              >
                <input
                  type="text"
                  value={barrier.label}
                  onChange={(e) =>
                    updatePreventiveBarrier(barrier.id, "label", e.target.value)
                  }
                  placeholder="Bariyer adi"
                  className="h-9 min-w-[180px] flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors focus-visible:border-primary"
                />

                <select
                  value={barrier.threatId}
                  onChange={(e) =>
                    updatePreventiveBarrier(
                      barrier.id,
                      "threatId",
                      e.target.value,
                    )
                  }
                  className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors"
                >
                  <option value="">-- Tehdit Sec --</option>
                  {data.threats.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label || `Tehdit ${t.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={barrier.working}
                    onChange={(e) =>
                      updatePreventiveBarrier(
                        barrier.id,
                        "working",
                        e.target.checked,
                      )
                    }
                    className="h-4 w-4 rounded accent-emerald-500"
                  />
                  <span className={barrier.working ? "text-emerald-600 dark:text-emerald-400" : "text-danger"}>
                    {barrier.working ? "Calisiyor" : "Calismadi"}
                  </span>
                </label>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removePreventiveBarrier(barrier.id)}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {data.preventiveBarriers.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {data.threats.length === 0
                  ? "Once tehdit ekleyin."
                  : "Henuz onleyici bariyer eklenmedi."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- MITIGATING Barriers ---- */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base text-amber-600 dark:text-amber-400">
                Azaltici Bariyerler
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addMitigatingBarrier}
              disabled={data.consequences.length === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              Bariyer Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {data.mitigatingBarriers.map((barrier) => (
              <div
                key={barrier.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3"
              >
                <input
                  type="text"
                  value={barrier.label}
                  onChange={(e) =>
                    updateMitigatingBarrier(barrier.id, "label", e.target.value)
                  }
                  placeholder="Bariyer adi"
                  className="h-9 min-w-[180px] flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors focus-visible:border-primary"
                />

                <select
                  value={barrier.consequenceId}
                  onChange={(e) =>
                    updateMitigatingBarrier(
                      barrier.id,
                      "consequenceId",
                      e.target.value,
                    )
                  }
                  className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground transition-colors"
                >
                  <option value="">-- Sonuc Sec --</option>
                  {data.consequences.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Sonuc ${c.id.slice(0, 6)}`}
                    </option>
                  ))}
                </select>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={barrier.working}
                    onChange={(e) =>
                      updateMitigatingBarrier(
                        barrier.id,
                        "working",
                        e.target.checked,
                      )
                    }
                    className="h-4 w-4 rounded accent-emerald-500"
                  />
                  <span className={barrier.working ? "text-emerald-600 dark:text-emerald-400" : "text-danger"}>
                    {barrier.working ? "Calisiyor" : "Calismadi"}
                  </span>
                </label>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMitigatingBarrier(barrier.id)}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {data.mitigatingBarriers.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {data.consequences.length === 0
                  ? "Once sonuc ekleyin."
                  : "Henuz azaltici bariyer eklenmedi."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Error */}
      {aiError && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {aiError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
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
          {aiLoading ? "AI dusunuyor..." : "AI ile Analiz Et"}
        </Button>

        <div className="flex-1" />

        {/* Eski "PDF" (DOM screenshot) butonu kaldırıldı.
            PDF Paylaş + İndir → wizard üstündeki sarı "PDF Aksiyon Bar"da
            (zengin DNV-Bow-Tie template ile, firma + lokasyon + hazırlayan + QR + kategori detayları). */}

        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saveLoading || !data.topEvent}
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
