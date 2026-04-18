"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import {
  Network,
  Sparkles,
  Plus,
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
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
import type { FaultTreeData, FaultTreeNode } from "@/lib/analysis/types";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface FaultTreePanelProps {
  incidentTitle: string;
  initialData?: FaultTreeData | null;
  onSave: (data: FaultTreeData) => void;
  onAiRequest: () => Promise<FaultTreeData>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NODE_COLORS: Record<FaultTreeNode["type"], string> = {
  event: "#5a9ee0",
  and_gate: "#e05a5a",
  or_gate: "#e0a05a",
  basic_event: "#5ae0a0",
};

const NODE_LABELS: Record<FaultTreeNode["type"], string> = {
  event: "Olay",
  and_gate: "VE Kapisi",
  or_gate: "VEYA Kapisi",
  basic_event: "Temel Olay",
};

const NODE_TYPES: FaultTreeNode["type"][] = [
  "event",
  "and_gate",
  "or_gate",
  "basic_event",
];

const SVG_W = 1200;
const SVG_H = 600;
const NODE_W = 140;
const NODE_H = 40;
const LEVEL_GAP_Y = 100;
const TOP_Y = 40;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultData(): FaultTreeData {
  return {
    topEvent: "",
    nodes: [],
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
/*  Layout engine — tree position computation                          */
/* ------------------------------------------------------------------ */

interface LayoutNode {
  id: string;
  label: string;
  type: FaultTreeNode["type"];
  x: number;
  y: number;
  children: string[];
  parentId: string | null;
}

function computeLayout(
  topEvent: string,
  nodes: FaultTreeNode[],
): { layoutNodes: LayoutNode[]; topBox: { x: number; y: number } } {
  const layoutNodes: LayoutNode[] = [];
  const nodeMap = new Map<string, FaultTreeNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // BFS from root nodes (parentId === null)
  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length === 0 && nodes.length > 0) {
    // fallback: treat all nodes as flat
    nodes.forEach((n, i) => {
      layoutNodes.push({
        id: n.id,
        label: n.label,
        type: n.type,
        x: 100 + i * (NODE_W + 30),
        y: TOP_Y + LEVEL_GAP_Y,
        children: n.children,
        parentId: n.parentId,
      });
    });
    return { layoutNodes, topBox: { x: SVG_W / 2, y: TOP_Y } };
  }

  // BFS levels
  const levels: FaultTreeNode[][] = [];
  let currentLevel = roots;
  const visited = new Set<string>();

  while (currentLevel.length > 0) {
    levels.push(currentLevel);
    const nextLevel: FaultTreeNode[] = [];
    for (const node of currentLevel) {
      visited.add(node.id);
      for (const childId of node.children) {
        const child = nodeMap.get(childId);
        if (child && !visited.has(child.id)) {
          nextLevel.push(child);
        }
      }
    }
    currentLevel = nextLevel;
  }

  // Position nodes level by level
  for (let li = 0; li < levels.length; li++) {
    const level = levels[li];
    const y = TOP_Y + LEVEL_GAP_Y + li * LEVEL_GAP_Y;
    const totalWidth = level.length * (NODE_W + 30) - 30;
    const startX = (SVG_W - totalWidth) / 2 + NODE_W / 2;

    for (let ni = 0; ni < level.length; ni++) {
      const node = level[ni];
      layoutNodes.push({
        id: node.id,
        label: node.label,
        type: node.type,
        x: startX + ni * (NODE_W + 30),
        y,
        children: node.children,
        parentId: node.parentId,
      });
    }
  }

  return { layoutNodes, topBox: { x: SVG_W / 2, y: TOP_Y } };
}

/* ------------------------------------------------------------------ */
/*  SVG renderers                                                      */
/* ------------------------------------------------------------------ */

function renderNodeShape(
  node: LayoutNode,
  _key: string,
): React.ReactNode {
  const color = NODE_COLORS[node.type];
  const lines = wrapText(node.label || "...", 16);
  const halfW = NODE_W / 2;
  const halfH = NODE_H / 2;

  let shape: React.ReactNode;

  switch (node.type) {
    case "event":
      shape = (
        <rect
          x={node.x - halfW}
          y={node.y - halfH}
          width={NODE_W}
          height={NODE_H}
          rx={8}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={1.5}
        />
      );
      break;
    case "and_gate":
      // Flat-bottom semicircle
      shape = (
        <path
          d={`M ${node.x - halfW} ${node.y + halfH}
              L ${node.x - halfW} ${node.y - halfH + 8}
              Q ${node.x - halfW} ${node.y - halfH} ${node.x - halfW + 8} ${node.y - halfH}
              L ${node.x + halfW - 8} ${node.y - halfH}
              Q ${node.x + halfW} ${node.y - halfH} ${node.x + halfW} ${node.y - halfH + 8}
              L ${node.x + halfW} ${node.y + halfH}
              Z`}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={1.5}
        />
      );
      break;
    case "or_gate":
      // Pointed-bottom curve
      shape = (
        <path
          d={`M ${node.x - halfW} ${node.y - halfH}
              Q ${node.x} ${node.y - halfH - 10} ${node.x + halfW} ${node.y - halfH}
              L ${node.x + halfW} ${node.y}
              Q ${node.x + halfW * 0.4} ${node.y + halfH + 8} ${node.x} ${node.y + halfH}
              Q ${node.x - halfW * 0.4} ${node.y + halfH + 8} ${node.x - halfW} ${node.y}
              Z`}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={1.5}
        />
      );
      break;
    case "basic_event":
      shape = (
        <circle
          cx={node.x}
          cy={node.y}
          r={halfH}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={1.5}
        />
      );
      break;
  }

  return (
    <g key={_key}>
      {shape}
      {lines.map((line, li) => (
        <text
          key={li}
          x={node.x}
          y={node.y - ((lines.length - 1) * 12) / 2 + li * 12 + 4}
          textAnchor="middle"
          fill="#cdd2e8"
          fontSize={10}
          fontFamily="monospace"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FaultTreePanel({
  incidentTitle,
  initialData,
  onSave,
  onAiRequest,
}: FaultTreePanelProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<FaultTreeData>(
    initialData ?? defaultData(),
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  /* ---- node CRUD -------------------------------------------------- */

  const updateTopEvent = useCallback((value: string) => {
    setData((prev) => ({ ...prev, topEvent: value }));
  }, []);

  const updateNode = useCallback(
    (id: string, field: keyof FaultTreeNode, value: string) => {
      setData((prev) => {
        const nodes = prev.nodes.map((n) => {
          if (n.id !== id) return n;
          if (field === "parentId") {
            // Remove from old parent's children
            const updated = prev.nodes.map((p) => ({
              ...p,
              children: p.children.filter((c) => c !== id),
            }));
            // Add to new parent's children
            if (value) {
              const parentIdx = updated.findIndex((p) => p.id === value);
              if (parentIdx >= 0) {
                updated[parentIdx] = {
                  ...updated[parentIdx],
                  children: [...updated[parentIdx].children, id],
                };
              }
            }
            return {
              ...updated.find((p) => p.id === id)!,
              parentId: value || null,
            };
          }
          return { ...n, [field]: value };
        });
        // Rebuild children arrays when parentId changes
        if (field === "parentId") {
          const rebuilt = nodes.map((n) => ({
            ...n,
            children: nodes
              .filter((c) => c.parentId === n.id)
              .map((c) => c.id),
          }));
          return { ...prev, nodes: rebuilt };
        }
        return { ...prev, nodes };
      });
    },
    [],
  );

  const addNode = useCallback(() => {
    const newNode: FaultTreeNode = {
      id: makeId(),
      label: "",
      type: "event",
      parentId: null,
      children: [],
    };
    setData((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
  }, []);

  const removeNode = useCallback((id: string) => {
    setData((prev) => {
      const nodes = prev.nodes
        .filter((n) => n.id !== id)
        .map((n) => ({
          ...n,
          parentId: n.parentId === id ? null : n.parentId,
          children: n.children.filter((c) => c !== id),
        }));
      return { ...prev, nodes };
    });
  }, []);

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

  /* ---- layout ----------------------------------------------------- */

  const { layoutNodes, topBox } = useMemo(
    () => computeLayout(data.topEvent, data.nodes),
    [data.topEvent, data.nodes],
  );

  const layoutMap = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    for (const ln of layoutNodes) m.set(ln.id, ln);
    return m;
  }, [layoutNodes]);

  /* compute dynamic SVG height */
  const svgHeight = useMemo(() => {
    if (layoutNodes.length === 0) return SVG_H;
    const maxY = Math.max(...layoutNodes.map((n) => n.y));
    return Math.max(SVG_H, maxY + LEVEL_GAP_Y);
  }, [layoutNodes]);

  /* ---- render ----------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <Network className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <CardTitle>Hata Agaci Analizi (FTA)</CardTitle>
              <CardDescription className="mt-1">
                {incidentTitle}
              </CardDescription>
            </div>
            <Badge variant="default">{data.nodes.length} dugum</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Top Event Input */}
      <Card>
        <CardContent className="pt-5">
          <Input
            label="Ust Olay (Top Event)"
            value={data.topEvent}
            onChange={(e) => updateTopEvent(e.target.value)}
            placeholder="Ornegin: Is kazasi meydana geldi"
          />
        </CardContent>
      </Card>

      {/* SVG Diagram */}
      <ZoomableContainer>
        <div ref={diagramRef}>
          <svg
              viewBox={`0 0 ${SVG_W} ${svgHeight}`}
              className="w-full"
              style={{ minWidth: 800, display: "block" }}
            >
              {/* Background */}
              <rect width={SVG_W} height={svgHeight} fill="#0d1220" />

              {/* Grid */}
              {Array.from({ length: Math.floor(SVG_W / 60) + 1 }, (_, i) => (
                <line
                  key={`gv-${i}`}
                  x1={i * 60}
                  y1={0}
                  x2={i * 60}
                  y2={svgHeight}
                  stroke="#12182e"
                  strokeWidth={1}
                />
              ))}

              {/* Top Event Box */}
              {data.topEvent && (
                <g>
                  <rect
                    x={topBox.x - 90}
                    y={topBox.y}
                    width={180}
                    height={44}
                    rx={6}
                    fill="#d4a017"
                  />
                  {wrapText(data.topEvent, 22).map((line, i) => (
                    <text
                      key={i}
                      x={topBox.x}
                      y={topBox.y + 18 + i * 14}
                      textAnchor="middle"
                      fill="#0a0e1a"
                      fontSize={11}
                      fontWeight={700}
                      fontFamily="monospace"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )}

              {/* Connection lines */}
              {layoutNodes.map((ln) => {
                if (!ln.parentId) {
                  // connect to top event
                  return (
                    <line
                      key={`line-top-${ln.id}`}
                      x1={topBox.x}
                      y1={topBox.y + 44}
                      x2={ln.x}
                      y2={ln.y - NODE_H / 2}
                      stroke="#3a4466"
                      strokeWidth={1.5}
                    />
                  );
                }
                const parent = layoutMap.get(ln.parentId);
                if (!parent) return null;
                return (
                  <line
                    key={`line-${ln.parentId}-${ln.id}`}
                    x1={parent.x}
                    y1={parent.y + NODE_H / 2}
                    x2={ln.x}
                    y2={ln.y - NODE_H / 2}
                    stroke="#3a4466"
                    strokeWidth={1.5}
                  />
                );
              })}

              {/* Nodes */}
              {layoutNodes.map((ln) => renderNodeShape(ln, ln.id))}

              {/* Empty state */}
              {data.nodes.length === 0 && (
                <text
                  x={SVG_W / 2}
                  y={svgHeight / 2}
                  textAnchor="middle"
                  fill="#4a5578"
                  fontSize={14}
                  fontFamily="monospace"
                >
                  Dugum ekleyerek agaci olusturun
                </text>
              )}
            </svg>
        </div>
      </ZoomableContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {NODE_TYPES.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: NODE_COLORS[type] }}
            />
            <span className="text-xs text-muted-foreground">
              {NODE_LABELS[type]}
            </span>
          </div>
        ))}
      </div>

      {/* Node Editor List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dugum Listesi</CardTitle>
          <CardDescription>
            Her dugumun etiketini, turunu ve ust dugumunu secin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {data.nodes.map((node) => (
              <div
                key={node.id}
                className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-secondary/30 p-4"
              >
                {/* Label */}
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Etiket
                  </label>
                  <input
                    type="text"
                    value={node.label}
                    onChange={(e) =>
                      updateNode(node.id, "label", e.target.value)
                    }
                    placeholder="Dugum etiketi"
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring)] transition-colors"
                  />
                </div>

                {/* Type */}
                <div className="min-w-[140px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Tur
                  </label>
                  <select
                    value={node.type}
                    onChange={(e) =>
                      updateNode(
                        node.id,
                        "type",
                        e.target.value as FaultTreeNode["type"],
                      )
                    }
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:border-primary transition-colors"
                  >
                    {NODE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {NODE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Parent */}
                <div className="min-w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Ust Dugum
                  </label>
                  <select
                    value={node.parentId ?? ""}
                    onChange={(e) =>
                      updateNode(node.id, "parentId", e.target.value)
                    }
                    className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:border-primary transition-colors"
                  >
                    <option value="">-- Kok (Top Event) --</option>
                    {data.nodes
                      .filter((n) => n.id !== node.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label || `Dugum ${n.id.slice(0, 6)}`}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeNode(node.id)}
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {data.nodes.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Henuz dugum eklenmedi. Asagidaki butonlarla baslayabilirsiniz.
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
          {aiLoading ? "AI dusunuyor..." : "AI ile Agac Olustur"}
        </Button>

        <Button variant="outline" size="md" onClick={addNode}>
          <Plus className="h-4 w-4" />
          Dugum Ekle
        </Button>

        <div className="flex-1" />

        {/* Eski "PDF" (DOM screenshot) butonu kaldırıldı — yukarıdaki global PDF Aksiyon Bar kullanılıyor. */}

        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saveLoading || (!data.topEvent && data.nodes.length === 0)}
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
