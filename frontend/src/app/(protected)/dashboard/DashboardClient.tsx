'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert, FileText, Users, AlertTriangle, GraduationCap,
  Siren, ClipboardCheck, TrendingUp, Calendar, Building2,
  ChevronRight, Plus, BarChart3, Clock, CheckCircle2,
  FileEdit, PenTool, Download, Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/ui/page-header';

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
  recentRisks: Array<{ id: string; title: string; risk_level: number; created_at: string }>;
}

export function DashboardClient() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, organization_id, full_name')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile?.organization_id) { setLoading(false); return; }
      const orgId = profile.organization_id;

      // Parallel data fetches
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
        supabase.from('editor_documents').select('id, title, status, updated_at').eq('organization_id', orgId).neq('status', 'arsiv').order('updated_at', { ascending: false }).limit(5),
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
        recentRisks: [],
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const s = stats!;
  const greeting = new Date().getHours() < 12 ? 'Günaydın' : new Date().getHours() < 18 ? 'İyi günler' : 'İyi akşamlar';

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="Kontrol Merkezi"
        title={`${greeting}, ${s.userName.split(' ')[0] || 'Kullanıcı'}`}
        description="Tüm İSG süreçlerinizi tek ekrandan takip edin. Risk analizleri, dokümanlar, olaylar ve görevler burada."
      />

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 mb-6">
        <StatCard
          icon={ShieldAlert} label="Risk Analizi" value={s.riskCount}
          sub={s.highRiskCount > 0 ? `${s.highRiskCount} yüksek risk` : 'Yüksek risk yok'}
          subColor={s.highRiskCount > 0 ? 'text-red-500' : 'text-green-500'}
          color="text-red-500 bg-red-50 dark:bg-red-900/20"
          onClick={() => router.push('/risk-analysis')}
        />
        <StatCard
          icon={FileText} label="Doküman" value={s.documentCount}
          sub={`${s.readyDocCount} hazır, ${s.draftDocCount} taslak`}
          color="text-blue-500 bg-blue-50 dark:bg-blue-900/20"
          onClick={() => router.push('/documents')}
        />
        <StatCard
          icon={AlertTriangle} label="Olay/Kaza" value={s.incidentCount}
          sub="Toplam kayıt"
          color="text-amber-500 bg-amber-50 dark:bg-amber-900/20"
          onClick={() => router.push('/incidents')}
        />
        <StatCard
          icon={ClipboardCheck} label="Açık Görev" value={s.taskCount}
          sub="Tamamlanmayı bekliyor"
          color="text-purple-500 bg-purple-50 dark:bg-purple-900/20"
          onClick={() => router.push('/tasks')}
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left: Quick Actions + Recent Docs */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-[#1a2234] border border-[var(--gold)]/20 rounded-xl p-5">
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-[var(--gold)]" />
              Hızlı İşlemler
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <QuickAction icon={ShieldAlert} label="Risk Analizi" href="/risk-analysis" color="text-red-500" />
              <QuickAction icon={FileText} label="Doküman Oluştur" href="/documents" color="text-blue-500" />
              <QuickAction icon={AlertTriangle} label="Olay Bildir" href="/incidents" color="text-amber-500" />
              <QuickAction icon={Calendar} label="Planlayıcı" href="/planner" color="text-green-500" />
              <QuickAction icon={GraduationCap} label="Eğitimler" href="/documents" color="text-teal-500" />
              <QuickAction icon={BarChart3} label="Raporlar" href="/reports" color="text-indigo-500" />
              <QuickAction icon={Building2} label="Firmalar" href="/companies" color="text-orange-500" />
              <QuickAction icon={TrendingUp} label="Skor Geçmişi" href="/score-history" color="text-purple-500" />
            </div>
          </div>

          {/* Recent Documents */}
          <div className="bg-white dark:bg-[#1a2234] border border-[var(--gold)]/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <FileText size={16} className="text-[var(--gold)]" />
                Son Dokümanlar
              </h2>
              <button
                onClick={() => router.push('/documents/personal')}
                className="text-[11px] text-[var(--gold)] hover:underline flex items-center gap-1"
              >
                Tümünü Gör <ChevronRight size={12} />
              </button>
            </div>
            {s.recentDocs.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] py-4 text-center">Henüz doküman oluşturulmadı.</p>
            ) : (
              <div className="space-y-1.5">
                {s.recentDocs.map((doc) => {
                  const stCfg: Record<string, { label: string; color: string }> = {
                    taslak: { label: 'Taslak', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
                    hazir: { label: 'Hazır', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
                    onay_bekliyor: { label: 'Onay', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
                    revizyon: { label: 'Revizyon', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
                  };
                  const st = stCfg[doc.status] || stCfg.taslak;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => router.push(`/documents/${doc.id}`)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--gold)]/5 cursor-pointer transition-colors"
                    >
                      <FileEdit size={14} className="text-[var(--text-secondary)] shrink-0" />
                      <span className="flex-1 text-xs text-[var(--text-primary)] truncate">{doc.title}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {new Date(doc.updated_at).toLocaleDateString('tr-TR')}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${st.color}`}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Module Summary */}
        <div className="space-y-4">
          {/* Company Info */}
          <div className="bg-white dark:bg-[#1a2234] border border-[var(--gold)]/20 rounded-xl p-5">
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Building2 size={16} className="text-[var(--gold)]" />
              Firma Bilgisi
            </h2>
            <div className="text-center py-2">
              <p className="text-3xl font-bold text-[var(--gold)]">{s.companyCount}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Kayıtlı Firma</p>
            </div>
            <button
              onClick={() => router.push('/companies')}
              className="w-full mt-3 px-3 py-2 text-xs font-medium border border-[var(--gold)]/20 rounded-lg text-[var(--text-primary)] hover:bg-[var(--gold)]/10 transition-colors flex items-center justify-center gap-1"
            >
              Firmaları Yönet <ChevronRight size={12} />
            </button>
          </div>

          {/* İSG Modülleri */}
          <div className="bg-white dark:bg-[#1a2234] border border-[var(--gold)]/20 rounded-xl p-5">
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">İSG Modülleri</h2>
            <div className="space-y-1.5">
              <ModuleLink icon={ShieldAlert} label="Risk Analizi" desc={`${s.riskCount} değerlendirme`} href="/risk-analysis" />
              <ModuleLink icon={FileText} label="Dokümanlar" desc="101 şablon hazır" href="/documents" />
              <ModuleLink icon={Siren} label="Acil Durum" desc="Plan ve tatbikatlar" href="/documents" />
              <ModuleLink icon={GraduationCap} label="Eğitimler" desc="Takip ve kayıt" href="/documents" />
              <ModuleLink icon={PenTool} label="E-İmza" desc="Dijital imzalama" href="/documents" />
              <ModuleLink icon={Download} label="Export" desc="Word, PDF çıktı" href="/documents" />
            </div>
          </div>

          {/* Takvim özeti */}
          <div className="bg-[var(--gold)]/5 border border-[var(--gold)]/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-[var(--gold)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Bugün</h2>
            </div>
            <p className="text-lg font-bold text-[var(--gold)]">
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {s.taskCount > 0 ? `${s.taskCount} açık görev bekliyor` : 'Tüm görevler tamamlandı'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, subColor, color, onClick }: {
  icon: React.ElementType; label: string; value: number; sub: string; subColor?: string; color: string; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="border border-[var(--gold)]/20 rounded-xl p-4 bg-white dark:bg-[#1a2234] shadow-sm cursor-pointer hover:border-[var(--gold)]/40 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${color}`}><Icon size={14} /></div>
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className={`text-[10px] mt-0.5 ${subColor || 'text-[var(--text-secondary)]'}`}>{sub}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, href, color }: {
  icon: React.ElementType; label: string; href: string; color: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-[var(--gold)]/15 hover:border-[var(--gold)]/30 hover:bg-[var(--gold)]/5 transition-colors"
    >
      <Icon size={18} className={color} />
      <span className="text-[10px] font-medium text-[var(--text-primary)]">{label}</span>
    </button>
  );
}

function ModuleLink({ icon: Icon, label, desc, href }: {
  icon: React.ElementType; label: string; desc: string; href: string;
}) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(href)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--gold)]/5 cursor-pointer transition-colors"
    >
      <Icon size={14} className="text-[var(--gold)] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-[var(--text-primary)]">{label}</span>
        <span className="text-[10px] text-[var(--text-secondary)] ml-2">{desc}</span>
      </div>
      <ChevronRight size={12} className="text-[var(--text-secondary)]" />
    </div>
  );
}
