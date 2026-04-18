"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitBranch, HelpCircle, Network, Link as LinkIcon, Target, Building2, Activity,
  Bot, ArrowLeft, Trash2, Plus, ShieldAlert, AlertTriangle, Stethoscope, Eye,
} from "lucide-react";
import { METHOD_META, type AnalysisMethod } from "@/lib/analysis/types";
import type {
  IshikawaAnalysisData, FiveWhyData, FaultTreeData,
  ScatData, BowTieData, MortData, R2dRcaData, RootCauseAnalysis,
} from "@/lib/analysis/types";
import {
  fetchAnalyses, createAnalysis, updateAnalysis, deleteAnalysis,
  requestAiAnalysis,
} from "@/lib/analysis/api";
import type { IncidentType } from "@/lib/supabase/incident-api";
import { loadCompanyDirectory } from "@/lib/company-directory";
import { FiveWhyPanel } from "@/components/analysis/FiveWhyPanel";
import { ScatPanel } from "@/components/analysis/ScatPanel";
import { FaultTreePanel } from "@/components/analysis/FaultTreePanel";
import { BowTiePanel } from "@/components/analysis/BowTiePanel";
import { MortPanel } from "@/components/analysis/MortPanel";
import { R2dRcaPanel } from "@/components/analysis/R2dRcaPanel";
import { IshikawaDiagram } from "@/components/incidents/IshikawaDiagram";
import { RcaIntroPanel } from "@/components/analysis/RcaIntroPanel";

const ICON_MAP: Record<string, typeof GitBranch> = {
  GitBranch, HelpCircle, Network, Link: LinkIcon, Target, Building2, Activity,
};

const INCIDENT_TYPE_OPTIONS: { value: IncidentType; label: string; icon: typeof ShieldAlert; color: string }[] = [
  { value: "work_accident", label: "İş Kazası", icon: ShieldAlert, color: "#ef4444" },
  { value: "near_miss", label: "Ramak Kala", icon: AlertTriangle, color: "#f59e0b" },
  { value: "occupational_disease", label: "Meslek Hastalığı", icon: Stethoscope, color: "#6366f1" },
  { value: "other", label: "Diğer", icon: Eye, color: "#6b7280" },
];

