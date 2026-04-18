"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumIconBadge } from "@/components/ui/premium-icon-badge";
import {
  fetchIncidents,
  type IncidentRecord,
  type IncidentType,
  type IncidentStatus,
} from "@/lib/supabase/incident-api";
import {
  AlertTriangle,
  Plus,
  ShieldAlert,
  Stethoscope,
  Eye,
  FileWarning,
  ClipboardList,
  TrendingUp,
  GitBranch,
} from "lucide-react";
import { AnalizlerContent } from "./AnalizlerContent";

const typeLabels: Record<IncidentType, string> = {
  work_accident: "Is Kazasi",
  near_miss: "Ramak Kala",
  occupational_disease: "Meslek Hastaligi",
  other: "Diger",
};

const typeBadgeVariant: Record<IncidentType, "danger" | "warning" | "accent" | "neutral"> = {
  work_accident: "danger",
  near_miss: "warning",
  occupational_disease: "accent",
  other: "neutral",
};

const typeIcons: Record<IncidentType, typeof AlertTriangle> = {
  work_accident: ShieldAlert,
  near_miss: AlertTriangle,
  occupational_disease: Stethoscope,
  other: Eye,
};

const statusLabels: Record<IncidentStatus, string> = {
  draft: "Taslak",
  reported: "Bildirildi",
  investigating: "Inceleniyor",
  dof_open: "DOF Acik",
  closed: "Kapatildi",
};

const statusBadgeVariant: Record<IncidentStatus, "neutral" | "accent" | "warning" | "danger" | "success"> = {
  draft: "neutral",
  reported: "accent",
  investigating: "warning",
  dof_open: "danger",
  closed: "success",
};

export function IncidentsListClient() {
  const [tab, setTab] = useState<"incidents" | "analizler">("incidents");
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<IncidentType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | "all">("all");

  useEffect(() => {
    (async () => {
      const filters: { type?: IncidentType; status?: IncidentStatus } = {};
      if (filterType !== "all") filters.type = filterType;
      if (filterStatus !== "all") filters.status = filterStatus;
      const data = await fetchIncidents(filters);
      setIncidents(data);
      setLoading(false);
    })();
  }, [filterType, filterStatus]);

  const totalCount = incidents.length;
  const thisMonthCount = incidents.filter((i) => {
    if (!i.incidentDate) return false;
    const d = new Date(i.incidentDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const openDofCount = incidents.filter((i) => i.dofRequired && i.status !== "closed").length;

  return (
    <div className="page-stack">
      <PageHeader
        title={tab === "incidents" ? "Olay Kayitlari" : "Kok Neden Analizi"}
        description={
          tab === "incidents"
            ? "Is kazasi, ramak kala olay ve meslek hastaligi kayitlarini yonetin."
            : "Olay kaydina bagli veya serbest kok neden analizi yapin."
        }
        actions={
          tab === "incidents" ? (
            <Link href="/incidents/new">
              <Button size="lg">
                <Plus className="size-4" />
                Yeni Olay Kaydi
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Sekme Butonlari */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setTab("incidents")}
          className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-all ${
            tab === "incidents"
              ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
              : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
          }`}
        >
          <ClipboardList className="size-5" />
          Olay Kayitlari
        </button>

        <div className="group relative">
          <button
            type="button"
            onClick={() => setTab("analizler")}
            className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold transition-all ${
              tab === "analizler"
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                : "border border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            <GitBranch className="size-5" />
            Kok Neden Analizi
          </button>
          {tab !== "analizler" && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground shadow-sm">
              6
            </span>
          )}
          <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-3 opacity-0 shadow-[var(--shadow-elevated)] transition-opacity group-hover:opacity-100">
            <p className="mb-1.5 whitespace-nowrap text-xs font-semibold text-foreground">6 farkli kok neden analiz yontemi</p>
            <p className="whitespace-nowrap text-[11px] text-muted-foreground">Ishikawa, 5 Neden, Hata Agaci, SCAT, Bow-Tie, MORT</p>
          </div>
        </div>
      </div>

      {/* Olaylar Tab */}
      {tab === "incidents" && (
        <>
          {/* Istatistik Kartlari */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="overflow-hidden">
              <div className="h-1 w-full bg-[linear-gradient(90deg,var(--gold),var(--gold-light))]" />
              <CardContent className="flex items-center gap-4 p-5">
                <PremiumIconBadge icon={ClipboardList} tone="gold" size="sm" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalCount}</p>
                  <p className="text-xs text-muted-foreground">Toplam Olay</p>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="h-1 w-full bg-[linear-gradient(90deg,#F59E0B,#FB923C)]" />
              <CardContent className="flex items-center gap-4 p-5">
                <PremiumIconBadge icon={FileWarning} tone="amber" size="sm" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{openDofCount}</p>
                  <p className="text-xs text-muted-foreground">Acik DOF</p>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <div className="h-1 w-full bg-[linear-gradient(90deg,#10B981,#34D399)]" />
              <CardContent className="flex items-center gap-4 p-5">
                <PremiumIconBadge icon={TrendingUp} tone="success" size="sm" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{thisMonthCount}</p>
                  <p className="text-xs text-muted-foreground">Bu Ay</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtreler */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value as IncidentType | "all"); setLoading(true); }}
            >
              <option value="all">Tum Tipler</option>
              <option value="work_accident">Is Kazasi</option>
              <option value="near_miss">Ramak Kala</option>
              <option value="occupational_disease">Meslek Hastaligi</option>
            </select>

            <select
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value as IncidentStatus | "all"); setLoading(true); }}
            >
              <option value="all">Tum Durumlar</option>
              <option value="draft">Taslak</option>
              <option value="reported">Bildirildi</option>
              <option value="investigating">Inceleniyor</option>
              <option value="dof_open">DOF Acik</option>
              <option value="closed">Kapatildi</option>
            </select>
          </div>

          {/* Liste */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <EmptyState
              title="Henuz olay kaydi yok"
              description="Is kazasi, ramak kala olay veya meslek hastaligi kaydi olusturmak icin baslayin."
            />
          ) : (
            <div className="space-y-3">
              {incidents.map((item) => {
                const TypeIcon = typeIcons[item.incidentType];
                return (
                  <Link key={item.id} href={`/incidents/${item.id}`}>
                    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
                      <CardContent className="flex items-center gap-4 p-5">
                        <PremiumIconBadge
                          icon={TypeIcon}
                          tone={
                            item.incidentType === "work_accident"
                              ? "risk"
                              : item.incidentType === "near_miss"
                                ? "amber"
                                : "teal"
                          }
                          size="sm"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {item.incidentCode}
                            </span>
                            <Badge variant={typeBadgeVariant[item.incidentType]}>
                              {typeLabels[item.incidentType]}
                            </Badge>
                            <Badge variant={statusBadgeVariant[item.status]}>
                              {statusLabels[item.status]}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-foreground">
                            {item.description || "Aciklama girilmemis"}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            {item.companyName && <span>{item.companyName}</span>}
                            {item.personnelName && <span>{item.personnelName}</span>}
                            {item.incidentDate && <span>{item.incidentDate}</span>}
                          </div>
                        </div>

                        <Eye className="size-4 shrink-0 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Analizler Tab */}
      {tab === "analizler" && <AnalizlerContent />}
    </div>
  );
}
