'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActivitySquare,
  AlertCircle,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Gauge,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  getOrganizationTrackingSummary,
  type OrganizationTrackingSummary,
} from '@/lib/supabase/tracking-api';
import { PremiumIconBadge, type PremiumIconTone } from '@/components/ui/premium-icon-badge';

type MetricDef = {
  key: keyof Pick<
    OrganizationTrackingSummary,
    'openActionCount' | 'expiringTrainingCount' | 'overduePeriodicControlCount' | 'upcomingCommitteeCount' | 'healthExamsDueCount'
  >;
  label: string;
  sub: string;
  icon: React.ElementType;
  tone: PremiumIconTone;
  warnWhenPositive: boolean;
};

const METRICS: MetricDef[] = [
  {
    key: 'openActionCount',
    label: 'Acik Aksiyon',
    sub: 'Risk tespitleri + DOF + gorevler',
    icon: AlertCircle,
    tone: 'risk',
    warnWhenPositive: true,
  },
  {
    key: 'expiringTrainingCount',
    label: 'Yaklasan Egitim',
    sub: '30 gun icinde',
    icon: GraduationCap,
    tone: 'teal',
    warnWhenPositive: false,
  },
  {
    key: 'overduePeriodicControlCount',
    label: 'Geciken Kontrol',
    sub: 'Periyodik kontrol suresi gecti',
    icon: Gauge,
    tone: 'amber',
    warnWhenPositive: true,
  },
  {
    key: 'upcomingCommitteeCount',
    label: 'Bekleyen Kurul',
    sub: 'Planli ISG kurul toplantilari',
    icon: ClipboardList,
    tone: 'cobalt',
    warnWhenPositive: false,
  },
  {
    key: 'healthExamsDueCount',
    label: 'Yaklasan Muayene',
    sub: '30 gun icinde saglik gozetimi',
    icon: ShieldCheck,
    tone: 'violet',
    warnWhenPositive: false,
  },
];

export function DashboardTrackingSummary() {
  const router = useRouter();
  const [data, setData] = useState<OrganizationTrackingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const summary = await getOrganizationTrackingSummary();
      if (!cancelled) {
        setData(summary);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="surface-card">
        <div className="mb-4 h-5 w-40 animate-pulse rounded-full bg-black/5 dark:bg-white/5" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[1.25rem] bg-black/5 dark:bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.companyCount === 0) {
    return (
      <div className="surface-card">
        <div className="mb-3 flex items-center gap-2">
          <ActivitySquare size={16} className="text-[var(--gold)]" />
          <h2 className="text-base font-semibold text-foreground">Takip Ozeti</h2>
        </div>
        <div className="rounded-[1.5rem] border border-dashed border-border bg-background/55 px-4 py-10 text-center text-sm text-muted-foreground">
          Henuz firma tanimlanmamis. Takip metrikleri firma eklendiginde burada gorunur.
        </div>
      </div>
    );
  }

  const totalActionable =
    data.openActionCount +
    data.expiringTrainingCount +
    data.overduePeriodicControlCount +
    data.upcomingCommitteeCount +
    data.healthExamsDueCount;

  return (
    <div className="surface-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ActivitySquare size={16} className="text-[var(--gold)]" />
            Takip Ozeti
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tum firmalardan roll-up. {data.companyCount} firma izleniyor, {totalActionable} aksiyon bekliyor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/companies')}
          className="hidden items-center gap-1 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)] transition-colors hover:bg-[var(--gold)]/8 sm:inline-flex"
        >
          Firmalar <ChevronRight size={12} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {METRICS.map((m) => {
          const value = data[m.key];
          const warn = m.warnWhenPositive && value > 0;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => router.push('/companies')}
              className={`group flex flex-col items-start gap-3 rounded-[1.25rem] border px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] ${
                warn
                  ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                  : 'border-border/80 bg-background/62 hover:border-[var(--gold)]/28 hover:bg-[var(--gold)]/6'
              }`}
            >
              <PremiumIconBadge icon={m.icon} tone={m.tone} size="sm" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {m.label}
                </p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    warn ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                  }`}
                >
                  {value}
                </p>
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{m.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      {data.topCompanies.length > 0 && (
        <div className="mt-5 rounded-[1.5rem] border border-border/75 bg-background/55 px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Users size={14} className="text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Oncelik Bekleyen Firmalar
            </p>
          </div>
          <div className="space-y-1.5">
            {data.topCompanies.map((c) => {
              const total = c.openActions + c.expiringTrainings + c.overdueControls;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/companies/${c.id}?tab=tracking`)}
                  className="flex w-full items-center gap-3 rounded-[1rem] border border-transparent bg-background/70 px-3 py-2.5 text-left transition-colors hover:border-[var(--gold)]/30 hover:bg-[var(--gold)]/6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{c.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {c.openActions > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                          <AlertCircle size={10} /> {c.openActions} aksiyon
                        </span>
                      )}
                      {c.expiringTrainings > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <GraduationCap size={10} /> {c.expiringTrainings} egitim
                        </span>
                      )}
                      {c.overdueControls > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <CalendarClock size={10} /> {c.overdueControls} kontrol
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-border/80 bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">
                    {total}
                    <ChevronRight size={12} className="text-muted-foreground" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
