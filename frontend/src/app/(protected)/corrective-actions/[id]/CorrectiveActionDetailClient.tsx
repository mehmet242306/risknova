"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, MessageSquarePlus, Paperclip, Save, UploadCloud } from "lucide-react";
import { IshikawaFishboneDiagram } from "@/components/incidents/IshikawaFishboneDiagram";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uploadCorrectiveActionFile } from "@/lib/supabase/corrective-action-storage";
import {
  addCorrectiveActionUpdate,
  fetchCorrectiveActionById,
  fetchCorrectiveActionUpdates,
  updateCorrectiveAction,
  type CorrectiveActionRecord,
  type CorrectiveActionStatus,
  type CorrectiveActionUpdateRecord,
} from "@/lib/supabase/corrective-actions-api";

const statusMeta: Record<
  CorrectiveActionStatus,
  { label: string; badge: "accent" | "warning" | "neutral" | "success" | "danger" }
> = {
  tracking: { label: "Takip Ediliyor", badge: "accent" },
  in_progress: { label: "İşlem Görüyor", badge: "warning" },
  on_hold: { label: "Bekletiliyor", badge: "neutral" },
  completed: { label: "Sonuçlandırıldı", badge: "success" },
  overdue: { label: "Gecikmiş", badge: "danger" },
};

const ishikawaLabels = {
  insan: "İnsan",
  makine: "Makine",
  metot: "Metot",
  malzeme: "Malzeme",
  olcum: "Ölçüm",
  cevre: "Çevre",
} as const;

type IshikawaSnapshot = {
  analysis_summary?: string;
  primary_root_cause?: string;
  severity_assessment?: string;
  categories?: Partial<Record<keyof typeof ishikawaLabels, string[]>>;
};

type ChecklistItem = {
  id: string;
  label: string;
  checked: boolean;
};

type AttachmentMeta = {
  url: string;
  name: string;
  size?: number;
  uploadedAt: string;
};

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "root-cause-reviewed", label: "Kök neden analizi uzman tarafından gözden geçirildi", checked: false },
  { id: "responsible-assigned", label: "Sorumlu rol ve termin netleştirildi", checked: false },
  { id: "evidence-attached", label: "Uygulamayı destekleyen kanıt veya dosya eklendi", checked: false },
  { id: "effectiveness-verified", label: "Faaliyetin etkinlik kontrolü planlandı", checked: false },
];

