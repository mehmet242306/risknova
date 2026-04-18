"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { IshikawaDiagram } from "@/components/incidents/IshikawaDiagram";
import { IshikawaCompare } from "@/components/incidents/IshikawaCompare";
import {
  fetchIshikawa,
  createIshikawa,
  updateIshikawa,
  deleteIshikawa,
  fetchIshikawaVersions,
  toggleIshikawaShare,
  fetchAllIshikawaByOrg,
  fetchIncidentById,
  type IshikawaRecord,
  type IshikawaVersion,
  type IncidentRecord,
} from "@/lib/supabase/incident-api";
import {
  ArrowLeft, Plus, Trash2, Save, GitBranch, Download,
  Share2, History, Scale, RotateCcw,
} from "lucide-react";

type CategoryKey = "man" | "machine" | "method" | "material" | "environment" | "measurement";

const ishikawaCategories: { key: CategoryKey; label: string; color: string; desc: string }[] = [
  { key: "man", label: "Insan", color: "#B8860B", desc: "Egitim eksikligi, dikkatsizlik, yorgunluk, deneyimsizlik..." },
  { key: "machine", label: "Makine", color: "#38BDF8", desc: "Arizali ekipman, bakim eksikligi, koruyucu eksikligi..." },
  { key: "method", label: "Yontem", color: "#F59E0B", desc: "Prosedur eksikligi, yanlis is talimati, yetersiz planlama..." },
  { key: "material", label: "Malzeme", color: "#D4A017", desc: "Kalitesiz malzeme, yanlis depolama, tehlikeli kimyasal..." },
  { key: "environment", label: "Cevre", color: "#10B981", desc: "Yetersiz aydinlatma, gurultu, sicaklik, zemin kosullari..." },
  { key: "measurement", label: "Olcum", color: "#A855F7", desc: "Kalibrasyon hatasi, yanlis olcum, denetim eksikligi..." },
];

