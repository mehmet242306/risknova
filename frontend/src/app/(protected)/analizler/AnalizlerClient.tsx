"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitBranch, HelpCircle, Network, Link as LinkIcon, Target, Building2,
  Bot, X, ArrowLeft, Trash2, Plus,
} from "lucide-react";
import { METHOD_META, type AnalysisMethod } from "@/lib/analysis/types";
import type {
  IshikawaAnalysisData, FiveWhyData, FaultTreeData,
  ScatData, BowTieData, MortData, RootCauseAnalysis,
} from "@/lib/analysis/types";
import {
  fetchAnalyses, createAnalysis, updateAnalysis, deleteAnalysis,
  requestAiAnalysis,
} from "@/lib/analysis/api";
import { fetchIncidents, type IncidentRecord } from "@/lib/supabase/incident-api";

// Lazy imports for panels — they're big components
import { FiveWhyPanel } from "@/components/analysis/FiveWhyPanel";
import { ScatPanel } from "@/components/analysis/ScatPanel";
import { FaultTreePanel } from "@/components/analysis/FaultTreePanel";
import { BowTiePanel } from "@/components/analysis/BowTiePanel";
import { MortPanel } from "@/components/analysis/MortPanel";

// Ishikawa uses the existing diagram
import { IshikawaDiagram } from "@/components/incidents/IshikawaDiagram";

const ICON_MAP: Record<string, typeof GitBranch> = {
  GitBranch, HelpCircle, Network, Link: LinkIcon, Target, Building2,
};

