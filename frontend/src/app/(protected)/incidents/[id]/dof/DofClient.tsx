"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchDof,
  createDof,
  updateDof,
  fetchIshikawa,
  createIshikawa,
  updateIshikawa,
  fetchIncidentById,
  type DofRecord,
  type DofStatus,
  type IshikawaRecord,
  type IncidentRecord,
} from "@/lib/supabase/incident-api";
import { ArrowLeft, Plus, Trash2, Save, ClipboardCheck, GitBranch, ImagePlus, X, AlertTriangle, Download, FileText, Sparkles } from "lucide-react";
import { exportDofAsPDF, exportDofAsWord } from "@/lib/dof-export";
import { generateAISuggestion } from "@/lib/incident-ai";

type ActionItem = { action: string; assignedTo: string; deadline: string; done: boolean };

type UploadedPhoto = {
  id: string;
  file?: File;
  previewUrl: string;
  caption: string;
};

const statusLabels: Record<DofStatus, string> = {
  open: "Açık",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  verified: "Doğrulandı",
};

type CategoryKey = "man" | "machine" | "method" | "material" | "environment" | "measurement";

const ishikawaCategories: { key: CategoryKey; label: string; color: string; desc: string }[] = [
  { key: "man", label: "İnsan", color: "#B8860B", desc: "Eğitim eksikliği, dikkatsizlik, yorgunluk, deneyimsizlik..." },
  { key: "machine", label: "Makine", color: "#D4A017", desc: "Arızalı ekipman, bakım eksikliği, koruyucu eksikliği..." },
  { key: "method", label: "Metot", color: "#F59E0B", desc: "Prosedür eksikliği, yanlış iş talimatı, yetersiz planlama..." },
  { key: "material", label: "Malzeme", color: "#FB923C", desc: "Kalitesiz malzeme, yanlış depolama, tehlikeli kimyasal..." },
  { key: "environment", label: "Çevre", color: "#10B981", desc: "Yetersiz aydınlatma, gürültü, sıcaklık, zemin koşulları..." },
  { key: "measurement", label: "Ölçüm", color: "#38BDF8", desc: "Kalibrasyon hatası, yanlış ölçüm, denetim eksikliği..." },
];

