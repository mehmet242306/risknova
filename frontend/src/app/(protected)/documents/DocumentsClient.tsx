'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Download,
  FileText, Search,
  CheckCircle2, AlertCircle, FileEdit, Sparkles,
  UserCheck, Users, GraduationCap, ShieldAlert, Siren,
  AlertTriangle, Mail, ClipboardList, BookOpen, Eye as SearchIcon,
  UserCog, CalendarCheck, UserPlus, Award, MapPin, Wrench,
  Clock as ClockIcon, FolderOpen, Flame, Heart,
  Building2, User, PlusCircle, Upload, Camera, MoreVertical, Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { PremiumIconBadge, type PremiumIconTone } from '@/components/ui/premium-icon-badge';
import { DOCUMENT_GROUPS, getTotalDocumentCount, type DocumentGroup, type DocumentGroupItem } from '@/lib/document-groups';
import { createClient } from '@/lib/supabase/client';
import { fetchDocuments, type DocumentRecord } from '@/lib/supabase/document-api';

const GROUP_ICONS: Record<string, React.ElementType> = {
  UserCheck, Users, GraduationCap, ShieldAlert, Siren,
  AlertTriangle, Mail, ClipboardList, BookOpen, Search: SearchIcon,
  UserCog, CalendarCheck, UserPlus, Award, MapPin, Wrench,
  Clock: ClockIcon, FolderOpen, Flame, Heart,
};

