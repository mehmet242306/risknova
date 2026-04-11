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

const typeIcons: Record<IncidentType, typeof AlertTriangle> = {
  work_accident: ShieldAlert,
  near_miss: AlertTriangle,
  occupational_disease: Stethoscope,
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

export function IncidentsListClient() {
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
        title="Olay Kayıtları"
        description="İş kazası, ramak kala olay ve meslek hastalığı kayıtlarını yönetin."
        actions={
          <Link href="/incidents/new">
            <Button size="lg">
              <Plus className="size-4" />
              Yeni Olay Kaydı
            </Button>
          </Link>
        }
      />

      {/* İstatistik Kartları */}
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
              <p className="text-xs text-muted-foreground">Açık DÖF</p>
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
          <option value="all">Tüm Tipler</option>
          <option value="work_accident">İş Kazası</option>
          <option value="near_miss">Ramak Kala</option>
          <option value="occupational_disease">Meslek Hastalığı</option>
        </select>

        <select
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as IncidentStatus | "all"); setLoading(true); }}
        >
          <option value="all">Tüm Durumlar</option>
          <option value="draft">Taslak</option>
          <option value="reported">Bildirildi</option>
          <option value="investigating">İnceleniyor</option>
          <option value="dof_open">DÖF Açık</option>
          <option value="closed">Kapatıldı</option>
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
          title="Henüz olay kaydı yok"
          description="İş kazası, ramak kala olay veya meslek hastalığı kaydı oluşturmak için başlayın."
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
                        {item.description || "Açıklama girilmemiş"}
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
    </div>
  );
}
