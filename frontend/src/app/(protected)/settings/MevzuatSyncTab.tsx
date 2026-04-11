'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// Types
interface LegalDocument {
  id: string;
  title: string;
  doc_number: string;
  doc_type: 'law' | 'regulation' | 'notification';
  source_url: string | null;
  last_updated_at: string | null;
  chunk_count?: number;
  sync_status?: 'idle' | 'syncing' | 'success' | 'error';
}

interface SyncStats {
  total_documents: number;
  synced_documents: number;
  total_chunks: number;
  with_embeddings: number;
  normal_articles: number;
  gecici_articles: number;
  ek_articles: number;
  mukerrer_articles: number;
  mulga_articles: number;
}

type TabType = 'overview' | 'documents' | 'sync' | 'embed';

export default function MevzuatSyncTab() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'law' | 'regulation' | 'synced' | 'not_synced'>('all');

  // Fetch documents and stats
  const fetchData = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    try {
      // Fetch documents with chunk counts via relation
      const { data: docs, error: docsError } = await supabase
        .from('legal_documents')
        .select(`
          id,
          title,
          doc_number,
          doc_type,
          source_url,
          last_updated_at,
          legal_chunks(count)
        `)
        .order('doc_type')
        .order('title');

      if (docsError) throw docsError;

      const docsWithCounts = docs?.map(doc => ({
        ...doc,
        chunk_count: (doc as any).legal_chunks?.[0]?.count || 0,
        sync_status: 'idle' as const
      })) || [];

      setDocuments(docsWithCounts);

      // Stats via efficient count queries (no large data transfer)
      const [totalChunksRes, withEmbRes, normalRes, geciciRes, ekRes, mukerrerRes, mulgaRes] = await Promise.all([
        supabase.from('legal_chunks').select('id', { count: 'exact', head: true }),
        supabase.from('legal_chunks').select('id', { count: 'exact', head: true }).not('embedding', 'is', null),
        supabase.from('legal_chunks').select('id', { count: 'exact', head: true }).eq('article_type', 'normal'),
        supabase.from('legal_chunks').select('id', { count: 'exact', head: true }).eq('article_type', 'gecici'),
        supabase.from('legal_chunks').select('id', { count: 'exact', head: true }).eq('article_type', 'ek'),
        supabase.from('legal_chunks').select('id', { count: 'exact', head: true }).eq('article_type', 'mukerrer'),
        supabase.from('legal_chunks').select('id', { count: 'exact', head: true }).eq('is_repealed', true),
      ]);

      setStats({
        total_documents: docsWithCounts.length,
        synced_documents: docsWithCounts.filter(d => d.chunk_count > 0).length,
        total_chunks: totalChunksRes.count || 0,
        with_embeddings: withEmbRes.count || 0,
        normal_articles: normalRes.count || 0,
        gecici_articles: geciciRes.count || 0,
        ek_articles: ekRes.count || 0,
        mukerrer_articles: mukerrerRes.count || 0,
        mulga_articles: mulgaRes.count || 0,
      });

    } catch (error) {
      console.error('Veri yuklenirken hata:', error);
      setMessage({ type: 'error', text: 'Veriler yuklenirken hata olustu.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync single document
  const syncDocument = async (doc: LegalDocument) => {
    if (!doc.source_url) {
      setMessage({ type: 'error', text: 'Bu mevzuatin kaynak URL\'si bulunmuyor.' });
      return;
    }

    setSyncing(doc.id);
    setDocuments(prev => prev.map(d =>
      d.id === doc.id ? { ...d, sync_status: 'syncing' } : d
    ));

    try {
      const response = await fetch('/api/sync/mevzuat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          documentId: doc.id
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Senkronizasyon basarisiz');
      }

      setDocuments(prev => prev.map(d =>
        d.id === doc.id ? { ...d, sync_status: 'success', chunk_count: result.chunksCreated || d.chunk_count } : d
      ));

      setMessage({
        type: 'success',
        text: `${doc.title} basariyla senkronize edildi. ${result.chunksCreated || 0} madde eklendi.`
      });

      setTimeout(() => fetchData(), 2000);
    } catch (error) {
      console.error('Sync error:', error);
      setDocuments(prev => prev.map(d =>
        d.id === doc.id ? { ...d, sync_status: 'error' } : d
      ));
      setMessage({
        type: 'error',
        text: `Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
      });
    } finally {
      setSyncing(null);
    }
  };

  // Sync all documents
  const syncAllDocuments = async () => {
    setSyncingAll(true);
    setMessage({ type: 'info', text: 'Tum mevzuatlar senkronize ediliyor...' });

    try {
      const response = await fetch('/api/sync/mevzuat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Toplu senkronizasyon basarisiz');
      }

      setMessage({
        type: 'success',
        text: `Toplu senkronizasyon tamamlandi. ${result.processed || 0} mevzuat islendi.`
      });

      fetchData();
    } catch (error) {
      console.error('Sync all error:', error);
      setMessage({
        type: 'error',
        text: `Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
      });
    } finally {
      setSyncingAll(false);
    }
  };

  // Generate embeddings (disabled — full-text search is used instead)
  const generateEmbeddings = async () => {
    setMessage({ type: 'info', text: 'Embedding ozelligi yakin zamanda eklenecek. Su anda full-text search ile arama yapabilirsiniz.' });
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    if (filter === 'all') return true;
    if (filter === 'law') return doc.doc_type === 'law';
    if (filter === 'regulation') return doc.doc_type === 'regulation';
    if (filter === 'synced') return (doc.chunk_count || 0) > 0;
    if (filter === 'not_synced') return (doc.chunk_count || 0) === 0;
    return true;
  });

  // Get document type label
  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case 'law': return 'Kanun';
      case 'regulation': return 'Yonetmelik';
      case 'notification': return 'Teblig';
      default: return type;
    }
  };

  // Get status badge
  const getStatusBadge = (doc: LegalDocument) => {
    if (doc.sync_status === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Senkronize ediliyor
        </span>
      );
    }
    if ((doc.chunk_count || 0) > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {doc.chunk_count} madde
        </span>
      );
    }
    if (!doc.source_url) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Link yok
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        Bekliyor
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Mevzuat RAG Sistemi</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ISG mevzuatlarini tarayin, senkronize edin ve AI icin hazirlayin
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'Genel Bakis', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
          { id: 'documents', label: 'Mevzuatlar', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
          { id: 'sync', label: 'Senkronizasyon', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
          { id: 'embed', label: 'Embedding', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30' :
          'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30'
        }`}>
          <span className="flex-1">{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Yukleniyor...
          </div>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Toplam Mevzuat" value={stats.total_documents} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="blue" />
              <StatCard label="Senkronize" value={stats.synced_documents} subtext={`/ ${stats.total_documents}`} icon="M5 13l4 4L19 7" color="emerald" />
              <StatCard label="Toplam Madde" value={stats.total_chunks} icon="M4 6h16M4 10h16M4 14h16M4 18h16" color="purple" />
              <StatCard label="Embedding Hazir" value={stats.with_embeddings} subtext={`/ ${stats.total_chunks}`} icon="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" color="amber" />

              {/* Article type breakdown */}
              <div className="col-span-2 md:col-span-4 p-4 bg-card rounded-xl border border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">Madde Turu Dagilimi</h3>
                <div className="grid grid-cols-5 gap-3">
                  <MiniStat label="Normal" value={stats.normal_articles} color="blue" />
                  <MiniStat label="Gecici" value={stats.gecici_articles} color="amber" />
                  <MiniStat label="Ek" value={stats.ek_articles} color="emerald" />
                  <MiniStat label="Mukerrer" value={stats.mukerrer_articles} color="purple" />
                  <MiniStat label="Mulga" value={stats.mulga_articles} color="red" />
                </div>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'all', label: 'Tumu' },
                  { id: 'law', label: 'Kanunlar' },
                  { id: 'regulation', label: 'Yonetmelikler' },
                  { id: 'synced', label: 'Senkronize' },
                  { id: 'not_synced', label: 'Bekleyenler' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id as typeof filter)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                      filter === f.id
                        ? 'bg-blue-600 text-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Document List */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Mevzuat</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tur</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Numara</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Durum</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Islem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredDocuments.map(doc => (
                        <tr key={doc.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-foreground truncate max-w-xs" title={doc.title}>
                              {doc.title}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                              doc.doc_type === 'law'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                                : doc.doc_type === 'regulation'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                            }`}>
                              {getDocTypeLabel(doc.doc_type)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{doc.doc_number}</td>
                          <td className="px-4 py-3">{getStatusBadge(doc)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {doc.source_url && (
                                <a
                                  href={doc.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-muted-foreground hover:text-blue-400 transition-colors"
                                  title="Kaynagi ac"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  syncDocument(doc);
                                }}
                                disabled={!doc.source_url || syncing === doc.id}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                  !doc.source_url
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : syncing === doc.id
                                    ? 'bg-blue-600/50 text-blue-300 cursor-wait'
                                    : 'bg-blue-600 text-foreground hover:bg-blue-500'
                                }`}
                              >
                                {syncing === doc.id ? 'Senkronize ediliyor...' : 'Senkronize Et'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredDocuments.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    Bu filtreye uygun mevzuat bulunamadi.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Bulk Sync Card */}
                <div className="p-6 bg-card rounded-xl border border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-foreground">Toplu Senkronizasyon</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Tum mevzuatlari mevzuat.gov.tr&apos;den tarayin ve veritabanina kaydedin.
                      </p>
                      <button
                        onClick={syncAllDocuments}
                        disabled={syncingAll}
                        className={`mt-4 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                          syncingAll
                            ? 'bg-blue-600/50 text-blue-300 cursor-wait'
                            : 'bg-blue-600 text-foreground hover:bg-blue-500'
                        }`}
                      >
                        {syncingAll ? (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Senkronize ediliyor...
                          </span>
                        ) : (
                          'Tumunu Senkronize Et'
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sync Status Card */}
                <div className="p-6 bg-card rounded-xl border border-border">
                  <h3 className="text-lg font-medium text-foreground mb-4">Senkronizasyon Durumu</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Senkronize Edilmis</span>
                      <span className="text-sm font-medium text-emerald-400">
                        {documents.filter(d => (d.chunk_count || 0) > 0).length} / {documents.length}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{
                          width: documents.length > 0
                            ? `${(documents.filter(d => (d.chunk_count || 0) > 0).length / documents.length) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Link yok: {documents.filter(d => !d.source_url).length}</span>
                      <span>Bekleyen: {documents.filter(d => d.source_url && (d.chunk_count || 0) === 0).length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-amber-800 dark:text-amber-200/80">
                    <strong>Ipucu:</strong> Senkronizasyon sirasinda mevzuat.gov.tr&apos;den HTML icerik cekilir
                    ve madde madde ayristirilir. Her madde icin referans formati otomatik olusturulur
                    (orn: &quot;6331 sayili Kanun&apos;un 13 uncu maddesi&quot;).
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Embed Tab */}
          {activeTab === 'embed' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Embedding Card */}
                <div className="p-6 bg-card rounded-xl border border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-foreground">Embedding Olustur</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Embedding ozelligi yakin zamanda eklenecek. Su anda full-text search ile arama yapabilirsiniz.
                      </p>
                      <button
                        disabled={true}
                        className="mt-4 px-4 py-2 text-sm font-medium rounded-lg transition-all bg-purple-600/30 text-purple-300 cursor-not-allowed"
                      >
                        Embedding Olustur (Yakin Zamanda)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Embedding Status Card */}
                <div className="p-6 bg-card rounded-xl border border-border">
                  <h3 className="text-lg font-medium text-foreground mb-4">Embedding Durumu</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Hazir</span>
                      <span className="text-sm font-medium text-purple-400">
                        {stats?.with_embeddings || 0} / {stats?.total_chunks || 0}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{
                          width: stats?.total_chunks
                            ? `${((stats?.with_embeddings || 0) / stats.total_chunks) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Eksik: {(stats?.total_chunks || 0) - (stats?.with_embeddings || 0)} madde
                    </div>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800 dark:text-blue-200/80">
                    <strong>Bilgi:</strong> Embedding ozelligi yakin zamanda eklenecek.
                    Su anda full-text search ile arama yapabilirsiniz. Mevzuat maddeleri uzerinde
                    tam metin arama desteklenmektedir.
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  subtext,
  icon,
  color
}: {
  label: string;
  value: number;
  subtext?: string;
  icon: string;
  color: 'blue' | 'emerald' | 'purple' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
  };

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{value.toLocaleString()}</span>
            {subtext && <span className="text-sm text-muted-foreground">{subtext}</span>}
          </div>
          <div className="text-xs text-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

// Mini Stat Component
function MiniStat({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'purple' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    purple: 'text-purple-600 dark:text-purple-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400'
  };

  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${colorClasses[color]}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