export function CorrectiveActionDetailClient() {
  const params = useParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [item, setItem] = useState<CorrectiveActionRecord | null>(null);
  const [updates, setUpdates] = useState<CorrectiveActionUpdateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState("0");

  useEffect(() => {
    Promise.all([fetchCorrectiveActionById(id), fetchCorrectiveActionUpdates(id)]).then(([detail, updateRows]) => {
      setItem(detail);
      setUpdates(updateRows);
      setProgress(String(detail?.completionPercentage ?? 0));
      setLoading(false);
    });
  }, [id]);

  const timeline = useMemo(
    () =>
      updates.map((entry) => ({
        ...entry,
        label:
          entry.updateType === "progress"
            ? "İlerleme güncellemesi"
            : entry.updateType === "status_change"
              ? "Durum değişikliği"
              : entry.updateType === "file_upload"
                ? "Dosya eklendi"
                : "Not",
      })),
    [updates],
  );

  const ishikawa = useMemo(() => (item?.ishikawaSnapshot ?? {}) as IshikawaSnapshot, [item]);
  const checklist = useMemo(() => {
    const raw = Array.isArray(item?.metadata?.completionChecklist) ? item?.metadata?.completionChecklist : [];
    const incoming = new Map(
      raw
        .filter((entry): entry is Partial<ChecklistItem> => typeof entry === "object" && entry !== null)
        .map((entry) => [
          String(entry.id ?? ""),
          {
            id: String(entry.id ?? ""),
            label: String(entry.label ?? ""),
            checked: Boolean(entry.checked),
          },
        ]),
    );

    return DEFAULT_CHECKLIST.map((defaultItem) => incoming.get(defaultItem.id) ?? defaultItem);
  }, [item?.metadata]);
  const attachments = useMemo<AttachmentMeta[]>(() => {
    const raw = Array.isArray(item?.metadata?.attachments) ? item?.metadata?.attachments : [];
    return raw
      .filter((entry): entry is Partial<AttachmentMeta> => typeof entry === "object" && entry !== null && typeof entry.url === "string")
      .map((entry) => ({
        url: entry.url ?? "",
        name: entry.name ?? "Ek dosya",
        size: typeof entry.size === "number" ? entry.size : undefined,
        uploadedAt: entry.uploadedAt ?? new Date().toISOString(),
      }));
  }, [item?.metadata]);

  async function refresh(idToLoad: string) {
    const [detail, updateRows] = await Promise.all([
      fetchCorrectiveActionById(idToLoad),
      fetchCorrectiveActionUpdates(idToLoad),
    ]);
    setItem(detail);
    setUpdates(updateRows);
    if (detail) setProgress(String(detail.completionPercentage));
  }

  async function saveMainFields() {
    if (!item) return;
    setSaving(true);

    const nextProgress = Math.max(0, Math.min(100, Number(progress) || 0));
    const nextStatus = nextProgress === 100 ? "completed" : item.status;

    const ok = await updateCorrectiveAction(item.id, {
      status: nextStatus,
      completionPercentage: nextProgress,
      completedAt: nextProgress === 100 ? new Date().toISOString() : null,
    });

    if (ok) {
      if (nextProgress !== item.completionPercentage) {
        await addCorrectiveActionUpdate({
          correctiveActionId: item.id,
          organizationId: item.organizationId,
          updateType: "progress",
          oldValue: String(item.completionPercentage),
          newValue: String(nextProgress),
          content: `İlerleme %${nextProgress} olarak güncellendi.`,
        });
      }
      await refresh(item.id);
    }

    setSaving(false);
  }

  async function addNote() {
    if (!item || !note.trim()) return;
    setSaving(true);

    const ok = await addCorrectiveActionUpdate({
      correctiveActionId: item.id,
      organizationId: item.organizationId,
      updateType: "comment",
      content: note.trim(),
    });

    if (ok) {
      setNote("");
      await refresh(item.id);
    }

    setSaving(false);
  }

  async function saveChecklist(nextChecklist: ChecklistItem[]) {
    if (!item) return;
    setSaving(true);

    const nextMetadata = {
      ...item.metadata,
      completionChecklist: nextChecklist,
      attachments,
    };

    const ok = await updateCorrectiveAction(item.id, { metadata: nextMetadata });
    if (ok) {
      await addCorrectiveActionUpdate({
        correctiveActionId: item.id,
        organizationId: item.organizationId,
        updateType: "progress",
        content: "Tamamlama checklist'i güncellendi.",
      });
      await refresh(item.id);
    }

    setSaving(false);
  }

  async function toggleChecklist(itemId: string) {
    const nextChecklist = checklist.map((entry) =>
      entry.id === itemId ? { ...entry, checked: !entry.checked } : entry,
    );
    await saveChecklist(nextChecklist);
  }

  async function handleFileUpload(file: File) {
    if (!item) return;
    setUploading(true);

    try {
      const uploaded = await uploadCorrectiveActionFile(item.id, file);
      const nextAttachments = [
        {
          url: uploaded.url,
          name: uploaded.name,
          size: uploaded.size,
          uploadedAt: new Date().toISOString(),
        },
        ...attachments,
      ];

      const nextMetadata = {
        ...item.metadata,
        completionChecklist: checklist,
        attachments: nextAttachments,
      };

      const ok = await updateCorrectiveAction(item.id, { metadata: nextMetadata });
      if (ok) {
        await addCorrectiveActionUpdate({
          correctiveActionId: item.id,
          organizationId: item.organizationId,
          updateType: "file_upload",
          content: `${file.name} dosyası eklendi.`,
          fileUrl: uploaded.url,
        });
        await refresh(item.id);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function changeStatus(nextStatus: CorrectiveActionStatus) {
    if (!item) return;
    setSaving(true);

    const ok = await updateCorrectiveAction(item.id, {
      status: nextStatus,
      completedAt: nextStatus === "completed" ? new Date().toISOString() : null,
    });

    if (ok) {
      await addCorrectiveActionUpdate({
        correctiveActionId: item.id,
        organizationId: item.organizationId,
        updateType: "status_change",
        oldValue: item.status,
        newValue: nextStatus,
        content: `Durum ${statusMeta[nextStatus].label} olarak değiştirildi.`,
      });
      await refresh(item.id);
    }

    setSaving(false);
  }

  function exportAsPdf() {
    window.print();
  }

  if (loading) {
    return <div className="page-stack"><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>;
  }

  if (!item) {
    return <div className="page-stack"><p className="text-sm text-muted-foreground">DÖF kaydı bulunamadı.</p></div>;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="DÖF Detayı"
        title={item.title}
        description="Düzeltici ve önleyici faaliyet detaylarını, ilerleme kayıtlarını ve kaynak olayı tek ekranda yönetin."
        meta={
          <Link href="/corrective-actions" className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline size-4" /> DÖF listesine dön
          </Link>
        }
        actions={
          <>
            <Badge variant={statusMeta[item.status].badge}>{statusMeta[item.status].label}</Badge>
            <Button variant="outline" onClick={exportAsPdf}>
              <Download className="mr-1 size-4" /> PDF olarak indir
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Faaliyet Özeti</CardTitle>
            <CardDescription>{item.code ?? "DÖF"} · {item.companyName ?? "Firma belirtilmedi"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Summary label="Kaynak Olay" value={item.incidentCode ?? "Bağımsız kayıt"} />
              <Summary label="Öncelik" value={item.priority} />
              <Summary label="Termin" value={item.deadline} />
              <Summary label="Sorumlu Rol" value={item.responsibleRole ?? "Atanmadı"} />
            </div>
            <Textarea label="Kök Neden" value={item.rootCause} readOnly />
            <Textarea label="Düzeltici Faaliyet" value={item.correctiveAction} readOnly />
            <Textarea label="Önleyici Faaliyet" value={item.preventiveAction ?? ""} readOnly />

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>İlerleme Yönetimi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Tamamlanma Yüzdesi"
                    type="number"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                  />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Durum</label>
                    <select
                      value={item.status}
                      onChange={(e) => void changeStatus(e.target.value as CorrectiveActionStatus)}
                      className="h-11 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground"
                    >
                      <option value="tracking">Takip Ediliyor</option>
                      <option value="in_progress">İşlem Görüyor</option>
                      <option value="on_hold">Bekletiliyor</option>
                      <option value="completed">Sonuçlandırıldı</option>
                      <option value="overdue">Gecikmiş</option>
                    </select>
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--gold)] transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, Number(progress) || 0))}%` }}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => void saveMainFields()} disabled={saving}>
                    <Save className="mr-1 size-4" /> Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ishikawa Özeti</CardTitle>
              <CardDescription>Kaydedilmiş snapshot görünümü ve balık kılçığı diyagramı</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(ishikawa).length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu DÖF için snapshot bulunmuyor.</p>
              ) : (
                <>
                  <IshikawaFishboneDiagram
                    data={{
                      analysis_summary: ishikawa.analysis_summary ?? item.title,
                      primary_root_cause: ishikawa.primary_root_cause ?? item.rootCause,
                      severity_assessment: ishikawa.severity_assessment ?? "Orta",
                      categories: {
                        insan: ishikawa.categories?.insan ?? [],
                        makine: ishikawa.categories?.makine ?? [],
                        metot: ishikawa.categories?.metot ?? [],
                        malzeme: ishikawa.categories?.malzeme ?? [],
                        olcum: ishikawa.categories?.olcum ?? [],
                        cevre: ishikawa.categories?.cevre ?? [],
                      },
                    }}
                  />
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-xs text-muted-foreground">Analiz Özeti</p>
                    <p className="mt-1 text-sm text-foreground">{ishikawa.analysis_summary ?? "-"}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Summary label="Birincil Kök Neden" value={ishikawa.primary_root_cause ?? "-"} />
                    <Summary label="Şiddet" value={ishikawa.severity_assessment ?? "-"} />
                  </div>
                  <div className="grid gap-3">
                    {Object.entries(ishikawaLabels).map(([key, label]) => {
                      const values = ishikawa.categories?.[key as keyof typeof ishikawaLabels] ?? [];
                      return (
                        <div key={key} className="rounded-xl border border-border bg-muted/20 p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{label}</p>
                            <Badge variant="neutral">{values.length}</Badge>
                          </div>
                          {values.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Kayıt yok</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {values.map((value, index) => (
                                <span key={`${key}-${index}`} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                                  {value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tamamlama Checklist&apos;i</CardTitle>
              <CardDescription>Faaliyetin kapanış kalitesini tek yerden takip edin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => void toggleChecklist(entry.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    entry.checked
                      ? "border-emerald-500/35 bg-emerald-500/10"
                      : "border-border bg-muted/20 hover:border-primary/35"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                      entry.checked
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="text-sm text-foreground">{entry.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dosya ve Kanıtlar</CardTitle>
              <CardDescription>Belge, form veya doğrulayıcı kanıt dosyası ekleyin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <UploadCloud className="mr-1 size-4" /> {uploading ? "Yükleniyor..." : "Dosya Yükle"}
                </Button>
              </div>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz dosya eklenmedi.</p>
              ) : (
                <div className="space-y-3">
                  {attachments.map((attachment) => (
                    <a
                      key={`${attachment.url}-${attachment.uploadedAt}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:border-primary/35"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(attachment.uploadedAt).toLocaleString("tr-TR")}
                          {attachment.size ? ` · ${(attachment.size / 1024 / 1024).toFixed(2)} MB` : ""}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <Paperclip className="size-3.5" /> Aç
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquarePlus className="size-5 text-[var(--gold)]" />
                İlerleme Notu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bugün yapılan işlem, blokaj veya tamamlanan adım..."
              />
              <div className="flex justify-end">
                <Button onClick={() => void addNote()} disabled={saving || !note.trim()}>
                  Not Ekle
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zaman Çizelgesi</CardTitle>
          <CardDescription>Bu DÖF üzerinde yapılan güncellemelerin akışı</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz güncelleme yapılmadı.</p>
          ) : (
            timeline.map((entry) => (
              <div key={entry.id} className="flex gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                <span className="mt-1 inline-flex size-3 shrink-0 rounded-full bg-[var(--gold)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("tr-TR")}</p>
                  </div>
                  {entry.content && <p className="mt-2 text-sm text-muted-foreground">{entry.content}</p>}
                  {entry.fileUrl && (
                    <a
                      href={entry.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Paperclip className="size-3.5" /> Ek dosyayı aç
                    </a>
                  )}
                  {(entry.oldValue || entry.newValue) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {entry.oldValue ? `${entry.oldValue} -> ` : ""}{entry.newValue ?? ""}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {item.incidentId && (
        <div className="flex justify-end">
          <Link href={`/incidents/${item.incidentId}`}>
            <Button variant="outline">
              <CheckCircle2 className="mr-1 size-4" /> Kaynak olaya git
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