const GROUP_TONES: Record<string, PremiumIconTone> = {
  UserCheck: 'teal',
  Users: 'indigo',
  GraduationCap: 'emerald',
  ShieldAlert: 'risk',
  Siren: 'amber',
  AlertTriangle: 'amber',
  Mail: 'violet',
  ClipboardList: 'gold',
  BookOpen: 'cobalt',
  Search: 'cobalt',
  UserCog: 'orange',
  CalendarCheck: 'emerald',
  UserPlus: 'teal',
  Award: 'gold',
  MapPin: 'orange',
  Wrench: 'amber',
  Clock: 'violet',
  FolderOpen: 'cobalt',
  Flame: 'risk',
  Heart: 'danger',
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
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setOrgId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const groupParam = searchParams.get('group');
  const queryParam = searchParams.get('q');
  const companyParam = searchParams.get('companyId');
  const libraryParam = searchParams.get('library');
  const librarySectionParam = searchParams.get('librarySection');
  const fromLibrary = libraryParam === '1';
  const librarySection = librarySectionParam || 'documentation';

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile?.organization_id) { setLoading(false); return; }
      setOrgId(profile.organization_id);
      setProfileId(profile.id);

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
        }
      }

      const docs = await fetchDocuments(profile.organization_id);
      setDocuments(docs);
      setLoading(false);
    }
    load();
  }, []);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const matchesPrivateCompanyScope = useCallback((doc: DocumentRecord, companyId: string) => {
    const scopedCompanyId = doc.variables_data?.__company_identity_id;
    return typeof scopedCompanyId === 'string' && scopedCompanyId === companyId;
  }, []);

  const activeDocuments = useMemo(() => {
    if (!selectedCompany) return [];
    return documents.filter((doc) => {
      if (doc.company_workspace_id === selectedCompany.workspace_id) {
        return true;
      }

      if (!profileId) {
        return false;
      }

      const isPrivateScopedDocument =
        doc.company_workspace_id === null &&
        doc.prepared_by === profileId &&
        matchesPrivateCompanyScope(doc, selectedCompany.id);

      return isPrivateScopedDocument;
    });
  }, [documents, matchesPrivateCompanyScope, profileId, selectedCompany]);
  const isCompanySelected = !!selectedCompanyId;
  const companyTone: PremiumIconTone = selectedCompany ? 'gold' : 'neutral';
  const hideCompanyPicker = fromLibrary && !!selectedCompany;

  const buildLibraryHref = useCallback(() => {
    const params = new URLSearchParams({
      view: 'browse',
      section: librarySection,
    });
    const scopedCompanyId = selectedCompanyId || companyParam;
    if (scopedCompanyId) {
      params.set('companyId', scopedCompanyId);
    }
    return `/isg-library?${params.toString()}`;
  }, [companyParam, librarySection, selectedCompanyId]);

  const buildContextParams = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams(extra);
    if (selectedCompanyId) {
      params.set('companyId', selectedCompanyId);
    }
    if (fromLibrary) {
      params.set('library', '1');
      params.set('librarySection', librarySection);
    }
    return params;
  }, [fromLibrary, librarySection, selectedCompanyId]);

  const stats = useMemo(() => {
    const total = getTotalDocumentCount();
    const hazir = activeDocuments.filter((d) => d.status === 'hazir').length;
    const taslak = activeDocuments.filter((d) => d.status === 'taslak').length;
    const eksik = Math.max(total - activeDocuments.length, 0);
    return { total, hazir, taslak, eksik };
  }, [activeDocuments]);

  const findDocForItem = (group: DocumentGroup, item: DocumentGroupItem): DocumentRecord | undefined => {
    return activeDocuments.find((d) => d.group_key === group.key && d.title === item.title);
  };

  const filteredGroups = useMemo(() => {
    let groups = DOCUMENT_GROUPS;
    if (groupParam) {
      groups = groups.filter((group) => group.key === groupParam);
    }
    if (!searchQuery) return groups;
    const q = searchQuery.toLowerCase();
    return groups.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.title.toLowerCase().includes(q) || group.title.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [groupParam, searchQuery]);

  useEffect(() => {
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, [groupParam, queryParam]);

  useEffect(() => {
    if (!companyParam || selectedCompanyId || !companies.some((company) => company.id === companyParam)) {
      return;
    }
    setSelectedCompanyId(companyParam);
  }, [companies, companyParam, selectedCompanyId]);

  const handleCreateDocument = (group: DocumentGroup, item: DocumentGroupItem) => {
    const params = buildContextParams({
      group: group.key,
      title: item.title,
      templateId: item.id,
      mode: 'new',
    });
    router.push(`/documents/new?${params.toString()}`);
  };

  const handleAddCustomDocument = (group: DocumentGroup) => {
    const name = window.prompt(`"${group.title}" grubuna eklenecek evrak adını girin:`);
    if (!name || !name.trim()) return;
    const params = buildContextParams({
      group: group.key,
      title: name.trim(),
      mode: 'custom',
    });
    router.push(`/documents/new?${params.toString()}`);
  };

  const handleOpenDocument = (doc: DocumentRecord) => {
    const params = buildContextParams();
    router.push(`/documents/${doc.id}?${params.toString()}`);
  };

  const handleQuickDownload = (doc: DocumentRecord) => {
    const params = buildContextParams({ download: 'word' });
    window.open(`/documents/${doc.id}?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  // ── Import / Camera ──
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pendingImportRef = useRef<{ group: DocumentGroup; item: DocumentGroupItem } | null>(null);

  const handleImportFile = (group: DocumentGroup, item: DocumentGroupItem) => {
    pendingImportRef.current = { group, item };
    setOpenMenuId(null);
    fileInputRef.current?.click();
  };

  const handleCameraCapture = (group: DocumentGroup, item: DocumentGroupItem) => {
    pendingImportRef.current = { group, item };
    setOpenMenuId(null);
    cameraInputRef.current?.click();
  };

  const processImportedFile = useCallback(async (file: File) => {
    const ref = pendingImportRef.current;
    if (!ref) return;

    const itemKey = `${ref.group.key}-${ref.item.id}`;
    setImportingId(itemKey);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentTitle', ref.item.title);
      formData.append('groupKey', ref.group.key);
      if (selectedCompany) {
        formData.append('companyName', selectedCompany.name);
        formData.append('sector', selectedCompany.sector);
        formData.append('hazardClass', selectedCompany.hazard_class);
      }

      const res = await fetch('/api/document-import', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Navigate to editor with imported content
        const params = buildContextParams({
          group: ref.group.key,
          title: ref.item.title,
          templateId: ref.item.id,
          mode: 'import',
        });
        // Store imported content in sessionStorage for the editor to pick up
        sessionStorage.setItem('importedContent', data.content);
        router.push(`/documents/new?${params.toString()}`);
      } else {
        alert('Dosya işlenirken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } catch {
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      setImportingId(null);
      pendingImportRef.current = null;
    }
  }, [buildContextParams, selectedCompany, router]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImportedFile(file);
    e.target.value = '';
  }, [processImportedFile]);

  if (loading) {
    return (
      <div className="w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="İSG Doküman Yönetimi"
        title="Doküman Hazırlama"
        description={
          selectedCompany
            ? `${selectedCompany.name} için hazırlanan dokümanlar. AI destekli düzenleme ve hızlı Word export aynı akışta.`
            : "Şablonu seçin, dokümanı hazırlayın ve AI destekli düzenleme ile export alın."
        }
        actions={
          <div className="flex items-center gap-2">
            {fromLibrary ? (
              <button
                onClick={() => router.push(buildLibraryHref())}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
              >
                <ArrowLeft size={16} />
                Geri Dön
              </button>
            ) : null}
            <button
              onClick={() => router.push('/documents/personal')}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--gold)]/30 rounded-lg hover:bg-[var(--gold)]/10 transition-colors text-sm font-medium text-[var(--text-primary)]"
            >
              <PremiumIconBadge icon={User} tone="gold" size="xs" />
              Kişisel Doküman
            </button>
          </div>
        }
      />

      {/* Firma Seçici — gold border */}
      {hideCompanyPicker ? (
        <div className="mt-6 mb-5 rounded-xl border border-[var(--gold)]/25 bg-[var(--card)] p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <PremiumIconBadge icon={Building2} tone={companyTone} size="sm" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">Seçili Firma</p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedCompany?.name}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {selectedCompany?.sector ? <span className="rounded-md bg-[var(--gold)]/10 px-2 py-1 font-medium text-[var(--gold)]">{selectedCompany.sector}</span> : null}
              {selectedCompany?.hazard_class ? <span className="rounded-md bg-[var(--gold)]/10 px-2 py-1 font-medium text-[var(--gold)]">{selectedCompany.hazard_class}</span> : null}
              {selectedCompany?.city ? <span className="rounded-md bg-[var(--gold)]/10 px-2 py-1 font-medium text-[var(--gold)]">{selectedCompany.city}</span> : null}
            </div>
          </div>
        </div>
      ) : (
      <div className="mt-6 mb-5 p-4 border-2 border-[var(--gold)]/40 rounded-xl bg-white dark:bg-[#1a2234] shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <PremiumIconBadge icon={Building2} tone={companyTone} size="sm" />
            <label className="text-sm font-bold text-[var(--text-primary)]">Firma Seçin</label>
          </div>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="flex-1 max-w-md px-3 py-2.5 text-sm rounded-lg border border-[var(--gold)]/30 bg-white dark:bg-[#0f172a] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50"
          >
            <option value="">— Firma seçin —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {selectedCompany && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-md bg-[var(--gold)]/10 text-[var(--gold)] font-medium">{selectedCompany.sector || 'Sektör ?'}</span>
              <span className="px-2 py-1 rounded-md bg-[var(--gold)]/10 text-[var(--gold)] font-medium">{selectedCompany.hazard_class || 'Sınıf ?'}</span>
              {selectedCompany.city && <span className="px-2 py-1 rounded-md bg-[var(--gold)]/10 text-[var(--gold)] font-medium">{selectedCompany.city}</span>}
            </div>
          )}
        </div>
        {!isCompanySelected && companies.length > 0 && (
          <p className="mt-2 text-xs text-[var(--gold)]">⚠ Doküman şablonlarını görmek için önce bir firma seçin.</p>
        )}
        {companies.length === 0 && (
          <p className="mt-2 text-xs text-amber-500">Henüz firma eklenmemiş. Firmalar sayfasından firma ekleyin.</p>
        )}
      </div>

      )}

      {!isCompanySelected ? (
        <div className="text-center py-16">
          <PremiumIconBadge icon={Building2} tone="neutral" size="lg" className="mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Firma Seçimi Gerekli</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Dokümanlar firma bazlı hazırlanır. Yukarıdan bir firma seçerek şablonlara erişebilirsiniz.
          </p>
          {fromLibrary ? (
            <button
              onClick={() => router.push(buildLibraryHref())}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
            >
              <ArrowLeft size={16} />
              Kütüphaneye Don
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard label="Toplam Belge" value={stats.total} icon={FileText} color="text-blue-500" />
            <StatCard label="Hazır" value={stats.hazir} icon={CheckCircle2} color="text-green-500" />
            <StatCard label="Taslak" value={stats.taslak} icon={FileEdit} color="text-yellow-500" />
            <StatCard label="Oluşturulmamış" value={stats.eksik} icon={AlertCircle} color="text-gray-400" />
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Doküman veya grup ara..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--gold)]/20 bg-white dark:bg-[#0f172a] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50"
              />
            </div>
          </div>

          {/* Document Groups */}
          <div className="space-y-5">
            {filteredGroups.map((group) => {
              const Icon = GROUP_ICONS[group.icon] || FileText;
              const groupTone = GROUP_TONES[group.icon] || 'gold';
              const groupDocs = activeDocuments.filter((d) => d.group_key === group.key);
              const completedCount = groupDocs.filter((d) => d.status === 'hazir').length;
              const hasP1 = group.items.some((i) => i.isP1);

              return (
                <section key={group.key} className="overflow-hidden rounded-[1.8rem] border border-[var(--gold)]/20 bg-white shadow-sm dark:bg-[#1a2234]">
                  <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                    <PremiumIconBadge icon={Icon} tone={groupTone} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{group.title}</span>
                        {hasP1 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--gold)]/15 text-[var(--gold)] rounded">
                            <Sparkles size={10} /> Şablon Hazır
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">{completedCount}/{group.items.length} belge hazır</span>
                    </div>
                    <div className="flex min-w-[150px] items-center gap-3 sm:w-52">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--gold)] rounded-full transition-all" style={{ width: `${group.items.length > 0 ? (completedCount / group.items.length) * 100 : 0}%` }} />
                      </div>
                      <span className="shrink-0 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--gold)]">
                        {groupDocs.length} kayıt
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-[var(--gold)]/10 p-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {group.items.map((item) => {
                        const doc = findDocForItem(group, item);

                        const itemKey = `${group.key}-${item.id}`;
                        const isImporting = importingId === itemKey;
                        const isMenuOpen = openMenuId === itemKey;
                        const operationCount = doc ? Math.max(doc.version || 1, 1) : 0;
                        const isPrivateCustomDocument = doc?.company_workspace_id === null;

                        return (
                          <article key={item.id} className="relative overflow-hidden rounded-[1.6rem] border border-[var(--gold)]/20 bg-white p-4 shadow-sm transition-colors hover:border-[var(--gold)]/35 hover:bg-[var(--gold)]/5 dark:bg-[#182235]">
                            <DocumentCardVisual icon={Icon} tone={groupTone} title={item.title} subtitle={group.title} />

                            <div className="mt-4 flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <PremiumIconBadge icon={FileText} tone={doc ? 'gold' : 'neutral'} size="sm" />
                                <div className="min-w-0">
                                  <h3 className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                    {doc
                                      ? isPrivateCustomDocument
                                        ? 'Bu kart size özel. Düzenleme ve indirme hazır.'
                                        : 'Kayıt mevcut, düzenleme ve indirme hazır.'
                                      : 'Henüz oluşturulmamış şablon kartı.'}
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--gold)]">
                                İşlem sayısı: {operationCount}
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                              <div className="rounded-xl border border-[var(--gold)]/15 bg-[var(--gold)]/5 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Durum</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                                  {doc ? (doc.status === 'hazir' ? 'Hazır' : doc.status === 'taslak' ? 'Taslak' : 'İşlemde') : 'Oluşturulmadı'}
                                </p>
                              </div>
                              <div className="rounded-xl border border-[var(--gold)]/15 bg-[var(--gold)]/5 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Sürüm</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">v{doc?.version ?? 0}</p>
                              </div>
                            </div>

                            {isPrivateCustomDocument ? (
                              <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--gold)]">
                                <User size={11} />
                                Size özel kart
                              </div>
                            ) : null}

                            {isImporting ? (
                              <span className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--gold)]/10 px-3 py-2 text-xs text-[var(--gold)]">
                                <Loader2 size={14} className="animate-spin" />
                                İşleniyor...
                              </span>
                            ) : doc ? (
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <button onClick={() => handleOpenDocument(doc)} className="rounded-lg bg-[var(--gold)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--gold-hover)]">Düzenle</button>
                                <button
                                  onClick={() => handleQuickDownload(doc)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--gold)]/25 px-3 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--gold)]/10"
                                >
                                  <Download size={12} />
                                  İndir
                                </button>
                              </div>
                            ) : (
                              <div className="mt-4 flex items-center gap-1.5">
                                <button
                                  onClick={() => handleCreateDocument(group, item)}
                                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                    item.isP1
                                      ? 'bg-[var(--gold)] text-white hover:bg-[var(--gold-hover)]'
                                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--gold)]/20 hover:border-[var(--gold)]/40'
                                  }`}
                                >
                                  {item.isP1 ? 'Şablondan Oluştur' : 'Oluştur'}
                                </button>

                                {/* Dropdown: Import / Camera */}
                                <div className="relative">
                                  <button
                                    onClick={() => setOpenMenuId(isMenuOpen ? null : itemKey)}
                                    className="p-1 rounded-md hover:bg-[var(--gold)]/10 text-[var(--text-secondary)] hover:text-[var(--gold)] transition-colors"
                                    title="Daha fazla seçenek"
                                  >
                                    <MoreVertical size={14} />
                                  </button>
                                  {isMenuOpen && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                      <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-white dark:bg-[#1e293b] border border-[var(--gold)]/20 rounded-lg shadow-lg py-1">
                                        <button
                                          onClick={() => handleImportFile(group, item)}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--gold)]/10 transition-colors"
                                        >
                                          <PremiumIconBadge icon={Upload} tone="cobalt" size="xs" />
                                          Dosya İmport Et
                                          <span className="ml-auto text-[10px] text-[var(--text-secondary)]">PDF, Word, Görüntü</span>
                                        </button>
                                        <button
                                          onClick={() => handleCameraCapture(group, item)}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--gold)]/10 transition-colors"
                                        >
                                          <PremiumIconBadge icon={Camera} tone="amber" size="xs" />
                                          Kameradan Çek
                                          <span className="ml-auto text-[10px] text-[var(--text-secondary)]">OCR + AI</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}

                      {/* Özel evrak ekleme */}
                      <button
                        onClick={() => handleAddCustomDocument(group)}
                        className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--gold)]/25 bg-[var(--gold)]/5 p-6 text-center transition-colors hover:border-[var(--gold)]/45 hover:bg-[var(--gold)]/10"
                      >
                        <div className="mb-3 rounded-full bg-white p-3 text-[var(--gold)] shadow-sm dark:bg-[#1e293b]">
                          <PlusCircle size={20} />
                        </div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Bu gruba özel evrak ekle</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">Eklediğiniz kart yalnızca bu firma sayfanızda ve sizin hesabınızda görünür.</p>
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          {filteredGroups.length === 0 && (
            <div className="text-center py-12">
              <PremiumIconBadge icon={FileText} tone="neutral" size="lg" className="mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Aramanızla eşleşen doküman bulunamadı.</p>
            </div>
          )}
        </>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>
  );
}

