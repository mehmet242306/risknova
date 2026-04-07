'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Plus, Search, ArrowLeft, Clock, CheckCircle2,
  FileEdit, AlertCircle, Trash2, Download, Share2, PenTool,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchDocuments, type DocumentRecord } from '@/lib/supabase/document-api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  taslak: { label: 'Taslak', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30', icon: FileEdit },
  hazir: { label: 'Hazır', color: 'text-green-600 bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
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
      if (!supabase) { setLoading(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile?.organization_id) { setLoading(false); return; }

      const docs = await fetchDocuments(profile.organization_id);
      setDocuments(docs);
      setLoading(false);
    }
    load();
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
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/documents')}
            className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)]"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Dokümanlarım</h1>
            <p className="text-xs text-[var(--text-secondary)]">Oluşturduğunuz ve düzenlediğiniz tüm dokümanlar</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/documents/new?mode=personal')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Yeni Doküman
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="border border-[var(--gold)]/20 rounded-xl p-3 bg-white dark:bg-[#1a2234]">
          <p className="text-xs text-[var(--text-secondary)]">Toplam</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</p>
        </div>
        <div className="border border-[var(--gold)]/20 rounded-xl p-3 bg-white dark:bg-[#1a2234]">
          <p className="text-xs text-green-600">Hazır</p>
          <p className="text-2xl font-bold text-green-600">{stats.hazir}</p>
        </div>
        <div className="border border-[var(--gold)]/20 rounded-xl p-3 bg-white dark:bg-[#1a2234]">
          <p className="text-xs text-yellow-600">Taslak</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.taslak}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Doküman ara..."
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-[var(--gold)]/20 bg-white dark:bg-[#0f172a] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50"
        />
      </div>

      {/* Document List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#1a2234] rounded-xl border border-[var(--gold)]/20">
          <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            {searchQuery ? 'Sonuç bulunamadı' : 'Henüz doküman yok'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            {searchQuery ? 'Farklı bir arama deneyin.' : 'Dokümanlar sayfasından şablonlarla veya sıfırdan doküman oluşturun.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => router.push('/documents')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] text-sm font-medium"
            >
              <FileText size={14} />
              Dokümanlar Sayfasına Git
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
                className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-[#1a2234] border border-[var(--gold)]/20 rounded-xl hover:border-[var(--gold)]/40 hover:shadow-sm cursor-pointer transition-all"
              >
                <FileText size={18} className="text-[var(--gold)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{doc.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.group_key && (
                      <span className="text-[10px] text-[var(--text-secondary)]">{doc.group_key}</span>
                    )}
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {new Date(doc.updated_at).toLocaleDateString('tr-TR')}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">v{doc.version}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>
                  <StatusIcon size={10} />
                  {st.label}
                </div>
                {doc.is_shared && (
                  <Share2 size={13} className="text-green-500 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