export function AnalizlerContent() {
  const [analyses, setAnalyses] = useState<RootCauseAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const companies = useMemo(() => loadCompanyDirectory(), []);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<IncidentType | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<AnalysisMethod | null>(null);
  const [freeTitle, setFreeTitle] = useState("");
  const [activeAnalysis, setActiveAnalysis] = useState<RootCauseAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"new" | "history">("new");

  useEffect(() => {
    fetchAnalyses().then((ana) => { setAnalyses(ana); setLoading(false); });
  }, []);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const typeLabel = INCIDENT_TYPE_OPTIONS.find((t) => t.value === selectedType)?.label ?? "";

  const incidentTitle = [
    selectedCompany?.name,
    typeLabel,
    freeTitle.trim(),
  ].filter(Boolean).join(" — ");

  function handleMethodSelect(method: AnalysisMethod) {
    setError(null);
    setSelectedMethod(method);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleSave(method: AnalysisMethod, data: any) {
    if (activeAnalysis) {
      await updateAnalysis(activeAnalysis.id, data);
      setAnalyses((prev) => prev.map((a) => a.id === activeAnalysis.id ? { ...a, data, isEdited: true } : a));
    } else {
      const created = await createAnalysis({
        incidentId: null,
        incidentTitle: incidentTitle || "İsimsiz Analiz",
        method,
        data,
        isFreeMode: true,
      });
      if (created) setAnalyses((prev) => [created, ...prev]);
    }
    setSelectedMethod(null);
    setActiveAnalysis(null);
  }

  function openAnalysis(analysis: RootCauseAnalysis) {
    setActiveAnalysis(analysis);
    setSelectedMethod(analysis.method);
    setSubTab("new");
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu analizi silmek istediginize emin misiniz?")) return;
    const ok = await deleteAnalysis(id);
    if (ok) setAnalyses((prev) => prev.filter((a) => a.id !== id));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleAiRequest(method: AnalysisMethod, context?: any) {
    setBusy(true);
    setError(null);
    try {
      return await requestAiAnalysis({
        method,
        incidentTitle: incidentTitle || "Bilinmeyen olay",
        incidentDescription: freeTitle.trim() || undefined,
        context,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analiz hatasi");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  function handleBack() {
    setSelectedMethod(null);
    setActiveAnalysis(null);
    setError(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // Yontem paneli aciksa
  if (selectedMethod) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline size-4" /> Geri
          </button>
          <h3 className="text-lg font-semibold text-foreground">{METHOD_META[selectedMethod].label}</h3>
        </div>
        {error && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
            {error}
          </div>
        )}
        {renderMethodPanel(selectedMethod)}
      </div>
    );
  }

  // Ana icerik
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant={subTab === "new" ? "primary" : "outline"} size="sm" onClick={() => setSubTab("new")}>
          Yeni Analiz
        </Button>
        <Button variant={subTab === "history" ? "primary" : "outline"} size="sm" onClick={() => setSubTab("history")}>
          Gecmis ({analyses.length})
        </Button>
      </div>

      {subTab === "new" && (
        <>
          {/* Tanıtım & rehber paneli — yöntem seçimi öncesi eğitici içerik */}
          <RcaIntroPanel />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Analiz Bilgileri</CardTitle>
              <CardDescription>Firma, olay türü ve analiz konusu belirleyin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Firma Seçimi */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Firma</label>
                <select
                  value={selectedCompanyId ?? ""}
                  onChange={(e) => setSelectedCompanyId(e.target.value || null)}
                  className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
                >
                  <option value="">Firma seçin</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Olay Türü */}
              <div>
                <label className="mb-2 block text-xs font-medium text-foreground">Olay Türü</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {INCIDENT_TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = selectedType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedType(active ? null : opt.value)}
                        className={`flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                          active
                            ? "shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                        style={active ? { borderColor: opt.color, backgroundColor: `${opt.color}12`, color: opt.color } : undefined}
                      >
                        <span className="inline-flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${opt.color}18` }}>
                          <Icon className="size-4" style={{ color: opt.color }} />
                        </span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Konu */}
              <div>
                <Input
                  label="Konu / Açıklama"
                  value={freeTitle}
                  onChange={(e) => setFreeTitle(e.target.value)}
                  placeholder="Analiz konusunu kısaca yazın..."
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(Object.entries(METHOD_META) as [AnalysisMethod, (typeof METHOD_META)[AnalysisMethod]][]).map(
              ([method, meta]) => {
                const Icon = ICON_MAP[meta.icon] ?? GitBranch;
                return (
                  <button key={method} type="button" onClick={() => handleMethodSelect(method)} disabled={busy}
                    className="group rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-[var(--shadow-card)]"
                    style={{ borderTopColor: meta.color, borderTopWidth: 3 }}>
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

      {subTab === "history" && (
        <div className="space-y-3">
          {analyses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Henuz analiz yapilmamis.
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
        return <IshikawaInlinePanel incidentTitle={incidentTitle} initialData={data as IshikawaAnalysisData | null}
          onSave={(d) => handleSave("ishikawa", d)} onAiRequest={() => handleAiRequest("ishikawa")} busy={busy} />;
      case "five_why":
        return <FiveWhyPanel incidentTitle={incidentTitle} initialData={data as FiveWhyData | null}
          onSave={(d) => handleSave("five_why", d)} onAiRequest={(ctx) => handleAiRequest("five_why", ctx)} />;
      case "fault_tree":
        return <FaultTreePanel incidentTitle={incidentTitle} initialData={data as FaultTreeData | null}
          onSave={(d) => handleSave("fault_tree", d)} onAiRequest={() => handleAiRequest("fault_tree")} />;
      case "scat":
        return <ScatPanel incidentTitle={incidentTitle} initialData={data as ScatData | null}
          onSave={(d) => handleSave("scat", d)} onAiRequest={() => handleAiRequest("scat")} />;
      case "bow_tie":
        return <BowTiePanel incidentTitle={incidentTitle} initialData={data as BowTieData | null}
          onSave={(d) => handleSave("bow_tie", d)} onAiRequest={() => handleAiRequest("bow_tie")} />;
      case "mort":
        return <MortPanel incidentTitle={incidentTitle} initialData={data as MortData | null}
          onSave={(d) => handleSave("mort", d)} onAiRequest={() => handleAiRequest("mort")} />;
      case "r2d_rca":
        return <R2dRcaPanel incidentTitle={incidentTitle} initialData={data as R2dRcaData | null}
          onSave={(d) => handleSave("r2d_rca", d)} onAiRequest={() => handleAiRequest("r2d_rca")} />;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Ishikawa inline panel                                              */
/* ------------------------------------------------------------------ */

const CAT_LABELS: Record<string, string> = {
  insan: "Insan", makine: "Makine", yontem: "Yontem",
  malzeme: "Malzeme", cevre: "Cevre", yonetim: "Yonetim",
};

function IshikawaInlinePanel({
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
    manCauses: data.insan, machineCauses: data.makine, methodCauses: data.yontem,
    materialCauses: data.malzeme, environmentCauses: data.cevre, measurementCauses: data.yonetim,
  };

  return (
    <div className="space-y-4">
      <Button variant="accent" size="sm" disabled={busy}
        onClick={async () => { try { setData(await onAiRequest()); } catch { /* */ } }}>
        <Bot className="mr-1 size-4" /> {busy ? "Analiz ediliyor..." : "AI ile Analiz Et"}
      </Button>
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