function DocumentCardVisual({
  icon: Icon,
  tone,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  tone: PremiumIconTone;
  title: string;
  subtitle: string;
}) {
  const surfaceTone =
    tone === 'risk' ? 'from-rose-500/18 via-rose-200/8 to-transparent dark:from-rose-500/28 dark:via-slate-900/20 dark:to-slate-950/20' :
    tone === 'cobalt' ? 'from-blue-500/18 via-sky-200/10 to-transparent dark:from-blue-500/28 dark:via-slate-900/20 dark:to-slate-950/20' :
    tone === 'amber' ? 'from-amber-500/18 via-yellow-200/10 to-transparent dark:from-amber-500/28 dark:via-slate-900/20 dark:to-slate-950/20' :
    tone === 'violet' ? 'from-violet-500/18 via-fuchsia-200/10 to-transparent dark:from-violet-500/28 dark:via-slate-900/20 dark:to-slate-950/20' :
    tone === 'emerald' ? 'from-emerald-500/18 via-teal-200/10 to-transparent dark:from-emerald-500/28 dark:via-slate-900/20 dark:to-slate-950/20' :
    tone === 'teal' ? 'from-teal-500/18 via-cyan-200/10 to-transparent dark:from-teal-500/28 dark:via-slate-900/20 dark:to-slate-950/20' :
    tone === 'indigo' ? 'from-indigo-500/18 via-indigo-200/10 to-transparent dark:from-indigo-500/28 dark:via-slate-900/20 dark:to-slate-950/20' :
    tone === 'orange' ? 'from-orange-500/18 via-amber-200/10 to-transparent dark:from-orange-500/28 dark:via-slate-900/20 dark:to-slate-950/20' :
    tone === 'gold' ? 'from-[var(--gold)]/20 via-yellow-100/25 to-transparent dark:from-[var(--gold)]/26 dark:via-slate-900/20 dark:to-slate-950/20' :
    'from-slate-400/16 via-slate-200/8 to-transparent dark:from-slate-500/22 dark:via-slate-900/16 dark:to-slate-950/20';

  return (
    <div className={`relative overflow-hidden rounded-[1.3rem] border border-white/40 bg-gradient-to-br ${surfaceTone} p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
      <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/45 blur-2xl dark:bg-white/10" />
      <div className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-white/35 blur-2xl dark:bg-white/5" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">{subtitle}</p>
          <p className="mt-2 line-clamp-2 max-w-[220px] text-base font-semibold text-[var(--text-primary)]">{title}</p>
        </div>
        <PremiumIconBadge icon={Icon} tone={tone} size="md" />
      </div>
      <div className="relative mt-4 flex items-center gap-2">
        <span className="inline-flex rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--text-secondary)]">
          Hazır kart
        </span>
        <div className="h-px flex-1 bg-white/60 dark:bg-white/10" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  const tone: PremiumIconTone =
    color.includes('blue') ? 'cobalt' :
    color.includes('green') ? 'success' :
    color.includes('yellow') ? 'amber' :
    color.includes('gray') ? 'neutral' :
    'gold';

  return (
    <div className="border border-[var(--gold)]/20 rounded-xl p-3 bg-white dark:bg-[#1a2234] shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <PremiumIconBadge icon={Icon} tone={tone} size="xs" />
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
