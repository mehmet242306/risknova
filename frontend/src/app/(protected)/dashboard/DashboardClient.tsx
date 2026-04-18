'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileEdit,
  FileText,
  GraduationCap,
  PenTool,
  ShieldAlert,
  Siren,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/page-header';
import { PremiumIconBadge, type PremiumIconTone } from '@/components/ui/premium-icon-badge';
import { DashboardTrackingSummary } from '@/components/dashboard/DashboardTrackingSummary';

interface DashboardStats {
  riskCount: number;
  highRiskCount: number;
  documentCount: number;
  readyDocCount: number;
  draftDocCount: number;
  incidentCount: number;
  companyCount: number;
  taskCount: number;
  userName: string;
  recentDocs: Array<{ id: string; title: string; status: string; updated_at: string }>;
}

export function DashboardClient() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Dashboard açılışında yaklaşan ajanda görevleri için bildirim tarama
  // (günde bir kez, duplike önlemi var)
  useEffect(() => {
    void import("@/lib/supabase/ajanda-sync").then((m) => m.scanUpcomingAjandaTasks({ daysAhead: 7 }));
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, organization_id, full_name')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      const orgId = profile.organization_id;

      const [
        { count: riskCount },
        { data: highRisks },
        { data: documents },
        { count: incidentCount },
        { count: companyCount },
        { count: taskCount },
      ] = await Promise.all([
        supabase.from('risk_assessments').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('risk_assessments').select('id').eq('organization_id', orgId).gte('risk_level', 15),
        supabase
          .from('editor_documents')
          .select('id, title, status, updated_at')
          .eq('organization_id', orgId)
          .neq('status', 'arsiv')
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('company_workspaces').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'open'),
      ]);

      const docs = documents || [];
      setStats({
        riskCount: riskCount || 0,
        highRiskCount: highRisks?.length || 0,
        documentCount: docs.length,
        readyDocCount: docs.filter((d) => d.status === 'hazir').length,
        draftDocCount: docs.filter((d) => d.status === 'taslak').length,
        incidentCount: incidentCount || 0,
        companyCount: companyCount || 0,
        taskCount: taskCount || 0,
        userName: profile.full_name || user.email || '',
        recentDocs: docs.slice(0, 5),
      });
      setLoading(false);
    }

    void load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="animate-pulse space-y-4">
          <div className="h-36 rounded-[2rem] bg-black/5 dark:bg-white/5" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-[1.75rem] bg-black/5 dark:bg-white/5" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.95fr)]">
            <div className="h-96 rounded-[2rem] bg-black/5 dark:bg-white/5" />
            <div className="h-96 rounded-[2rem] bg-black/5 dark:bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  const s = stats!;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kontrol Merkezi"
        title={`${greeting}, ${s.userName.split(' ')[0] || 'Kullanıcı'}`}
        description="Tüm İSG süreçlerinizi tek ekrandan takip edin. Risk analizleri, dokümanlar, olaylar ve görevler burada."
        className="overflow-hidden border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,249,240,0.94))] shadow-[var(--shadow-elevated)] dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(17,26,43,0.96),rgba(11,17,31,0.98))]"
        meta={
          <>
            <span className="inline-flex items-center rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
              Canlı operasyon görünümü
            </span>
            <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              Remote Supabase senkron
            </span>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ShieldAlert}
          label="Risk Analizi"
          value={s.riskCount}
          sub={s.highRiskCount > 0 ? `${s.highRiskCount} yüksek risk` : 'Yüksek risk yok'}
          subColor={s.highRiskCount > 0 ? 'text-red-500' : 'text-emerald-600'}
          tone="risk"
          onClick={() => router.push('/risk-analysis')}
        />
        <StatCard
          icon={FileText}
          label="Doküman"
          value={s.documentCount}
          sub={`${s.readyDocCount} hazır, ${s.draftDocCount} taslak`}
          tone="cobalt"
          onClick={() => router.push('/isg-library?section=documentation')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Olay ve Kaza"
          value={s.incidentCount}
          sub="Toplam kayıt"
          tone="amber"
          onClick={() => router.push('/incidents')}
        />
        <StatCard
          icon={ClipboardCheck}
          label="Açık Görev"
          value={s.taskCount}
          sub="Takip bekleyen işler"
          tone="violet"
          onClick={() => router.push('/tasks')}
        />
      </div>

      <DashboardTrackingSummary />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.95fr)]">
        <div className="space-y-4">
          <div className="surface-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <Sparkles size={16} className="text-[var(--gold)]" />
                  Hızlı İş Akışları
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  En sık kullanılan modüllere tek tıkla geçiş yapın.
                </p>
              </div>
              <div className="hidden rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)] lg:inline-flex">
                platform
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <QuickAction icon={ShieldAlert} label="Risk Analizi" href="/risk-analysis" tone="risk" />
              <QuickAction icon={FileText} label="Dokümanlar" href="/isg-library?section=documentation" tone="cobalt" />
              <QuickAction icon={AlertTriangle} label="Olay Bildir" href="/incidents" tone="amber" />
              <QuickAction icon={Calendar} label="Planlayıcı" href="/planner" tone="emerald" />
              <QuickAction icon={GraduationCap} label="Eğitimler" href="/isg-library?section=education" tone="teal" />
              <QuickAction icon={BarChart3} label="Raporlar" href="/reports" tone="indigo" />
              <QuickAction icon={Building2} label="Firmalar" href="/companies" tone="orange" />
              <QuickAction icon={TrendingUp} label="Skor Geçmişi" href="/score-history" tone="plum" />
            </div>
          </div>

          <div className="surface-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <FileText size={16} className="text-[var(--gold)]" />
                  Son Dokümanlar
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Yakın zamanda değiştirilen içerikler burada listelenir.
                </p>
              </div>
              <button
                onClick={() => router.push('/documents/personal')}
                className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)] transition-colors hover:bg-[var(--gold)]/8"
              >
                Tümünü Gör <ChevronRight size={12} />
              </button>
            </div>

            {s.recentDocs.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-background/55 px-4 py-12 text-center text-sm text-muted-foreground">
                Henüz doküman oluşturulmadı.
              </div>
            ) : (
              <div className="space-y-2">
                {s.recentDocs.map((doc) => {
                  const stCfg: Record<string, { label: string; color: string }> = {
                    taslak: {
                      label: 'Taslak',
                      color: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300',
                    },
                    hazir: {
                      label: 'Hazır',
                      color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300',
                    },
                    onay_bekliyor: {
                      label: 'Onay',
                      color: 'text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300',
                    },
                    revizyon: {
                      label: 'Revizyon',
                      color: 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300',
                    },
                  };
                  const st = stCfg[doc.status] || stCfg.taslak;

                  return (
                    <div
                      key={doc.id}
                      onClick={() => router.push(`/documents/${doc.id}`)}
                      className="group flex items-center gap-3 rounded-[1.25rem] border border-border/80 bg-background/62 px-4 py-3 transition-all duration-200 hover:border-[var(--gold)]/30 hover:bg-[var(--gold)]/6 hover:shadow-[var(--shadow-soft)]"
                    >
                      <PremiumIconBadge icon={FileEdit} tone="gold" size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground group-hover:text-[var(--primary)]">
                          {doc.title}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(doc.updated_at).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
              <Building2 size={16} className="text-[var(--gold)]" />
              Firma Özeti
            </h2>
            <div className="rounded-[1.5rem] border border-[var(--gold)]/20 bg-[linear-gradient(135deg,rgba(200,155,91,0.12),rgba(255,255,255,0.55))] px-5 py-6 text-center dark:bg-[linear-gradient(135deg,rgba(213,177,122,0.12),rgba(17,26,43,0.45))]">
              <p className="text-4xl font-semibold tracking-tight text-[var(--primary)]">{s.companyCount}</p>
              <p className="mt-2 text-sm text-muted-foreground">Kayıtlı firma</p>
            </div>
            <button
              onClick={() => router.push('/companies')}
              className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-2xl border border-border/80 bg-background/85 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-[var(--gold)]/30 hover:bg-[var(--gold)]/8"
            >
              Firmaları Yönet <ChevronRight size={14} />
            </button>
          </div>

          <div className="surface-card">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">İSG Modülleri</h2>
              <p className="mt-1 text-sm text-muted-foreground">Platformun aktif operasyon alanları.</p>
            </div>
            <div className="space-y-2">
              <ModuleLink icon={ShieldAlert} label="Risk Analizi" desc={`${s.riskCount} değerlendirme`} href="/risk-analysis" tone="risk" />
              <ModuleLink icon={FileText} label="Dokümanlar" desc="Hazır kütüphane ve editör" href="/isg-library?section=documentation" tone="cobalt" />
              <ModuleLink icon={Siren} label="Acil Durum" desc="Plan ve tatbikatlar" href="/isg-library?section=emergency" tone="amber" />
              <ModuleLink icon={GraduationCap} label="Eğitimler" desc="Takip ve kayıt" href="/isg-library?section=education" tone="teal" />
              <ModuleLink icon={PenTool} label="Sınav ve Anket" desc="AI destekli ölçüm akışları" href="/isg-library?section=assessment" tone="indigo" />
              <ModuleLink icon={Download} label="Mevzuat" desc="Mevzuat ve rehber kütüphanesi" href="/isg-library?section=legal" tone="gold" />
            </div>
          </div>

          <div className="surface-card bg-[linear-gradient(135deg,rgba(200,155,91,0.14),rgba(255,252,247,0.92))] dark:bg-[linear-gradient(135deg,rgba(213,177,122,0.12),rgba(17,26,43,0.95))]">
            <div className="mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-[var(--gold)]" />
              <h2 className="text-base font-semibold text-foreground">Bugün</h2>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {new Date().toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {s.taskCount > 0 ? `${s.taskCount} açık görev bekliyor` : 'Tüm görevler tamamlandı'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  subColor,
  tone,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub: string;
  subColor?: string;
  tone: PremiumIconTone;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-[1.75rem] border border-border/85 bg-card px-5 py-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--gold)]/28 hover:shadow-[var(--shadow-elevated)]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <PremiumIconBadge icon={Icon} tone={tone} />
        <span className="rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          canlı
        </span>
      </div>
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className={`mt-1 text-xs ${subColor || 'text-muted-foreground'}`}>{sub}</p>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  tone: PremiumIconTone;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(href)}
      className="group flex min-h-28 flex-col items-start justify-between rounded-[1.4rem] border border-border/85 bg-background/68 p-4 text-left shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--gold)]/28 hover:bg-[var(--gold)]/6 hover:shadow-[var(--shadow-card)]"
    >
      <PremiumIconBadge icon={Icon} tone={tone} size="sm" />
      <span className="text-sm font-semibold text-foreground group-hover:text-[var(--primary)]">{label}</span>
    </button>
  );
}

function ModuleLink({
  icon: Icon,
  label,
  desc,
  href,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  href: string;
  tone: PremiumIconTone;
}) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(href)}
      className="flex cursor-pointer items-center gap-3 rounded-[1.2rem] border border-border/75 bg-background/55 px-4 py-3 transition-all duration-200 hover:border-[var(--gold)]/28 hover:bg-[var(--gold)]/6"
    >
      <PremiumIconBadge icon={Icon} tone={tone} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <ChevronRight size={14} className="text-muted-foreground" />
    </div>
  );
}
