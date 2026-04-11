'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  ArrowLeft,
  Clock,
  CheckCircle2,
  FileEdit,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { PremiumIconBadge } from '@/components/ui/premium-icon-badge';
import { createClient } from '@/lib/supabase/client';
import { fetchDocuments, type DocumentRecord } from '@/lib/supabase/document-api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  taslak: { label: 'Taslak', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30', icon: FileEdit },
  hazir: { label: 'Hazir', color: 'text-green-600 bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  onay_bekliyor: { label: 'Onay Bekliyor', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', icon: Clock },
  revizyon: { label: 'Revizyon', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30', icon: AlertCircle },
};

export function PersonalDocumentsClient() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
        .select('organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      const docs = await fetchDocuments(profile.organization_id);
      setDocuments(docs);
      setLoading(false);
    }

    void load();
  }, []);

  const filtered = searchQuery
    ? documents.filter((d) => d.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : documents;

  const stats = {
    total: documents.length,
    hazir: documents.filter((d) => d.status === 'hazir').length,
    taslak: documents.filter((d) => d.status === 'taslak').length,
  };

  if (loading) {
    return (
      <div className="w-full p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 w-1/3 rounded-xl bg-gray-200 dark:bg-gray-700" />
          <div className="h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/documents')}
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
          >
            <PremiumIconBadge icon={ArrowLeft} tone="neutral" size="xs" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Dokumanlarim</h1>
            <p className="text-xs text-[var(--text-secondary)]">Olusturdugunuz ve duzenlediginiz tum dokumanlar</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/documents/new?mode=personal')}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--gold-hover)]"
        >
          <PremiumIconBadge icon={Plus} tone="gold" size="xs" />
          Yeni Dokuman
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--gold)]/20 bg-white p-3 dark:bg-[#1a2234]">
          <div className="mb-1 flex items-center gap-2">
            <PremiumIconBadge icon={FileText} tone="cobalt" size="xs" />
            <p className="text-xs text-[var(--text-secondary)]">Toplam</p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-[var(--gold)]/20 bg-white p-3 dark:bg-[#1a2234]">
          <div className="mb-1 flex items-center gap-2">
            <PremiumIconBadge icon={CheckCircle2} tone="success" size="xs" />
            <p className="text-xs text-green-600">Hazir</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.hazir}</p>
        </div>
        <div className="rounded-xl border border-[var(--gold)]/20 bg-white p-3 dark:bg-[#1a2234]">
          <div className="mb-1 flex items-center gap-2">
            <PremiumIconBadge icon={FileEdit} tone="amber" size="xs" />
            <p className="text-xs text-yellow-600">Taslak</p>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.taslak}</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Dokuman ara..."
          className="w-full rounded-lg border border-[var(--gold)]/20 bg-white py-2.5 pl-9 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50 dark:bg-[#0f172a]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--gold)]/20 bg-white py-16 text-center dark:bg-[#1a2234]">
          <PremiumIconBadge icon={FileText} tone="neutral" size="lg" className="mx-auto mb-3" />
          <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
            {searchQuery ? 'Sonuc bulunamadi' : 'Henuz dokuman yok'}
          </h3>
          <p className="mb-4 text-xs text-[var(--text-secondary)]">
            {searchQuery ? 'Farkli bir arama deneyin.' : 'Dokumanlar sayfasindan sablonlarla veya sifirdan dokuman olusturun.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => router.push('/documents')}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--gold-hover)]"
            >
              <PremiumIconBadge icon={FileText} tone="gold" size="xs" />
              Dokumanlar Sayfasina Git
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const st = STATUS_CONFIG[doc.status] || STATUS_CONFIG.taslak;
            const StatusIcon = st.icon;

            return (
              <div
                key={doc.id}
                onClick={() => router.push(`/documents/${doc.id}`)}
                className="flex cursor-pointer items-center gap-4 rounded-xl border border-[var(--gold)]/20 bg-white px-4 py-3 transition-all hover:border-[var(--gold)]/40 hover:shadow-sm dark:bg-[#1a2234]"
              >
                <PremiumIconBadge icon={FileText} tone="gold" size="sm" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{doc.title}</h3>
                  <div className="mt-0.5 flex items-center gap-2">
                    {doc.group_key ? (
                      <span className="text-[10px] text-[var(--text-secondary)]">{doc.group_key}</span>
                    ) : null}
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {new Date(doc.updated_at).toLocaleDateString('tr-TR')}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">v{doc.version}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.color}`}>
                  <StatusIcon size={10} />
                  {st.label}
                </div>
                {doc.is_shared ? <PremiumIconBadge icon={Share2} tone="success" size="xs" /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