export function AnalizlerClient() {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [analyses, setAnalyses] = useState<RootCauseAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  // Secim durumu
  const [selectedMethod, setSelectedMethod] = useState<AnalysisMethod | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const [freeTitle, setFreeTitle] = useState("");

  // Aktif analiz (mevcut bir analizi goruntuleme/duzenleme)
  const [activeAnalysis, setActiveAnalysis] = useState<RootCauseAnalysis | null>(null);

  // AI durumu
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab: "new" (yeni analiz) veya "history" (gecmis)
  const [tab, setTab] = useState<"new" | "history">("new");

  useEffect(() => {
    Promise.all([fetchIncidents(), fetchAnalyses()]).then(([inc, ana]) => {
      setIncidents(inc);
      setAnalyses(ana);
      setLoading(false);
    });
  }, []);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId],
  );

  const incidentTitle = freeMode
    ? freeTitle
    : selectedIncident?.description || selectedIncident?.narrative || "";

  // Yontem secildiginde
  function handleMethodSelect(method: AnalysisMethod) {
    if (!incidentTitle.trim()) {
      setError("Once bir olay secin veya serbest konu girin.");
      return;
    }
    setError(null);
    setSelectedMethod(method);
  }

  // Analiz kaydet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleSave(method: AnalysisMethod, data: any) {
    if (activeAnalysis) {
      await updateAnalysis(activeAnalysis.id, data);
      setAnalyses((prev) => prev.map((a) => a.id === activeAnalysis.id ? { ...a, data, isEdited: true } : a));
    } else {
      const created = await createAnalysis({
        incidentId: freeMode ? null : selectedIncidentId,
        incidentTitle: incidentTitle || "Isimsiz Analiz",
        method,
        data,
        isFreeMode: freeMode,
      });
      if (created) {
        setAnalyses((prev) => [created, ...prev]);
      }
    }
    setSelectedMethod(null);
    setActiveAnalysis(null);
  }

  // Gecmis analizi ac
  function openAnalysis(analysis: RootCauseAnalysis) {
    setActiveAnalysis(analysis);
    setSelectedMethod(analysis.method);
    setTab("new");
  }

  // Analiz sil
  async function handleDelete(id: string) {
    if (!confirm("Bu analizi silmek istediginize emin misiniz?")) return;
    const ok = await deleteAnalysis(id);
    if (ok) setAnalyses((prev) => prev.filter((a) => a.id !== id));
  }

  // AI istegi wrapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleAiRequest(method: AnalysisMethod, context?: any) {
    setBusy(true);
    setError(null);
    try {
      const result = await requestAiAnalysis({
        method,
        incidentTitle: incidentTitle || "Bilinmeyen olay",
        incidentDescription: selectedIncident?.narrative ?? undefined,
        context,
      });
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analiz hatasi");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  // Geri don
  function handleBack() {
    setSelectedMethod(null);
    setActiveAnalysis(null);
    setError(null);
  }

  if (loading) {
    return (
      <div className="page-stack">
        <Skeleton className="h-12 w-64 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Yontem paneli aciksa
  if (selectedMethod) {
    return (
      <div className="page-stack">
        <PageHeader
          title={METHOD_META[selectedMethod].label}
          description={METHOD_META[selectedMethod].description}
          meta={
            <button onClick={handleBack} className="text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 inline size-4" /> Yontem Secime Don
            </button>
          }
        />
        {error && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
            {error}
          </div>
        )}
        {renderMethodPanel(selectedMethod)}
      </div>
    );
  }

  // Ana sayfa: yontem secimi + gecmis
  return (
    <div className="page-stack">
      <PageHeader
        title="Kok Neden Analizi"
        description="Bir olay kaydi secin veya serbest analiz baslatin, ardindan yonteminizi secin."
      />

      {error && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === "new" ? "primary" : "outline"} size="sm" onClick={() => setTab("new")}>
          Yeni Analiz
        </Button>
        <Button variant={tab === "history" ? "primary" : "outline"} size="sm" onClick={() => setTab("history")}>
          Gecmis ({analyses.length})
        </Button>
      </div>

      {tab === "new" && (
        <>
          {/* Olay secimi */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Olay Secimi</CardTitle>
              <CardDescription>Mevcut bir olaya bagli analiz yapin veya serbest konu girin.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-foreground">Olay Kaydi</label>
                  <select
                    value={selectedIncidentId ?? ""}
                    onChange={(e) => {
                      setSelectedIncidentId(e.target.value || null);
                      setFreeMode(false);
                      setFreeTitle("");
                    }}
                    className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
                    disabled={freeMode}
                  >
                    <option value="">Olay secin (opsiyonel)</option>
                    {incidents.map((inc) => (
                      <option key={inc.id} value={inc.id}>
                        {inc.incidentCode} — {(inc.description || inc.narrative || "").slice(0, 60)}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="pb-2 text-xs text-muted-foreground">veya</span>
                <div className="min-w-[240px] flex-1">
                  <Input
                    label="Serbest Konu"
                    value={freeTitle}
                    onChange={(e) => {
                      setFreeTitle(e.target.value);
                      setFreeMode(true);
                      setSelectedIncidentId(null);
                    }}
                    placeholder="Serbest analiz konusu girin..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Yontem kartlari */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(Object.entries(METHOD_META) as [AnalysisMethod, (typeof METHOD_META)[AnalysisMethod]][]).map(
              ([method, meta]) => {
                const Icon = ICON_MAP[meta.icon] ?? GitBranch;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => handleMethodSelect(method)}
                    disabled={busy}
                    className="group rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-[var(--shadow-card)]"
                    style={{ borderTopColor: meta.color, borderTopWidth: 3 }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted">
                          <Icon className="size-5" style={{ color: meta.color }} />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{meta.label}</div>
                          <div className="text-xs text-muted-foreground">{meta.subtitle}</div>
                        </div>
                      </div>
                      {meta.aiSupported && <Badge variant="warning">AI</Badge>}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">{meta.description}</p>
                  </button>
                );
              },
            )}
          </div>
        </>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {analyses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Henuz analiz yapilmamis. Yeni bir analiz baslatmak icin "Yeni Analiz" sekmesine gecin.
              </CardContent>
            </Card>
          ) : analyses.map((a) => {
            const meta = METHOD_META[a.method];
            return (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <button type="button" onClick={() => openAnalysis(a)} className="flex flex-1 items-center gap-3 text-left">
                  <Badge style={{ background: `${meta.color}20`, color: meta.color, borderColor: `${meta.color}40` }}>
                    {meta.label}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{a.incidentTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString("tr-TR")}
                      {a.isFreeMode && " — Serbest"}
                      {a.isEdited && " — Duzenlendi"}
                    </div>
                  </div>
                </button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="text-danger">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderMethodPanel(method: AnalysisMethod) {
    const data = activeAnalysis?.data ?? null;

    switch (method) {
      case "ishikawa":
        return (
          <IshikawaPanel
            incidentTitle={incidentTitle}
            initialData={data as IshikawaAnalysisData | null}
            onSave={(d) => handleSave("ishikawa", d)}
            onAiRequest={() => handleAiRequest("ishikawa")}
            busy={busy}
          />
        );
      case "five_why":
        return (
          <FiveWhyPanel
            incidentTitle={incidentTitle}
            initialData={data as FiveWhyData | null}
            onSave={(d) => handleSave("five_why", d)}
            onAiRequest={(ctx) => handleAiRequest("five_why", ctx)}
          />
        );
      case "fault_tree":
        return (
          <FaultTreePanel
            incidentTitle={incidentTitle}
            initialData={data as FaultTreeData | null}
            onSave={(d) => handleSave("fault_tree", d)}
            onAiRequest={() => handleAiRequest("fault_tree")}
          />
        );
      case "scat":
        return (
          <ScatPanel
            incidentTitle={incidentTitle}
            initialData={data as ScatData | null}
            onSave={(d) => handleSave("scat", d)}
            onAiRequest={() => handleAiRequest("scat")}
          />
        );
      case "bow_tie":
        return (
          <BowTiePanel
            incidentTitle={incidentTitle}
            initialData={data as BowTieData | null}
            onSave={(d) => handleSave("bow_tie", d)}
            onAiRequest={() => handleAiRequest("bow_tie")}
          />
        );
      case "mort":
        return (
          <MortPanel
            incidentTitle={incidentTitle}
            initialData={data as MortData | null}
            onSave={(d) => handleSave("mort", d)}
            onAiRequest={() => handleAiRequest("mort")}
          />
        );
    }
  }

}

/* ------------------------------------------------------------------ */
/*  Ishikawa Panel — ayri component (hooks icin)                       */
/* ------------------------------------------------------------------ */

const CAT_LABELS: Record<string, string> = {
  insan: "Insan", makine: "Makine", yontem: "Yontem",
  malzeme: "Malzeme", cevre: "Cevre", yonetim: "Yonetim",
};

function IshikawaPanel({
  incidentTitle, initialData, onSave, onAiRequest, busy,
}: {
  incidentTitle: string;
  initialData: IshikawaAnalysisData | null;
  onSave: (data: IshikawaAnalysisData) => void;
  onAiRequest: () => Promise<IshikawaAnalysisData>;
  busy: boolean;
}) {
  const [data, setData] = useState<IshikawaAnalysisData>(
    initialData ?? { insan: [], makine: [], yontem: [], malzeme: [], cevre: [], yonetim: [] },
  );

  const diagramData = {
    problemStatement: incidentTitle,
    manCauses: data.insan,
    machineCauses: data.makine,
    methodCauses: data.yontem,
    materialCauses: data.malzeme,
    environmentCauses: data.cevre,
    measurementCauses: data.yonetim,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="accent" size="sm" disabled={busy}
          onClick={async () => { try { setData(await onAiRequest()); } catch { /* error shown above */ } }}>
          <Bot className="mr-1 size-4" /> {busy ? "Analiz ediliyor..." : "AI ile Analiz Et"}
        </Button>
      </div>
      <IshikawaDiagram data={diagramData} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(["insan", "makine", "yontem", "malzeme", "cevre", "yonetim"] as const).map((cat) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{CAT_LABELS[cat]}</CardTitle>
                <button type="button" onClick={() => setData((p) => ({ ...p, [cat]: [...p[cat], ""] }))}
                  className="inline-flex size-6 items-center justify-center rounded bg-muted text-muted-foreground hover:text-foreground">
                  <Plus className="size-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data[cat].map((cause, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input value={cause}
                    onChange={(e) => { const next = [...data[cat]]; next[i] = e.target.value; setData((p) => ({ ...p, [cat]: next })); }}
                    className="h-7 flex-1 rounded border border-border bg-input px-2 text-xs text-foreground"
                    placeholder={`${CAT_LABELS[cat]} nedeni...`} />
                  <button type="button" onClick={() => setData((p) => ({ ...p, [cat]: p[cat].filter((_, j) => j !== i) }))}
                    className="text-muted-foreground hover:text-danger">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => onSave(data)}>Kaydet</Button>
      </div>
    </div>
  );
}
