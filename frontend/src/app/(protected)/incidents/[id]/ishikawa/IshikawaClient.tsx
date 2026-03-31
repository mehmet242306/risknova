"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { IshikawaDiagram } from "@/components/incidents/IshikawaDiagram";
import {
  fetchIshikawa,
  createIshikawa,
  updateIshikawa,
  fetchIncidentById,
  type IshikawaRecord,
  type IncidentRecord,
} from "@/lib/supabase/incident-api";
import { ArrowLeft, Plus, Trash2, Save, GitBranch, Download, FileText } from "lucide-react";

type CategoryKey = "man" | "machine" | "method" | "material" | "environment" | "measurement";

const ishikawaCategories: { key: CategoryKey; label: string; color: string; desc: string }[] = [
  { key: "man", label: "İnsan", color: "#B8860B", desc: "Eğitim eksikliği, dikkatsizlik, yorgunluk, deneyimsizlik..." },
  { key: "machine", label: "Makine", color: "#38BDF8", desc: "Arızalı ekipman, bakım eksikliği, koruyucu eksikliği..." },
  { key: "method", label: "Yöntem", color: "#F59E0B", desc: "Prosedür eksikliği, yanlış iş talimatı, yetersiz planlama..." },
  { key: "material", label: "Malzeme", color: "#D4A017", desc: "Kalitesiz malzeme, yanlış depolama, tehlikeli kimyasal..." },
  { key: "environment", label: "Çevre", color: "#10B981", desc: "Yetersiz aydınlatma, gürültü, sıcaklık, zemin koşulları..." },
  { key: "measurement", label: "Ölçüm", color: "#A855F7", desc: "Kalibrasyon hatası, yanlış ölçüm, denetim eksikliği..." },
];

export function IshikawaClient() {
  const params = useParams();
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
    } else {
      const created = await createIshikawa(incidentId, incident.organizationId, data);
      if (created) setIshikawa(created);
    }
    setSaving(false);
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
        ctx.fillStyle = "#ffffff";
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

  return (
    <div className="page-stack">
      <PageHeader
        title="İshikawa (Balıkkılçığı) Diyagramı"
        description="6M kök neden analizi - görsel diyagram"
        meta={
          <Link href={`/incidents/${incidentId}`} className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline size-4" /> Olay Detayına Dön
          </Link>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportSVGasPDF}>
              <Download className="mr-1 size-4" /> PNG İndir
            </Button>
          </div>
        }
      />

      {/* Görsel Diyagram */}
      <div ref={diagramRef}>
        <IshikawaDiagram data={diagramData} id="ishikawa-diagram" />
      </div>

      {/* Problem Tanımı */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-5 text-[var(--gold)]" />
            Problem Tanımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)}
            placeholder="Analiz edilen problemi tanımlayın..." />
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

      {/* Kök Neden Sonucu */}
      <Card>
        <CardHeader>
          <CardTitle>Kök Neden Sonucu</CardTitle>
          <CardDescription>{totalCauses} neden belirlendi</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={rootCauseConclusion} onChange={(e) => setRootCauseConclusion(e.target.value)}
            placeholder="Tüm analiz sonucunda belirlenen kök neden(ler)..." />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="mr-2 size-4" />
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}
