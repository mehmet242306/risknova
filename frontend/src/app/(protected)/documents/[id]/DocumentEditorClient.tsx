'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import {
  ArrowLeft, Save, Download, ChevronRight,
  CheckCircle2, RotateCcw,
  PanelRightOpen, PanelRightClose,
  FileText, Clock, FileEdit, AlertCircle,
  ZoomIn, Trash2, Share2, PenTool, X, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchDocument, createDocument, updateDocument,
  fetchVersions, fetchSignatures,
  type DocumentRecord, type DocumentVersionRecord, type DocumentSignatureRecord,
} from '@/lib/supabase/document-api';
import { getTemplate } from '@/lib/document-templates-p1';
import { getGroupByKey } from '@/lib/document-groups';
import {
  type CompanyVariableData,
} from '@/lib/document-variables';
import { EditorToolbar } from '@/components/documents/EditorToolbar';
import { AIAssistantPanel } from '@/components/documents/AIAssistantPanel';
import { ShareModal } from '@/components/documents/ShareModal';
import { SignatureModal } from '@/components/documents/SignatureModal';
import QRCode from 'qrcode';
import type { JSONContent } from '@tiptap/react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  taslak: { label: 'Taslak', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400', icon: FileEdit },
  hazir: { label: 'Hazır', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  onay_bekliyor: { label: 'Onay Bekliyor', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  revizyon: { label: 'Revizyon', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
};

function normalizeDocumentLookup(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveTemplateIdFromQuery(groupKey: string, title: string) {
  if (!groupKey || !title) return '';

  const group = getGroupByKey(groupKey);
  if (!group) return '';

  const normalizedTitle = normalizeDocumentLookup(title);
  const matchedItem = group.items.find((item) => {
    const itemTitle = normalizeDocumentLookup(item.title);
    const itemId = normalizeDocumentLookup(item.id);

    return (
      itemTitle === normalizedTitle ||
      itemId === normalizedTitle ||
      itemTitle.includes(normalizedTitle) ||
      normalizedTitle.includes(itemTitle)
    );
  });

  return matchedItem?.id || '';
}

interface Props {
  paramsPromise?: Promise<{ id: string }>;
}

export function DocumentEditorClient({ paramsPromise }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = paramsPromise ? use(paramsPromise) : null;
  const documentId = resolvedParams?.id;

  const qGroup = searchParams.get('group') || '';
  const qTitle = searchParams.get('title') || '';
  const qTemplateId = searchParams.get('templateId') || '';
  const qMode = searchParams.get('mode') || '';
  const qCompanyId = searchParams.get('companyId') || '';
  const qDownload = searchParams.get('download') || '';
  const fromLibrary = searchParams.get('library') === '1';
  const librarySection = searchParams.get('librarySection') || 'documentation';
  const resolvedTemplateId = qTemplateId || resolveTemplateIdFromQuery(qGroup, qTitle);

  // State
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState(qTitle || 'Yeni Doküman');
  const [groupKey, setGroupKey] = useState(qGroup || '');
  const [status, setStatus] = useState<DocumentRecord['status']>('taslak');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  // Mobilde varsayılan olarak kapalı başlar (tam ekran overlay açıldığında
  // canvas'ı kapatıyor); desktop (lg+) için mount'ta açılır. Bu sayede
  // kullanıcı "AI Asistan" butonuna bastığında mobilde overlay slide-over
  // olarak gelir, masaüstünde sağ panel olarak kalır.
  const [showSidebar, setShowSidebar] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setShowSidebar(true);
    }
  }, []);
  const [, setVersions] = useState<DocumentVersionRecord[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CompanyVariableData>({});
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [initialContent, setInitialContent] = useState<JSONContent | undefined>(undefined);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDownloadTriggeredRef = useRef(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signatures, setSignatures] = useState<DocumentSignatureRecord[]>([]);
  const [userName, setUserName] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Word/char count
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // TipTap Editor — single instance shared by toolbar + content
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: 'Doküman içeriğini buraya yazın...' }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
    ],
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      // Word/char count
      const text = ed.state.doc.textContent;
      setCharCount(text.length);
      setWordCount(text.split(/\s+/).filter(Boolean).length);
      setHasUnsavedChanges(true);

      // Auto-save debounce (5 seconds)
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        handleAutoSave(ed.getJSON());
        setHasUnsavedChanges(false);
      }, 5000);
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[800px]',
      },
    },
  });

  // Set initial content when loaded
  useEffect(() => {
    if (editor && initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Generate QR code when doc has share_token
  useEffect(() => {
    if (doc?.share_token) {
      const url = `${window.location.origin}/share/${doc.share_token}`;
      QRCode.toDataURL(url, { width: 80, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } })
        .then(setQrDataUrl)
        .catch(() => {});
    }
  }, [doc?.share_token]);

  // Load context
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
      setOrgId(profile.organization_id);
      setUserId(profile.id);

      // Resolve workspace_id from companyId (if provided)
      if (qCompanyId) {
        const { data: ws } = await supabase
          .from('company_workspaces')
          .select('id')
          .eq('company_identity_id', qCompanyId)
          .eq('organization_id', profile.organization_id)
          .limit(1);
        if (ws?.[0]) setWorkspaceId(ws[0].id);
      }

      // Company data for variables
      const { data: workspaces } = await supabase
        .from('company_workspaces')
        .select('id, company_identity_id, display_name, metadata')
        .eq('organization_id', profile.organization_id)
        .limit(1);

      if (workspaces && workspaces.length > 0) {
        const ws = workspaces[0];
        const { data: company } = await supabase
          .from('company_identities')
          .select('*')
          .eq('id', ws.company_identity_id)
          .single();

        if (company) {
          const meta = (ws.metadata || {}) as Record<string, unknown>;
          setCompanyData({
            official_name: company.official_name || '',
            address: company.address || '',
            city: company.city || '',
            district: company.district || '',
            tax_number: company.tax_number || '',
            mersis_number: company.mersis_number || '',
            sector: company.sector || '',
            nace_code: company.nace_code || '',
            hazard_class: company.hazard_class || '',
            employee_count: (meta.employee_count as number) || undefined,
            specialist_name: profile.full_name || '',
          });
        }
        setUserName(profile.full_name || '');
      }

      // Load existing doc or template
      if (documentId) {
        const existingDoc = await fetchDocument(documentId);
        if (existingDoc) {
          setDoc(existingDoc);
          setInitialContent(existingDoc.content_json as JSONContent);
          setTitle(existingDoc.title);
          setGroupKey(existingDoc.group_key);
          setStatus(existingDoc.status);
          const vers = await fetchVersions(documentId);
          setVersions(vers);
          const sigs = await fetchSignatures(documentId);
          setSignatures(sigs);
        }
      } else if (qMode === 'import') {
        // Load imported content from sessionStorage (set by DocumentsClient)
        const importedMarkdown = sessionStorage.getItem('importedContent');
        if (importedMarkdown) {
          sessionStorage.removeItem('importedContent');
          const { markdownToTipTapJSON } = await import('@/lib/markdown-to-tiptap');
          const json = markdownToTipTapJSON(importedMarkdown);
          setInitialContent(json);
        }
      } else if (resolvedTemplateId) {
        const template = await getTemplate(resolvedTemplateId);
        if (template) {
          setInitialContent(template.content);
          setTitle(template.title);
          setGroupKey(template.groupKey);
        }
      }

      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, resolvedTemplateId]);

  // Auto-save
  const handleAutoSave = useCallback(async (contentJson: JSONContent) => {
    if (!orgId || !doc) return;
    setSaving(true);
    try {
      await updateDocument(doc.id, {
        title,
        content_json: contentJson as Record<string, unknown>,
        status,
      });
      setLastSavedAt(new Date());
      setSaveError(null);
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveError(err instanceof Error ? err.message : 'Otomatik kayit tamamlanamadi.');
    } finally {
      setSaving(false);
    }
  }, [orgId, doc, title, status]);

  const getSaveLocationLabel = useCallback(() => {
    const currentGroup = getGroupByKey(groupKey);

    return [
      qMode === "custom" ? "Kisisel dokumanlar" : "Firma dokumanlari",
      companyData.official_name || null,
      currentGroup?.title || groupKey || null,
    ].filter(Boolean).join(" / ");
  }, [companyData.official_name, groupKey, qMode]);

  // Manual save
  const handleSave = useCallback(async () => {
    if (!orgId || !editor) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    const content = editor.getJSON();

    try {
      if (doc) {
        const nextVersion = doc.version + 1;
        const updated = await updateDocument(doc.id, {
          title,
          content_json: content as Record<string, unknown>,
          status,
          version: nextVersion,
        });
        if (updated) {
          setDoc(updated);
        }
      } else {
        const isPrivateCustomDocument = qMode === "custom";
        const newDoc = await createDocument({
          organization_id: orgId,
          company_workspace_id: isPrivateCustomDocument ? null : workspaceId,
          template_id: null,
          group_key: groupKey,
          title,
          content_json: content as Record<string, unknown>,
          variables_data: {
            ...companyData,
            __company_identity_id: qCompanyId || null,
            __custom_scope: isPrivateCustomDocument ? "private" : "workspace",
            __custom_entry: isPrivateCustomDocument,
          },
          status: 'taslak',
          prepared_by: userId,
        });
        if (newDoc) {
          setDoc(newDoc);
          setInitialContent(content);
          const nextParams = new URLSearchParams();
          if (qCompanyId) nextParams.set('companyId', qCompanyId);
          if (fromLibrary) {
            nextParams.set('library', '1');
            nextParams.set('librarySection', librarySection);
          }
          const nextUrl = `/documents/${newDoc.id}${nextParams.toString() ? `?${nextParams.toString()}` : ''}`;
          window.history.replaceState(null, '', nextUrl);
        }
      }
      setLastSavedAt(new Date());
      setSaved(true);
      setSaveNotice(`Kaydedildi: ${getSaveLocationLabel() || title}`);
      setHasUnsavedChanges(false);
      setTimeout(() => {
        setSaved(false);
        setSaveNotice(null);
      }, 4500);
    } catch (err) {
      console.error('Save error:', err);
      setSaveError(
        err instanceof Error ? err.message : 'Dokuman kaydi sirasinda beklenmeyen bir hata olustu.',
      );
    } finally {
      setSaving(false);
    }
  }, [orgId, editor, doc, title, status, groupKey, userId, companyData, qCompanyId, fromLibrary, librarySection, workspaceId, qMode, getSaveLocationLabel]);

  // Export
  const handleExport = useCallback(async () => {
    if (!editor) return;
    setExporting(true);
    try {
      const { generateDocxFromTipTap } = await import('@/lib/document-generator');
      await generateDocxFromTipTap({
        title,
        json: editor.getJSON(),
        companyData,
        companyName: companyData.official_name,
      });
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [editor, title, companyData]);

  // PDF Export (browser print)
  const handlePdfExport = useCallback(() => {
    if (!editor) return;
    const content = editor.getHTML();
    const companyName = companyData.official_name || '';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
  @page { margin: 2cm; size: A4; }
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #0F172A; margin: 0; padding: 0; }
  h1 { font-size: 18pt; color: #D4A017; margin-bottom: 4pt; }
  h2 { font-size: 14pt; color: #0F172A; margin-top: 16pt; border-bottom: 1px solid #E2E8F0; padding-bottom: 4pt; }
  h3 { font-size: 12pt; color: #0F172A; margin-top: 12pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; }
  th, td { border: 1px solid #CBD5E1; padding: 6px 8px; text-align: left; }
  th { background: #F1F5F9; font-weight: bold; }
  ul, ol { margin: 4pt 0; padding-left: 20pt; }
  blockquote { border-left: 3px solid #D4A017; padding-left: 12px; color: #64748B; font-style: italic; }
  hr { border: none; border-top: 1px solid #E2E8F0; margin: 12pt 0; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #D4A017; padding-bottom: 8pt; margin-bottom: 16pt; }
  .header-brand { color: #D4A017; font-weight: bold; font-size: 10pt; }
  .header-company { color: #64748B; font-size: 9pt; }
  .footer { margin-top: 24pt; border-top: 1px solid #E2E8F0; padding-top: 8pt; font-size: 8pt; color: #94A3B8; display: flex; justify-content: space-between; align-items: flex-end; }
  .qr-section { text-align: right; }
  .qr-section img { width: 60px; height: 60px; }
  .qr-section p { font-size: 6pt; color: #94A3B8; margin: 2pt 0 0; }
  @media print { .no-print { display: none; } }
</style></head><body>
<div class="header">
  <span class="header-brand">RiskNova</span>
  <span class="header-company">${companyName}</span>
</div>
<h1>${title}</h1>
${content}
<div class="footer">
  <div>
    <span>${title}</span><br/>
    <span>${new Date().toLocaleDateString('tr-TR')}</span>
  </div>
  ${qrDataUrl ? `<div class="qr-section"><img src="${qrDataUrl}" alt="QR"/><p>RiskNova Doğrulama</p></div>` : ''}
</div>
<script>setTimeout(()=>window.print(),500)<\/script>
</body></html>`);
    printWindow.document.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, title, companyData]);

  useEffect(() => {
    if (!qDownload || !editor || loading || autoDownloadTriggeredRef.current) return;
    autoDownloadTriggeredRef.current = true;

    const runDownload = async () => {
      if (qDownload === 'pdf') {
        handlePdfExport();
      } else {
        await handleExport();
      }

      if (window.opener) {
        window.setTimeout(() => window.close(), 900);
      }
    };

    void runDownload();
  }, [editor, handleExport, handlePdfExport, loading, qDownload]);

  const documentsBackParams = new URLSearchParams();
  if (groupKey || qGroup) {
    documentsBackParams.set('group', groupKey || qGroup);
  }
  if (qCompanyId) {
    documentsBackParams.set('companyId', qCompanyId);
  }
  if (fromLibrary) {
    documentsBackParams.set('library', '1');
    documentsBackParams.set('librarySection', librarySection);
  }
  const documentsBackHref = `/documents${documentsBackParams.toString() ? `?${documentsBackParams.toString()}` : ''}`;
  const libraryBackHref = `/isg-library?category=${librarySection}`;


  const group = getGroupByKey(groupKey);
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.taslak;
  const StatusIcon = statusCfg.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Doküman yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col overflow-hidden" style={{ height: 'calc(100dvh - 140px)' }}>
      {/* ── Header Bar ── */}
      {/* Mobilde: iki satırlı header (üstte breadcrumb+başlık, altta aksiyonlar).
          Masaüstünde (lg+): tek satır horizontal layout. */}
      <div className="flex flex-col gap-2 border-b border-[var(--card-border)] bg-[var(--card)] px-3 py-2 shadow-sm shadow-[var(--gold-glow)] lg:flex-row lg:items-center lg:justify-between lg:px-4">
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => router.push(fromLibrary ? libraryBackHref : documentsBackHref)}
            className="p-1.5 rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <nav className="flex items-center gap-1 text-sm text-[var(--text-secondary)] min-w-0">
            <span
              className="hover:text-[var(--text-primary)] cursor-pointer shrink-0"
              onClick={() => router.push(fromLibrary ? libraryBackHref : documentsBackHref)}
            >
              {fromLibrary ? 'Kütüphaneye Dön' : 'Dokümanlar'}
            </span>
            <ChevronRight size={12} className="opacity-40 shrink-0" />
            {group && <span className="shrink-0">{group.title}</span>}
            {group && <ChevronRight size={12} className="opacity-40 shrink-0" />}
          </nav>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm font-semibold text-[var(--text-primary)] bg-transparent border-none outline-none min-w-0 flex-1 truncate"
            placeholder="Doküman başlığı..."
          />
        </div>

        {/* Right: status + actions — mobilde yatay scroll, desktop'ta sabit.
            [&>*]:shrink-0 → içteki tüm öğeler doğal genişliklerini korur
            (flex children varsayılan olarak shrink olabiliyor). */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [&>*]:shrink-0 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-border/60 lg:shrink-0 lg:overflow-visible lg:pb-0">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusCfg.color}`}>
            <StatusIcon size={11} />
            {statusCfg.label}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DocumentRecord['status'])}
            className="text-xs px-1.5 py-1 rounded border border-[var(--card-border)] bg-transparent text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
          >
            <option value="taslak">Taslak</option>
            <option value="hazir">Hazır</option>
            <option value="onay_bekliyor">Onay Bekliyor</option>
            <option value="revizyon">Revizyon</option>
          </select>

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--gold)]/10 hover:text-[var(--gold)]"
            title={showSidebar ? 'AI Paneli Kapat' : 'AI Asistan'}
          >
            {showSidebar ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>

          <button
            onClick={() => {
              if (!editor) return;
              if (editor.state.doc.textContent.trim().length === 0) return;
              if (window.confirm('Editör içeriği temizlenecek. Emin misiniz?')) {
                editor.commands.clearContent();
                setHasUnsavedChanges(false);
              }
            }}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-[var(--text-secondary)] hover:text-red-500"
            title="Sayfayı Temizle"
          >
            <Trash2 size={14} />
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-[var(--gold)]/35 rounded-md hover:bg-[var(--gold)]/10 transition-colors text-[var(--text-primary)] disabled:opacity-50"
          >
            <Download size={13} />
            {exporting ? '...' : 'Word'}
          </button>
          <button
            onClick={handlePdfExport}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-[var(--gold)]/35 rounded-md hover:bg-[var(--gold)]/10 transition-colors text-[var(--text-primary)]"
          >
            <FileText size={13} />
            PDF
          </button>

          <button
            onClick={() => doc && setShowShareModal(true)}
            disabled={!doc}
            title={!doc ? 'Önce dokümanı kaydedin' : 'QR Kod, Link, WhatsApp ile paylaş'}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              doc?.is_shared
                ? 'border-green-300 text-green-600 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                : 'border-[var(--gold)]/25 text-[var(--text-primary)] hover:border-[var(--gold)]/45 hover:bg-[var(--gold)]/10'
            }`}
          >
            <Share2 size={13} />
            Paylaş
          </button>

          <button
            onClick={() => doc && setShowSignModal(true)}
            disabled={!doc}
            title={!doc ? 'Önce dokümanı kaydedin' : 'E-İmza / Mobil İmza ile imzala'}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              signatures.length > 0
                ? 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'
                : 'border-[var(--gold)]/25 text-[var(--text-primary)] hover:border-[var(--gold)]/45 hover:bg-[var(--gold)]/10'
            }`}
          >
            <PenTool size={13} />
            İmzala {signatures.length > 0 && `(${signatures.length})`}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-[var(--gold)] text-[var(--primary-foreground)] rounded-md hover:bg-[var(--gold-hover)] transition-colors disabled:opacity-60"
          >
            {saving ? <RotateCcw size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi!' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      {editor && <EditorToolbar editor={editor} />}

      {/* ── Main Area ── */}
      {saveError ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {saveError}
        </div>
      ) : null}

      {saveNotice ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--gold)]/25 bg-[var(--gold)]/10 px-4 py-3 text-sm text-[var(--text-primary)]">
          <span className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} className="text-[var(--gold)]" />
            {saveNotice}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            Belge acik kaldi; duzenlemeye devam edebilirsiniz.
          </span>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Canvas — scrollable gray bg with A4 page */}
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden editor-canvas">
          <div
            className="a4-page"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            {editor && <EditorContent editor={editor} />}
            {/* QR Code — sağ alt köşe */}
            {qrDataUrl && doc && (
              <div className="absolute bottom-6 right-6 flex flex-col items-center gap-1 opacity-70 hover:opacity-100 transition-opacity print:opacity-100" title={`Doğrulama: /share/${doc.share_token}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR Doğrulama" className="w-16 h-16 rounded" />
                <span className="text-[7px] text-gray-400 font-mono">RiskNova Doğrulama</span>
              </div>
            )}
          </div>
          {/* Bottom spacer */}
          <div style={{ height: `${60 * zoom}px` }} />
        </div>

        {/* Sidebar — AI Assistant
            Mobilde: fixed inset-y-0 right-0, tam ekran yüksekliğinde slide-over.
            Masaüstünde (lg+): normal sağ panel olarak docklu. */}
        {showSidebar && (
          <>
            {/* Mobile backdrop — tıklanınca paneli kapatır */}
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setShowSidebar(false)}
              aria-hidden="true"
            />
            <aside className="fixed inset-y-0 right-0 z-[60] flex h-[100dvh] w-full max-w-sm flex-col border-l border-[var(--card-border)] bg-[var(--card)] shadow-2xl lg:static lg:z-auto lg:h-auto lg:w-[320px] lg:max-w-none lg:shrink-0 lg:shadow-none">
              {/* Mobil kapatma butonu — panelin sağ üst köşesinde */}
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] lg:hidden"
                aria-label="AI Paneli Kapat"
              >
                <X size={18} />
              </button>
              <div className="min-h-0 flex-1">
                <AIAssistantPanel
                  editor={editor}
                  documentTitle={title}
                  groupKey={groupKey}
                  companyName={companyData.official_name || ''}
                  companyData={companyData}
                />
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Mobil AI Asistan açma butonu — panel kapalıyken sağ altta floating */}
      {!showSidebar && (
        <button
          type="button"
          onClick={() => setShowSidebar(true)}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-[60] inline-flex h-12 items-center gap-2 rounded-full bg-[var(--gold)] px-4 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-95 lg:hidden"
          aria-label="AI Asistan Aç"
          title="AI Asistan"
        >
          <Sparkles size={16} />
          <span>AI Asistan</span>
        </button>
      )}

      {/* ── Status Bar ── */}
      <div className="editor-statusbar flex items-center justify-between px-4 py-1.5 text-[11px] text-[var(--text-secondary)]">
        <div className="flex items-center gap-3">
          <span>{wordCount} kelime</span>
          <span className="opacity-40">|</span>
          <span>{charCount.toLocaleString('tr-TR')} karakter</span>
        </div>

        <div className="flex items-center gap-1">
          {saving && <span className="text-[var(--gold)]">Kaydediliyor...</span>}
          {!saving && lastSavedAt && (
            <span>
              Son kayit: {lastSavedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              {getSaveLocationLabel() ? ` / ${getSaveLocationLabel()}` : ''}
            </span>
          )}
          {!saving && !lastSavedAt && <span>Henüz kaydedilmedi</span>}
        </div>

        <div className="flex items-center gap-1.5">
          <ZoomIn size={12} />
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="bg-transparent text-[11px] text-[var(--text-secondary)] cursor-pointer focus:outline-none"
          >
            <option value={0.75}>%75</option>
            <option value={1}>%100</option>
            <option value={1.25}>%125</option>
            <option value={1.5}>%150</option>
          </select>
        </div>
      </div>

      {/* ── Modals ── */}
      {doc && (
        <>
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            documentId={doc.id}
            documentTitle={title}
            shareToken={doc.share_token}
            isShared={doc.is_shared}
            onShareChanged={(shared, token) => {
              setDoc({ ...doc, is_shared: shared, share_token: token });
            }}
          />
          <SignatureModal
            isOpen={showSignModal}
            onClose={() => setShowSignModal(false)}
            documentId={doc.id}
            signerName={userName || 'İmzalayan'}
            signerRole="İSG Uzmanı"
            signerUserId={userId}
            contentHash={JSON.stringify(editor?.getJSON() || {}).slice(0, 64)}
            onSigned={async () => {
              const sigs = await fetchSignatures(doc.id);
              setSignatures(sigs);
            }}
          />
        </>
      )}
    </div>
  );
}
