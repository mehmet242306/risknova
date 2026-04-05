'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Plus, Search, ChevronDown, ChevronRight,
  Clock, CheckCircle2, AlertCircle, FileEdit, Sparkles,
  UserCheck, Users, GraduationCap, ShieldAlert, Siren,
  AlertTriangle, Mail, ClipboardList, BookOpen, Eye as SearchIcon,
  UserCog, CalendarCheck, UserPlus, Award, MapPin, Wrench,
  Clock as ClockIcon, FolderOpen, Flame, Heart,
  Building2, User, FileSignature,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DOCUMENT_GROUPS, getTotalDocumentCount, type DocumentGroup, type DocumentGroupItem } from '@/lib/document-groups';
import { createClient } from '@/lib/supabase/client';
import { fetchDocuments, type DocumentRecord } from '@/lib/supabase/document-api';

const GROUP_ICONS: Record<string, React.ElementType> = {
  UserCheck, Users, GraduationCap, ShieldAlert, Siren,
  AlertTriangle, Mail, ClipboardList, BookOpen, Search: SearchIcon,
  UserCog, CalendarCheck, UserPlus, Award, MapPin, Wrench,
  Clock: ClockIcon, FolderOpen, Flame, Heart,
};

const STATUS_CONFIG = {
  taslak: { label: 'Taslak', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: FileEdit },
  hazir: { label: 'Hazır', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  onay_bekliyor: { label: 'Onay Bekliyor', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  revizyon: { label: 'Revizyon', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
  eksik: { label: 'Henüz Oluşturulmadı', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500', icon: FileText },
};

interface CompanyOption {
  id: string;
  workspace_id: string;
  name: string;
  sector: string;
  hazard_class: string;
  city: string;
}

export function DocumentsClient() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Firma seçimi
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Load org + companies + documents
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
      setOrgId(profile.organization_id);

      // Firmaları yükle
      const { data: workspaces } = await supabase
        .from('company_workspaces')
        .select('id, company_identity_id, display_name')
        .eq('organization_id', profile.organization_id);

      if (workspaces && workspaces.length > 0) {
        const identityIds = workspaces.map((w) => w.company_identity_id);
        const { data: identities } = await supabase
          .from('company_identities')
          .select('id, official_name, sector, hazard_class, city')
          .in('id', identityIds);

        if (identities) {
          const companyList: CompanyOption[] = identities.map((c) => {
            const ws = workspaces.find((w) => w.company_identity_id === c.id);
            return {
              id: c.id,
              workspace_id: ws?.id || '',
              name: c.official_name || ws?.display_name || '',
              sector: c.sector || '',
              hazard_class: c.hazard_class || '',
              city: c.city || '',
            };
          });
          setCompanies(companyList);
          if (companyList.length > 0) setSelectedCompanyId(companyList[0].id);
        }
      }

      const docs = await fetchDocuments(profile.organization_id);
      setDocuments(docs);
      setLoading(false);
    }
    load();
  }, []);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const stats = useMemo(() => {
    const total = getTotalDocumentCount();
    const hazir = documents.filter((d) => d.status === 'hazir').length;
    const taslak = documents.filter((d) => d.status === 'taslak').length;
    const eksik = total - documents.length;
    return { total, hazir, taslak, eksik };
  }, [documents]);

  const findDocForItem = (group: DocumentGroup, item: DocumentGroupItem): DocumentRecord | undefined => {
    return documents.find((d) => d.group_key === group.key && d.title === item.title);
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return DOCUMENT_GROUPS;
    const q = searchQuery.toLowerCase();
    return DOCUMENT_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.title.toLowerCase().includes(q) || group.title.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [searchQuery]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpandedGroups(new Set(DOCUMENT_GROUPS.map((g) => g.key)));
  const collapseAll = () => setExpandedGroups(new Set());

  const handleCreateDocument = (group: DocumentGroup, item: DocumentGroupItem) => {
    const params = new URLSearchParams({
      group: group.key,
      title: item.title,
      templateId: item.id,
      mode: 'new',
    });
    if (selectedCompanyId) params.set('companyId', selectedCompanyId);
    router.push(`/documents/new?${params.toString()}`);
  };

  const handleOpenDocument = (doc: DocumentRecord) => {
    router.push(`/documents/${doc.id}`);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="grid grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        eyebrow="İSG Doküman Yönetimi"
        title="Doküman Hazırlama"
        description="Firma seçin, şablonu tıklayın — doküman firma bilgileriyle hazır gelir. AI destekli düzenleme ve Word export."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/documents/new?mode=personal')}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--card-border)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-sm font-medium text-[var(--text-primary)]"
            >
              <User size={16} />
              Kişisel Doküman
            </button>
            <button
              onClick={() => router.push('/documents/new')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Yeni Doküman
            </button>
          </div>
        }
      />

      {/* Firma Seçici */}
      <div className="mt-6 mb-5 p-4 border border-[var(--card-border)] rounded-xl bg-white dark:bg-[#1e293b] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[var(--gold)]" />
            <label className="text-sm font-semibold text-[var(--text-primary)]">Firma Seçin</label>
          </div>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 text-sm rounded-lg border border-[var(--card-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50"
          >
            {companies.length === 0 && <option value="">Firma bulunamadı</option>}
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {selectedCompany && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)]">{selectedCompany.sector || 'Sektör belirtilmemiş'}</span>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)]">{selectedCompany.hazard_class || 'Sınıf belirtilmemiş'}</span>
              <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)]">{selectedCompany.city || ''}</span>
            </div>
          )}
        </div>
        {companies.length === 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Henüz firma eklenmemiş. Firmalar sayfasından firma ekleyerek doküman hazırlamaya başlayabilirsiniz.
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Toplam Belge" value={stats.total} icon={FileText} color="text-blue-600" />
        <StatCard label="Hazır" value={stats.hazir} icon={CheckCircle2} color="text-green-600" />
        <StatCard label="Taslak" value={stats.taslak} icon={FileEdit} color="text-yellow-600" />
        <StatCard label="Oluşturulmamış" value={stats.eksik} icon={AlertCircle} color="text-gray-400" />
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) expandAll(); }}
            placeholder="Doküman veya grup ara..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--card-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50"
          />
        </div>
        <button
          onClick={expandedGroups.size > 0 ? collapseAll : expandAll}
          className="px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--card-border)] rounded-lg transition-colors"
        >
          {expandedGroups.size > 0 ? 'Tümünü Kapat' : 'Tümünü Aç'}
        </button>
      </div>

      {/* Document Groups */}
      <div className="space-y-2">
        {filteredGroups.map((group) => {
          const Icon = GROUP_ICONS[group.icon] || FileText;
          const isExpanded = expandedGroups.has(group.key);
          const groupDocs = documents.filter((d) => d.group_key === group.key);
          const completedCount = groupDocs.filter((d) => d.status === 'hazir').length;
          const hasP1 = group.items.some((i) => i.isP1);

          return (
            <div key={group.key} className="border border-[var(--card-border)] rounded-xl overflow-hidden bg-white dark:bg-[#1e293b] shadow-sm">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)]/50 transition-colors text-left"
              >
                <span className={`shrink-0 ${group.color}`}><Icon size={20} /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{group.title}</span>
                    {hasP1 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--gold)]/10 text-[var(--gold)] rounded">
                        <Sparkles size={10} /> Şablon Hazır
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{completedCount}/{group.items.length} belge hazır</span>
                </div>
                <div className="hidden sm:flex items-center gap-2 w-24">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${group.items.length > 0 ? (completedCount / group.items.length) * 100 : 0}%` }} />
                  </div>
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-[var(--text-secondary)] shrink-0" /> : <ChevronRight size={16} className="text-[var(--text-secondary)] shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-[var(--card-border)]">
                  {group.items.map((item) => {
                    const doc = findDocForItem(group, item);
                    const statusKey = doc ? doc.status : 'eksik';
                    const cfg = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.eksik;
                    const StatusIcon = cfg.icon;

                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-secondary)]/30 transition-colors border-b border-[var(--card-border)] last:border-b-0">
                        <StatusIcon size={14} className={cfg.color.includes('green') ? 'text-green-500' : cfg.color.includes('yellow') ? 'text-yellow-500' : cfg.color.includes('blue') ? 'text-blue-500' : cfg.color.includes('orange') ? 'text-orange-500' : 'text-gray-400'} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-[var(--text-primary)] truncate block">{item.title}</span>
                          {doc && <span className="text-[10px] text-[var(--text-secondary)]">v{doc.version} · {new Date(doc.updated_at).toLocaleDateString('tr-TR')}</span>}
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${cfg.color}`}>{cfg.label}</span>
                        {item.isP1 && <span className="text-[10px] text-[var(--gold)] font-medium">P1</span>}
                        {doc ? (
                          <button onClick={() => handleOpenDocument(doc)} className="px-3 py-1 text-xs font-medium text-[var(--gold)] hover:bg-[var(--gold)]/10 rounded-lg transition-colors">Düzenle</button>
                        ) : (
                          <button
                            onClick={() => handleCreateDocument(group, item)}
                            disabled={!selectedCompanyId && companies.length > 0}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-40 ${
                              item.isP1
                                ? 'bg-[var(--gold)] text-white hover:bg-[var(--gold-hover)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] border border-[var(--card-border)]'
                            }`}
                          >
                            {item.isP1 ? 'Şablondan Oluştur' : 'Oluştur'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Aramanızla eşleşen doküman bulunamadı.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="border border-[var(--card-border)] rounded-xl p-3 bg-white dark:bg-[#1e293b] shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