export function IshikawaClient() {
  const params = useParams();
  const router = useRouter();
  const incidentId = params.id as string;
  const diagramRef = useRef<HTMLDivElement>(null);

  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [ishikawa, setIshikawa] = useState<IshikawaRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [problemStatement, setProblemStatement] = useState("");
  const [causes, setCauses] = useState<Record<CategoryKey, string[]>>({
    man: [], machine: [], method: [], material: [], environment: [], measurement: [],
  });
  const [rootCauseConclusion, setRootCauseConclusion] = useState("");

  // Versiyon gecmisi
  const [versions, setVersions] = useState<IshikawaVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  // Karsilastirma
  const [compareMode, setCompareMode] = useState(false);
  const [allAnalyses, setAllAnalyses] = useState<(IshikawaRecord & { incidentCode?: string; incidentTitle?: string })[]>([]);
  const [compareTarget, setCompareTarget] = useState<(IshikawaRecord & { incidentCode?: string; incidentTitle?: string }) | null>(null);

  useEffect(() => {
    if (!incidentId) return;
    Promise.all([fetchIncidentById(incidentId), fetchIshikawa(incidentId)]).then(([inc, ish]) => {
      setIncident(inc);
      if (ish) {
        setIshikawa(ish);
        setProblemStatement(ish.problemStatement ?? "");
        setCauses({
          man: ish.manCauses ?? [],
          machine: ish.machineCauses ?? [],
          method: ish.methodCauses ?? [],
          material: ish.materialCauses ?? [],
          environment: ish.environmentCauses ?? [],
          measurement: ish.measurementCauses ?? [],
        });
        setRootCauseConclusion(ish.rootCauseConclusion ?? "");
      } else if (inc?.description) {
        setProblemStatement(inc.description);
      }
      setLoading(false);
    });
  }, [incidentId]);

  function addCause(cat: CategoryKey) {
    setCauses({ ...causes, [cat]: [...causes[cat], ""] });
  }
  function updateCause(cat: CategoryKey, idx: number, val: string) {
    const list = [...causes[cat]]; list[idx] = val; setCauses({ ...causes, [cat]: list });
  }
  function removeCause(cat: CategoryKey, idx: number) {
    setCauses({ ...causes, [cat]: causes[cat].filter((_, i) => i !== idx) });
  }

  async function handleSave() {
    if (!incident) return;
    setSaving(true);
    const data: Partial<IshikawaRecord> = {
      problemStatement,
      manCauses: causes.man.filter(Boolean),
      machineCauses: causes.machine.filter(Boolean),
      methodCauses: causes.method.filter(Boolean),
      materialCauses: causes.material.filter(Boolean),
      environmentCauses: causes.environment.filter(Boolean),
      measurementCauses: causes.measurement.filter(Boolean),
      rootCauseConclusion,
    };
    if (ishikawa) {
      await updateIshikawa(ishikawa.id, data);
      setIshikawa({ ...ishikawa, ...data });
    } else {
      const created = await createIshikawa(incidentId, incident.organizationId, data);
      if (created) setIshikawa(created);
    }
    setSaving(false);
  }

  // Silme
  async function handleDelete() {
    if (!ishikawa) return;
    if (!confirm("Bu Ishikawa analizini silmek istediginize emin misiniz? Bu islem geri alinamaz.")) return;
    const ok = await deleteIshikawa(ishikawa.id);
    if (ok) {
      router.push(`/incidents/${incidentId}`);
    }
  }

  // Paylasim toggle
  async function handleToggleShare() {
    if (!ishikawa) return;
    const newVal = !ishikawa.sharedWithCompany;
    const ok = await toggleIshikawaShare(ishikawa.id, newVal);
    if (ok) {
      setIshikawa({ ...ishikawa, sharedWithCompany: newVal });
    }
  }

  // Versiyon gecmisi yukle
  const loadVersions = useCallback(async () => {
    if (!ishikawa) return;
    const v = await fetchIshikawaVersions(ishikawa.id);
    setVersions(v);
  }, [ishikawa]);

  function handleToggleVersions() {
    const next = !showVersions;
    setShowVersions(next);
    if (next) loadVersions();
  }

  // Versiyon geri yukle
  function restoreVersion(v: IshikawaVersion) {
    setProblemStatement(v.problemStatement ?? "");
    setCauses({
      man: v.manCauses ?? [],
      machine: v.machineCauses ?? [],
      method: v.methodCauses ?? [],
      material: v.materialCauses ?? [],
      environment: v.environmentCauses ?? [],
      measurement: v.measurementCauses ?? [],
    });
    setRootCauseConclusion(v.rootCauseConclusion ?? "");
    setShowVersions(false);
  }

  // Karsilastirma modu
  async function handleCompareMode() {
    if (compareMode) {
      setCompareMode(false);
      setCompareTarget(null);
      return;
    }
    const all = await fetchAllIshikawaByOrg();
    setAllAnalyses(all.filter((a) => a.id !== ishikawa?.id));
    setCompareMode(true);
  }

  function exportSVGasPDF() {
    const svgEl = document.querySelector("#ishikawa-diagram svg") as SVGSVGElement | null;
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      if (ctx) {
        ctx.fillStyle = "#0d1220";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `ishikawa-${incident?.incidentCode || "diagram"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  if (loading) {
    return <div className="page-stack"><Skeleton className="h-12 w-64 rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;
  }

  const totalCauses = Object.values(causes).reduce((sum, arr) => sum + arr.filter(Boolean).length, 0);

  const diagramData = {
    problemStatement,
    manCauses: causes.man.filter(Boolean),
    machineCauses: causes.machine.filter(Boolean),
    methodCauses: causes.method.filter(Boolean),
    materialCauses: causes.material.filter(Boolean),
    environmentCauses: causes.environment.filter(Boolean),
    measurementCauses: causes.measurement.filter(Boolean),
  };

  // Karsilastirma gorunumu
  if (compareTarget && ishikawa) {
    return (
      <div className="page-stack">
        <PageHeader
          title="Analiz Karsilastirmasi"
          description="Iki Ishikawa analizini yan yana karsilastirin"
          meta={
            <button onClick={() => setCompareTarget(null)} className="text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 inline size-4" /> Analize Don
            </button>
          }
        />
        <IshikawaCompare
          analysisA={{ ...ishikawa, incidentCode: incident?.incidentCode, incidentTitle: incident?.description ?? undefined }}
          analysisB={compareTarget}
          onClose={() => setCompareTarget(null)}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Ishikawa (Balikkil\u00E7igi) Diyagrami"
        description="6M kok neden analizi - gorsel diyagram"
        meta={
          <Link href={`/incidents/${incidentId}`} className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline size-4" /> Olay Detayina Don
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportSVGasPDF}>
              <Download className="mr-1 size-4" /> PNG Indir
            </Button>
            {ishikawa && (
              <>
                <Button variant="outline" size="sm" onClick={handleToggleShare}>
                  <Share2 className="mr-1 size-4" />
                  {ishikawa.sharedWithCompany ? "Paylasim Kapat" : "Firmayla Paylas"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCompareMode}>
                  <Scale className="mr-1 size-4" />
                  {compareMode ? "Karsilastirmayi Kapat" : "Karsilastir"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete} className="text-danger hover:text-danger">
                  <Trash2 className="mr-1 size-4" /> Sil
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Paylasim badge */}
      {ishikawa?.sharedWithCompany && (
        <Badge variant="success">Firmayla Paylasildi</Badge>
      )}

      {/* Karsilastirma icin analiz secimi */}
      {compareMode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Karsilastirilacak Analizi Secin</CardTitle>
            <CardDescription>Asagidaki listeden bir analiz secin, mevcut analizle yan yana karsilastirilacak.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {allAnalyses.length === 0 ? (
              <p className="text-xs text-muted-foreground">Karsilastirilacak baska analiz bulunamadi.</p>
            ) : allAnalyses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setCompareTarget(a)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/30"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{a.incidentCode || "Isimsiz"}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{a.incidentTitle || a.problemStatement || "Tanim yok"}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString("tr-TR")}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Gorsel Diyagram */}
      <div ref={diagramRef}>
        <IshikawaDiagram data={diagramData} id="ishikawa-diagram" />
      </div>

      {/* Problem Tanimi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-5 text-[var(--gold)]" />
            Problem Tanimi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)}
            placeholder="Analiz edilen problemi tanimlain..." />
        </CardContent>
      </Card>

      {/* 6M Kategorileri */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ishikawaCategories.map((cat) => (
          <Card key={cat.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base" style={{ color: cat.color }}>{cat.label}</CardTitle>
                <button type="button" onClick={() => addCause(cat.key)}
                  className="inline-flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:text-foreground">
                  <Plus className="size-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{cat.desc}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {causes[cat.key].length === 0 && (
                <button type="button" onClick={() => addCause(cat.key)}
                  className="w-full rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors">
                  + Neden ekle
                </button>
              )}
              {causes[cat.key].map((cause, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="size-2 shrink-0 rounded-full" style={{ background: cat.color }} />
                  <input type="text" value={cause}
                    onChange={(e) => updateCause(cat.key, idx, e.target.value)}
                    placeholder={`${cat.label} nedeni...`}
                    className="h-8 flex-1 rounded-lg border border-border bg-input px-2 text-sm text-foreground placeholder:text-muted-foreground" />
                  <button type="button" onClick={() => removeCause(cat.key, idx)} className="text-muted-foreground hover:text-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Kok Neden Sonucu */}
      <Card>
        <CardHeader>
          <CardTitle>Kok Neden Sonucu</CardTitle>
          <CardDescription>{totalCauses} neden belirlendi</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={rootCauseConclusion} onChange={(e) => setRootCauseConclusion(e.target.value)}
            placeholder="Tum analiz sonucunda belirlenen kok neden(ler)..." />
        </CardContent>
      </Card>

      {/* Versiyon Gecmisi */}
      {ishikawa && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="size-4" />
                Versiyon Gecmisi
                {versions.length > 0 && (
                  <Badge variant="neutral">{versions.length}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleToggleVersions}>
                {showVersions ? "Gizle" : "Goster"}
              </Button>
            </div>
          </CardHeader>
          {showVersions && (
            <CardContent className="space-y-2">
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Henuz versiyon gecmisi yok. Ilk kayit sonrasi her duzenleme otomatik olarak versiyonlanir.</p>
              ) : versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="warning">v{v.versionNumber}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString("tr-TR", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => restoreVersion(v)}>
                    <RotateCcw className="mr-1 size-3.5" />
                    Geri Yukle
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="mr-2 size-4" />
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}
