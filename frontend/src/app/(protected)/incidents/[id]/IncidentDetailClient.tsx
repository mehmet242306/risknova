"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchIncidentById,
  fetchWitnesses,
  fetchDof,
  fetchIshikawa,
  updateIncident,
  type IncidentRecord,
  type IncidentType,
  type IncidentStatus,
  type WitnessRecord,
  type DofRecord,
  type IshikawaRecord,
} from "@/lib/supabase/incident-api";
import {
  ArrowLeft,
  ShieldAlert,
  AlertTriangle,
  Stethoscope,
  FileText,
  GitBranch,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";

const typeLabels: Record<IncidentType, string> = {
  work_accident: "İş Kazası",
  near_miss: "Ramak Kala",
  occupational_disease: "Meslek Hastalığı",
};

const typeBadgeVariant: Record<IncidentType, "danger" | "warning" | "accent"> = {
  work_accident: "danger",
  near_miss: "warning",
  occupational_disease: "accent",
};

const statusLabels: Record<IncidentStatus, string> = {
  draft: "Taslak",
  reported: "Bildirildi",
  investigating: "İnceleniyor",
  dof_open: "DÖF Açık",
  closed: "Kapatıldı",
};

const statusBadgeVariant: Record<IncidentStatus, "neutral" | "accent" | "warning" | "danger" | "success"> = {
  draft: "neutral",
  reported: "accent",
  investigating: "warning",
  dof_open: "danger",
  closed: "success",
};

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
      <span className="w-40 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || "-"}</span>
    </div>
  );
}

