'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Plus, Search, ChevronDown, ChevronRight,
  Clock, CheckCircle2, AlertCircle, FileEdit, Sparkles,
  UserCheck, Users, GraduationCap, ShieldAlert, Siren,
  AlertTriangle, Mail, ClipboardList, BookOpen, Eye as SearchIcon,
  UserCog, CalendarCheck, UserPlus, Award, MapPin, Wrench,
  Clock as ClockIcon, FolderOpen, Flame, Heart,
  Building2, User, PlusCircle, Upload, Camera, MoreVertical, Loader2,
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
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

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
  const isCompanySelected = !!selectedCompanyId;

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
      companyId: selectedCompanyId,
    });
    router.push(`/documents/new?${params.toString()}`);
  };

  const handleAddCustomDocument = (group: DocumentGroup) => {
    const name = window.prompt(`"${group.title}" grubuna eklenecek evrak adını girin:`);
    if (!name || !name.trim()) return;
    const params = new URLSearchParams({
      group: group.key,
      title: name.trim(),
      mode: 'custom',
      companyId: selectedCompanyId,
    });
    router.push(`/documents/new?${params.toString()}`);
  };

  const handleOpenDocument = (doc: DocumentRecord) => {
    router.push(`/documents/${doc.id}`);
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
        const params = new URLSearchParams({
          group: ref.group.key,
          title: ref.item.title,
          templateId: ref.item.id,
          mode: 'import',
          companyId: selectedCompanyId,
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
  }, [selectedCompany, selectedCompanyId, router]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImportedFile(file);
    e.target.value = '';
  }, [processImportedFile]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
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
              onClick={() => router.push('/documents/personal')}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--gold)]/30 rounded-lg hover:bg-[var(--gold)]/10 transition-colors text-sm font-medium text-[var(--text-primary)]"
            >
              <User size={16} />
              Kişisel Doküman
            </button>
          </div>
        }
      />

      {/* Firma Seçici — gold border */}
      <div className="mt-6 mb-5 p-4 border-2 border-[var(--gold)]/40 rounded-xl bg-white dark:bg-[#1a2234] shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Building2 size={20} className="text-[var(--gold)]" />
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

      {/* Firma seçilmeden dokümanlar gizli */}
      {!isCompanySelected ? (
        <div className="text-center py-16">
          <Building2 size={56} className="mx-auto text-[var(--gold)]/30 mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Firma Seçimi Gerekli</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
            Dokümanlar firma bazlı hazırlanır. Yukarıdan bir firma seçerek şablonlara erişebilirsiniz.
          </p>
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
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) expandAll(); }}
                placeholder="Doküman veya grup ara..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--gold)]/20 bg-white dark:bg-[#0f172a] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/50"
              />
            </div>
            <button
              onClick={expandedGroups.size > 0 ? collapseAll : expandAll}
              className="px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--gold)] border border-[var(--gold)]/20 rounded-lg transition-colors"
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
                <div key={group.key} className="border border-[var(--gold)]/20 rounded-xl overflow-hidden bg-white dark:bg-[#1a2234] shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--gold)]/5 transition-colors text-left"
                  >
                    <span className={`shrink-0 ${group.color}`}><Icon size={20} /></span>
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
                    <div className="hidden sm:flex items-center gap-2 w-24">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--gold)] rounded-full transition-all" style={{ width: `${group.items.length > 0 ? (completedCount / group.items.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={16} className="text-[var(--text-secondary)] shrink-0" /> : <ChevronRight size={16} className="text-[var(--text-secondary)] shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[var(--gold)]/10">
                      {group.items.map((item) => {
                        const doc = findDocForItem(group, item);

                        const itemKey = `${group.key}-${item.id}`;
                        const isImporting = importingId === itemKey;
                        const isMenuOpen = openMenuId === itemKey;

                        return (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--gold)]/5 transition-colors border-b border-[var(--gold)]/10 last:border-b-0">
                            <FileText size={14} className="text-[var(--text-secondary)] shrink-0" />
                            <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{item.title}</span>

                            {isImporting ? (
                              <span className="flex items-center gap-1.5 text-xs text-[var(--gold)]">
                                <Loader2 size={14} className="animate-spin" />
                                İşleniyor...
                              </span>
                            ) : doc ? (
                              <>
                                <span className="text-[10px] text-[var(--text-secondary)]">v{doc.version}</span>
                                <button onClick={() => handleOpenDocument(doc)} className="px-3 py-1 text-xs font-medium text-[var(--gold)] hover:bg-[var(--gold)]/10 rounded-lg transition-colors">Düzenle</button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleCreateDocument(group, item)}
                                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
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
                                          <Upload size={13} className="text-[var(--gold)]" />
                                          Dosya İmport Et
                                          <span className="ml-auto text-[10px] text-[var(--text-secondary)]">PDF, Word, Görüntü</span>
                                        </button>
                                        <button
                                          onClick={() => handleCameraCapture(group, item)}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--gold)]/10 transition-colors"
                                        >
                                          <Camera size={13} className="text-[var(--gold)]" />
                                          Kameradan Çek
                                          <span className="ml-auto text-[10px] text-[var(--text-secondary)]">OCR + AI</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Özel evrak ekleme */}
                      <div className="px-4 py-2 border-t border-[var(--gold)]/10">
                        <button
                          onClick={() => handleAddCustomDocument(group)}
                          className="flex items-center gap-2 text-xs text-[var(--gold)] hover:text-[var(--gold-hover)] transition-colors"
                        >
                          <PlusCircle size={14} />
                          Bu gruba özel evrak ekle
                        </button>
                      </div>
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

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="border border-[var(--gold)]/20 rounded-xl p-3 bg-white dark:bg-[#1a2234] shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-2xl font-bold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