export function DofClient() {
  const params = useParams();
  const incidentId = params.id as string;

  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [dof, setDof] = useState<DofRecord | null>(null);
  const [ishikawa, setIshikawa] = useState<IshikawaRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // DÖF state
  const [rootCause, setRootCause] = useState("");
  const [rootCauseAnalysis, setRootCauseAnalysis] = useState("");
  const [correctiveActions, setCorrectiveActions] = useState<ActionItem[]>([]);
  const [preventiveActions, setPreventiveActions] = useState<ActionItem[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<DofStatus>("open");

  // İshikawa state
  const [problemStatement, setProblemStatement] = useState("");
  const [causes, setCauses] = useState<Record<CategoryKey, string[]>>({
    man: [], machine: [], method: [], material: [], environment: [], measurement: [],
  });
  const [rootCauseConclusion, setRootCauseConclusion] = useState("");

  // Fotoğraf state
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  // Kapatma modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DofStatus | null>(null);

  useEffect(() => {
    if (!incidentId) return;
    Promise.all([
      fetchIncidentById(incidentId),
      fetchDof(incidentId),
      fetchIshikawa(incidentId),
    ]).then(([inc, d, ish]) => {
      setIncident(inc);
      if (d) {
        setDof(d);
        setRootCause(d.rootCause ?? "");
        setRootCauseAnalysis(d.rootCauseAnalysis ?? "");
        setCorrectiveActions(d.correctiveActions ?? []);
        setPreventiveActions(d.preventiveActions ?? []);
        setAssignedTo(d.assignedTo ?? "");
        setDeadline(d.deadline ?? "");
        setStatus(d.status);
      }
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

  // DÖF action helpers
  function addAction(type: "corrective" | "preventive") {
    const item: ActionItem = { action: "", assignedTo: "", deadline: "", done: false };
    if (type === "corrective") setCorrectiveActions([...correctiveActions, item]);
    else setPreventiveActions([...preventiveActions, item]);
  }

  function updateAction(type: "corrective" | "preventive", idx: number, field: keyof ActionItem, value: string | boolean) {
    const list = type === "corrective" ? [...correctiveActions] : [...preventiveActions];
    list[idx] = { ...list[idx], [field]: value };
    if (type === "corrective") setCorrectiveActions(list);
    else setPreventiveActions(list);
  }

  function removeAction(type: "corrective" | "preventive", idx: number) {
    if (type === "corrective") setCorrectiveActions(correctiveActions.filter((_, i) => i !== idx));
    else setPreventiveActions(preventiveActions.filter((_, i) => i !== idx));
  }

  // İshikawa cause helpers
  function addCause(cat: CategoryKey) {
    setCauses({ ...causes, [cat]: [...causes[cat], ""] });
  }
  function updateCause(cat: CategoryKey, idx: number, val: string) {
    const list = [...causes[cat]]; list[idx] = val; setCauses({ ...causes, [cat]: list });
  }
  function removeCause(cat: CategoryKey, idx: number) {
    setCauses({ ...causes, [cat]: causes[cat].filter((_, i) => i !== idx) });
  }

  // Fotoğraf yükleme
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: UploadedPhoto[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: "",
    }));
    setPhotos([...photos, ...newPhotos]);
    e.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotos(photos.filter((p) => p.id !== id));
  }

  function updatePhotoCaption(id: string, caption: string) {
    setPhotos(photos.map((p) => p.id === id ? { ...p, caption } : p));
  }

  // Durum değiştirme - kapatma öncesi görsel kontrolü
  function handleStatusChange(newStatus: DofStatus) {
    if (newStatus === "completed" || newStatus === "verified") {
      setPendingStatus(newStatus);
      setShowCloseModal(true);
    } else {
      setStatus(newStatus);
    }
  }

  function confirmClose() {
    if (pendingStatus) setStatus(pendingStatus);
    setShowCloseModal(false);
    setPendingStatus(null);
  }

  function applyAISuggestion() {
    if (!incident) return;
    const suggestion = generateAISuggestion(incident);

    // İshikawa
    setProblemStatement(suggestion.ishikawa.problemStatement);
    setCauses(suggestion.ishikawa.causes);
    setRootCauseConclusion(suggestion.ishikawa.rootCauseConclusion);

    // DÖF
    setRootCause(suggestion.dof.rootCause);
    setRootCauseAnalysis(suggestion.dof.rootCauseAnalysis);
    setCorrectiveActions(suggestion.dof.correctiveActions);
    setPreventiveActions(suggestion.dof.preventiveActions);
  }

  async function handleSave() {
    if (!incident) return;
    setSaving(true);

    // Save DÖF
    const dofData = { rootCause, rootCauseAnalysis, correctiveActions, preventiveActions, assignedTo, deadline, status };
    if (dof) {
      await updateDof(dof.id, dofData);
    } else {
      const created = await createDof(incidentId, incident.organizationId, dofData);
      if (created) setDof(created);
    }

    // Save İshikawa
    const ishData: Partial<IshikawaRecord> = {
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
      await updateIshikawa(ishikawa.id, ishData);
    } else {
      const created = await createIshikawa(incidentId, incident.organizationId, ishData);
      if (created) setIshikawa(created);
    }

    setSaving(false);
  }

  if (loading) {
    return <div className="page-stack"><Skeleton className="h-12 w-64 rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;
  }

  const totalCauses = Object.values(causes).reduce((sum, arr) => sum + arr.filter(Boolean).length, 0);

  return (
    <div className="page-stack">
      <PageHeader
        title={dof ? dof.dofCode : "Yeni DÖF"}
        description="Düzeltici ve Önleyici Faaliyet + Kök Neden Analizi"
        meta={
          <Link href={`/incidents/${incidentId}`} className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline size-4" /> Olay Detayına Dön
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            {dof && <Badge variant={status === "completed" ? "success" : status === "open" ? "danger" : "warning"}>{statusLabels[status]}</Badge>}
            {incident && (
              <>
                <Button variant="outline" size="sm" onClick={() => exportDofAsPDF({ incident, dof, ishikawa })}>
                  <Download className="mr-1 size-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportDofAsWord({ incident, dof, ishikawa })}>
                  <FileText className="mr-1 size-3.5" /> Word
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ============================================================ */}
      {/* BÖLÜM 1: İshikawa (Balıkkılçığı) - Kök Neden Analizi        */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-5 text-[var(--gold)]" />
            Kök Neden Analizi - İshikawa (Balıkkılçığı)
          </CardTitle>
          <div className="flex items-center justify-between">
            <CardDescription>
              6M metoduyla olayın kök nedenlerini sistematik olarak analiz edin.
            </CardDescription>
            <Button variant="accent" size="sm" onClick={applyAISuggestion}>
              <Sparkles className="mr-1 size-3.5" /> AI ile Doldur
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            label="Problem Tanımı"
            value={problemStatement}
            onChange={(e) => setProblemStatement(e.target.value)}
            placeholder="Analiz edilen problemi tanımlayın..."
          />

          {/* 6M Grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ishikawaCategories.map((cat) => (
              <div key={cat.key} className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: cat.color }}>{cat.label}</span>
                  <button type="button" onClick={() => addCause(cat.key)} className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-foreground">
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{cat.desc}</p>
                <div className="space-y-2">
                  {causes[cat.key].length === 0 && (
                    <button type="button" onClick={() => addCause(cat.key)}
                      className="w-full rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors">
                      + Neden ekle
                    </button>
                  )}
                  {causes[cat.key].map((cause, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="size-1.5 shrink-0 rounded-full" style={{ background: cat.color }} />
                      <input type="text" value={cause}
                        onChange={(e) => updateCause(cat.key, idx, e.target.value)}
                        placeholder={`${cat.label} nedeni...`}
                        className="h-8 flex-1 rounded-lg border border-border bg-input px-2 text-xs text-foreground placeholder:text-muted-foreground" />
                      <button type="button" onClick={() => removeCause(cat.key, idx)} className="text-muted-foreground hover:text-danger">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">Kök Neden Sonucu</span>
              <span className="text-xs text-muted-foreground">{totalCauses} neden belirlendi</span>
            </div>
            <Textarea
              value={rootCauseConclusion}
              onChange={(e) => setRootCauseConclusion(e.target.value)}
              placeholder="Tüm analiz sonucunda belirlenen kök neden(ler)..."
            />
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* BÖLÜM 2: DÖF Kök Neden Detayı                               */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-[var(--gold)]" />
            DÖF Detayı
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea label="Kök Neden Özeti" value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder="İshikawa analizinden çıkan temel neden..." />
          <Textarea label="Detaylı Analiz (5 Neden vb.)" value={rootCauseAnalysis} onChange={(e) => setRootCauseAnalysis(e.target.value)} placeholder="5 Neden analizi veya ek detaylar..." />
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* BÖLÜM 3: Düzeltici Faaliyetler                               */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Düzeltici Faaliyetler</CardTitle>
            <Button variant="outline" size="sm" onClick={() => addAction("corrective")}>
              <Plus className="mr-1 size-3.5" /> Ekle
            </Button>
          </div>
          <CardDescription>Olayın tekrar etmemesi için yapılacak düzeltici aksiyonlar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {correctiveActions.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Henüz düzeltici faaliyet eklenmedi.</p>
          )}
          {correctiveActions.map((a, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={a.done} onChange={(e) => updateAction("corrective", idx, "done", e.target.checked)} className="size-4 rounded" />
                  <span className="text-xs font-medium text-muted-foreground">Faaliyet {idx + 1}</span>
                </div>
                <button type="button" onClick={() => removeAction("corrective", idx)} className="text-xs text-danger hover:underline"><Trash2 className="size-3.5" /></button>
              </div>
              <Input placeholder="Faaliyet açıklaması" value={a.action} onChange={(e) => updateAction("corrective", idx, "action", e.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Sorumlu" value={a.assignedTo} onChange={(e) => updateAction("corrective", idx, "assignedTo", e.target.value)} />
                <Input type="date" value={a.deadline} onChange={(e) => updateAction("corrective", idx, "deadline", e.target.value)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* BÖLÜM 4: Önleyici Faaliyetler                                */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Önleyici Faaliyetler</CardTitle>
            <Button variant="outline" size="sm" onClick={() => addAction("preventive")}>
              <Plus className="mr-1 size-3.5" /> Ekle
            </Button>
          </div>
          <CardDescription>Benzer olayların gelecekte oluşmaması için alınacak önlemler.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {preventiveActions.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Henüz önleyici faaliyet eklenmedi.</p>
          )}
          {preventiveActions.map((a, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={a.done} onChange={(e) => updateAction("preventive", idx, "done", e.target.checked)} className="size-4 rounded" />
                  <span className="text-xs font-medium text-muted-foreground">Faaliyet {idx + 1}</span>
                </div>
                <button type="button" onClick={() => removeAction("preventive", idx)} className="text-xs text-danger hover:underline"><Trash2 className="size-3.5" /></button>
              </div>
              <Input placeholder="Faaliyet açıklaması" value={a.action} onChange={(e) => updateAction("preventive", idx, "action", e.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Sorumlu" value={a.assignedTo} onChange={(e) => updateAction("preventive", idx, "assignedTo", e.target.value)} />
                <Input type="date" value={a.deadline} onChange={(e) => updateAction("preventive", idx, "deadline", e.target.value)} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* BÖLÜM 5: Atama ve Durum                                      */}
      {/* ============================================================ */}
      <Card>
        <CardHeader><CardTitle>Atama ve Durum</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Sorumlu Kişi" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            <Input label="Son Tarih" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Durum</label>
              <select value={status} onChange={(e) => handleStatusChange(e.target.value as DofStatus)}
                className="h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground">
                <option value="open">Açık</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="completed">Tamamlandı</option>
                <option value="verified">Doğrulandı</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* BÖLÜM 6: Fotoğraflar / Görseller                            */}
      {/* ============================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ImagePlus className="size-5 text-[var(--gold)]" />
                Fotoğraflar
              </CardTitle>
              <CardDescription>Sorunla ilgili fotoğrafları ekleyin (olay yeri, hasar, düzeltme öncesi/sonrası).</CardDescription>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
                <ImagePlus className="size-4" /> Fotoğraf Ekle
              </span>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-10 text-center transition-colors hover:border-primary/30">
              <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              <ImagePlus className="size-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fotoğraf yüklemek için tıklayın</span>
            </label>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative rounded-xl border border-border overflow-hidden">
                  <img src={photo.previewUrl} alt={photo.caption || "DÖF fotoğrafı"} className="aspect-video w-full object-cover" />
                  <button type="button" onClick={() => removePhoto(photo.id)}
                    className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <X className="size-4" />
                  </button>
                  <div className="p-3">
                    <input type="text" value={photo.caption} onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                      placeholder="Fotoğraf açıklaması..."
                      className="h-8 w-full rounded-lg border border-border bg-input px-2 text-xs text-foreground placeholder:text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="mr-2 size-4" />
          {saving ? "Kaydediliyor..." : "Tümünü Kaydet"}
        </Button>
      </div>

      {/* Kapatma Onay Modalı */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-warning/10">
                <AlertTriangle className="size-5 text-warning" />
              </span>
              <h3 className="text-lg font-semibold text-foreground">DÖF Kapatma Onayı</h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                DÖF&apos;ü <strong>{pendingStatus === "completed" ? "tamamlandı" : "doğrulandı"}</strong> olarak işaretlemek üzeresiniz.
              </p>

              {photos.length === 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
                  <p className="text-sm font-medium text-warning">Henüz fotoğraf eklenmedi!</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    DÖF kapatmadan önce düzeltme sonrası fotoğraf eklemek ister misiniz?
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Tüm düzeltici ve önleyici faaliyetler tamamlandı mı?
              </p>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setShowCloseModal(false); setPendingStatus(null); }}>
                  İptal
                </Button>
                {photos.length === 0 && (
                  <label className="flex-1 cursor-pointer">
                    <input type="file" accept="image/*" multiple onChange={(e) => { handlePhotoUpload(e); setShowCloseModal(false); setPendingStatus(null); }} className="hidden" />
                    <span className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-secondary">
                      <ImagePlus className="size-4" /> Fotoğraf Ekle
                    </span>
                  </label>
                )}
                <Button className="flex-1" onClick={confirmClose}>
                  Onayla ve Kapat
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