export function IncidentDetailClient() {
  const params = useParams();
  const id = params.id as string;

  const [incident, setIncident] = useState<IncidentRecord | null>(null);
  const [witnesses, setWitnesses] = useState<WitnessRecord[]>([]);
  const [dof, setDof] = useState<DofRecord | null>(null);
  const [ishikawa, setIshikawa] = useState<IshikawaRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchIncidentById(id),
      fetchWitnesses(id),
      fetchDof(id),
      fetchIshikawa(id),
    ]).then(([inc, wit, d, ish]) => {
      setIncident(inc);
      setWitnesses(wit);
      setDof(d);
      setIshikawa(ish);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="page-stack">
        <Skeleton className="h-12 w-64 rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="page-stack">
        <PageHeader title="Olay bulunamadı" />
        <Link href="/incidents" className="text-sm text-primary underline">Listeye dön</Link>
      </div>
    );
  }

  const TypeIcon = incident.incidentType === "work_accident" ? ShieldAlert
    : incident.incidentType === "near_miss" ? AlertTriangle : Stethoscope;

  async function handleStatusChange(newStatus: IncidentStatus) {
    if (!incident) return;
    await updateIncident(incident.id, { status: newStatus });
    setIncident({ ...incident, status: newStatus });
  }

  return (
    <div className="page-stack">
      <PageHeader
        title={incident.incidentCode}
        meta={
          <Link href="/incidents" className="text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline size-4" /> Olay Listesi
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={typeBadgeVariant[incident.incidentType]}>
              {typeLabels[incident.incidentType]}
            </Badge>
            <Badge variant={statusBadgeVariant[incident.status]}>
              {statusLabels[incident.status]}
            </Badge>
          </div>
        }
      />

      {/* DÖF / Analiz CTA Banner */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/incidents/${id}/dof`}>
          <Card className={`cursor-pointer border-2 transition-all hover:shadow-[var(--shadow-elevated)] ${dof ? "border-primary/30 bg-primary/5" : "border-dashed border-border hover:border-primary/30"}`}>
            <CardContent className="flex items-center gap-4 p-6">
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--gold-glow)]">
                <ClipboardCheck className="size-6 text-[var(--gold)]" strokeWidth={1.5} />
              </span>
              <div className="flex-1">
                <p className="text-base font-semibold text-foreground">
                  {dof ? `DÖF: ${dof.dofCode}` : "DÖF + Kök Neden Analizi Başlat"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {dof
                    ? `Durum: ${dof.status === "open" ? "Açık" : dof.status === "in_progress" ? "Devam Ediyor" : dof.status === "completed" ? "Tamamlandı" : "Doğrulandı"}`
                    : "Düzeltici/Önleyici Faaliyet ve İshikawa balıkkılçığı analizi"}
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        <Link href={`/incidents/${id}/ishikawa`}>
          <Card className={`cursor-pointer border-2 transition-all hover:shadow-[var(--shadow-elevated)] ${ishikawa ? "border-primary/30 bg-primary/5" : "border-dashed border-border hover:border-primary/30"}`}>
            <CardContent className="flex items-center gap-4 p-6">
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--gold-glow)]">
                <GitBranch className="size-6 text-[var(--gold)]" strokeWidth={1.5} />
              </span>
              <div className="flex-1">
                <p className="text-base font-semibold text-foreground">
                  {ishikawa ? "İshikawa Diyagramı" : "İshikawa Diyagramı Görüntüle"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ishikawa?.rootCauseConclusion || "Balıkkılçığı görsel diyagram"}
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.4fr]">
        {/* Sol: Detaylar */}
        <div className="space-y-6">
          {/* Olay Detayları */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-[var(--gold)]" />
                Olay Detayları
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Olay Tarihi" value={incident.incidentDate} />
              <InfoRow label="Olay Saati" value={incident.incidentTime} />
              <InfoRow label="Lokasyon" value={incident.incidentLocation} />
              <InfoRow label="Bölüm" value={incident.incidentDepartment} />
              <InfoRow label="Vardiya" value={incident.shiftStartTime && incident.shiftEndTime ? `${incident.shiftStartTime} - ${incident.shiftEndTime}` : null} />
              <InfoRow label="Genel Faaliyet" value={incident.generalActivity} />
              <InfoRow label="Özel Faaliyet" value={incident.specificActivity} />
              <InfoRow label="Kullanılan Araç" value={incident.toolUsed} />
              <InfoRow label="Firma" value={incident.companyName} />
              <InfoRow label="Personel" value={incident.personnelName} />
            </CardContent>
          </Card>

          {/* Açıklama */}
          {incident.description && (
            <Card>
              <CardHeader><CardTitle>Olay Açıklaması</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-foreground">{incident.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Yaralanma / Hastalık */}
          {incident.incidentType !== "near_miss" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {incident.incidentType === "occupational_disease" ? "Meslek Hastalığı" : "Yaralanma Bilgileri"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incident.incidentType === "work_accident" ? (
                  <>
                    <InfoRow label="Yaranın Türü" value={incident.injuryType} />
                    <InfoRow label="Vücuttaki Yeri" value={incident.injuryBodyPart} />
                    <InfoRow label="Neden Olan Olay" value={incident.injuryCauseEvent} />
                    <InfoRow label="Neden Olan Araç" value={incident.injuryCauseTool} />
                    <InfoRow label="İş Göremezlik" value={incident.workDisability ? "Evet" : "Hayır"} />
                    <InfoRow label="Kayıp İş Günü" value={incident.daysLost} />
                  </>
                ) : (
                  <>
                    <InfoRow label="Hastalık Etkeni" value={incident.diseaseAgent} />
                    <InfoRow label="Etken Süresi" value={incident.diseaseAgentDuration} />
                    <InfoRow label="Tanı" value={incident.diseaseDiagnosis} />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tıbbi Müdahale */}
          {incident.medicalIntervention && (
            <Card>
              <CardHeader><CardTitle>Tıbbi Müdahale</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Müdahale Yapan" value={incident.medicalPerson} />
                <InfoRow label="Yapılan Yer" value={incident.medicalLocation} />
                <InfoRow label="İl" value={incident.medicalCity} />
                <InfoRow label="Tarih" value={incident.medicalDate} />
              </CardContent>
            </Card>
          )}

          {/* Şahitler */}
          {witnesses.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Şahitler ({witnesses.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {witnesses.map((w) => (
                  <div key={w.id} className="rounded-xl border border-border bg-muted/50 p-4">
                    <p className="text-sm font-medium text-foreground">{w.fullName}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {w.tcIdentity && <span>TC: {w.tcIdentity}</span>}
                      {w.phone && <span>Tel: {w.phone}</span>}
                      {w.email && <span>{w.email}</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sağ: Aksiyonlar */}
        <div className="space-y-4">
          {/* Durum Değiştir */}
          <Card>
            <CardHeader><CardTitle>Durum Yönetimi</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(["reported", "investigating", "dof_open", "closed"] as IncidentStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={incident.status === s}
                  onClick={() => handleStatusChange(s)}
                  className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-all ${
                    incident.status === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/30"
                  }`}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* DÖF */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-4 text-[var(--gold)]" /> DÖF</CardTitle></CardHeader>
            <CardContent>
              {dof ? (
                <Link href={`/incidents/${id}/dof`} className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{dof.dofCode}</p>
                    <Badge variant={dof.status === "completed" ? "success" : dof.status === "open" ? "danger" : "warning"}>
                      {dof.status === "open" ? "Açık" : dof.status === "in_progress" ? "Devam Ediyor" : dof.status === "completed" ? "Tamamlandı" : "Doğrulandı"}
                    </Badge>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <Link href={`/incidents/${id}/dof`}>
                  <Button variant="outline" className="w-full">DÖF Oluştur</Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* İshikawa */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="size-4 text-[var(--gold)]" /> İshikawa</CardTitle></CardHeader>
            <CardContent>
              {ishikawa ? (
                <Link href={`/incidents/${id}/ishikawa`} className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Balıkkılçığı Analizi</p>
                    <p className="text-xs text-muted-foreground">{ishikawa.rootCauseConclusion || "Analiz devam ediyor"}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <Link href={`/incidents/${id}/ishikawa`}>
                  <Button variant="outline" className="w-full">İshikawa Oluştur</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
