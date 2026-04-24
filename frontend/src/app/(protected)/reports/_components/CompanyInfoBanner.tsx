"use client";

import {
  Building2,
  CalendarDays,
  Hash,
  MapPin,
  Shield,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CompanyProfile } from "@/lib/supabase/company-profile";

type Props = {
  profile: CompanyProfile | null;
  loading?: boolean;
};

function hazardTone(cls: string | null): "success" | "warning" | "danger" | "neutral" {
  if (!cls) return "neutral";
  const v = cls.toLowerCase();
  if (v.includes("çok") || v.includes("cok")) return "danger";
  if (v.includes("tehlikeli")) return "warning";
  if (v.includes("az")) return "success";
  return "neutral";
}

function companyTypeLabel(t: string | null): string {
  if (!t) return "—";
  const map: Record<string, string> = {
    bireysel: "Bireysel",
    osgb: "OSGB",
    enterprise: "Kurumsal",
    kurumsal: "Kurumsal",
  };
  return map[t.toLowerCase()] ?? t;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function CompanyInfoBanner({ profile, loading }: Props) {
  if (loading) {
    return (
      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-border bg-muted/10 p-5 text-center text-sm text-muted-foreground">
        Aktif çalışma alanı yok — firma bilgisi için önce bir workspace seç.
      </section>
    );
  }

  const address = [profile.district, profile.city].filter(Boolean).join(", ");

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--shadow-card)]">
      {/* Üst şerit — adı + logo + etiketler */}
      <div className="relative flex flex-wrap items-start justify-between gap-4 border-b border-border bg-[linear-gradient(135deg,rgba(217,162,27,0.08),transparent)] p-5">
        <div className="flex items-start gap-4">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logoUrl}
              alt={profile.workspaceName}
              className="h-14 w-14 rounded-2xl border border-border object-cover"
            />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-[var(--gold)]/15 text-[var(--gold)]">
              <Building2 className="h-7 w-7" />
            </span>
          )}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold leading-tight text-foreground">
                {profile.workspaceName}
              </h2>
              {profile.companyCode ? (
                <Badge variant="neutral" className="font-mono">
                  {profile.companyCode}
                </Badge>
              ) : null}
              {!profile.isActive ? <Badge variant="danger">Pasif</Badge> : null}
            </div>
            {profile.officialName && profile.officialName !== profile.workspaceName ? (
              <p className="text-sm text-muted-foreground">{profile.officialName}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={hazardTone(profile.hazardClass)}>
                <Shield className="mr-1 h-3 w-3" />
                {profile.hazardClass ?? "Tehlike sınıfı yok"}
              </Badge>
              <Badge variant="neutral">{companyTypeLabel(profile.companyType)}</Badge>
              {profile.sector ? (
                <Badge variant="neutral">{profile.sector}</Badge>
              ) : null}
              {profile.naceCode ? (
                <Badge variant="neutral" className="font-mono">
                  NACE {profile.naceCode}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-right text-xs text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>Kayıt: {formatDate(profile.createdAt)}</span>
        </div>
      </div>

      {/* Alt grid — detay + metrikler */}
      <div className="grid gap-x-6 gap-y-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <InfoField
          icon={Hash}
          label="Vergi No"
          value={profile.taxNumber}
          mono
        />
        <InfoField
          icon={Hash}
          label="MERSİS No"
          value={profile.mersisNumber}
          mono
        />
        <InfoField
          icon={MapPin}
          label="Konum"
          value={address || "—"}
          secondary={profile.address ?? undefined}
        />
        <InfoField
          icon={Users}
          label="Aktif Personel"
          value={`${profile.personnelActive}`}
          secondary={`${profile.personnelTotal} toplam`}
        />

        <MetricBox
          label="Departman"
          value={profile.departmentCount}
          color="sky"
        />
        <MetricBox
          label="Lokasyon"
          value={profile.locationCount}
          color="violet"
        />
        <MetricBox
          label="Personel"
          value={profile.personnelActive}
          color="emerald"
        />
        <MetricBox
          label="Durum"
          value={profile.isActive ? "Aktif" : "Pasif"}
          color={profile.isActive ? "emerald" : "red"}
        />
      </div>
    </section>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
  secondary,
  mono,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | null | undefined;
  secondary?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "truncate text-sm font-medium text-foreground",
            mono && "font-mono",
          )}
          title={value ?? "—"}
        >
          {value && value.length > 0 ? value : "—"}
        </p>
        {secondary ? (
          <p className="truncate text-xs text-muted-foreground" title={secondary}>
            {secondary}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "emerald" | "amber" | "red" | "slate" | "sky" | "violet";
}) {
  const tone: Record<typeof color, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100",
    amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
    red: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-100",
    slate: "border-border bg-muted/30 text-foreground",
    sky: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100",
    violet: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-100",
  };
  return (
    <div className={cn("rounded-xl border px-3 py-2 sm:col-span-1 xl:col-span-1", tone[color])}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold leading-tight">{value}</p>
    </div>
  );
}
