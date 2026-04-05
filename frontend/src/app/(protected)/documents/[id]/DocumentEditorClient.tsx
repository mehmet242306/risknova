'use client';

import { useState, useEffect, useCallback, useRef, use, useMemo } from 'react';
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
  CheckCircle2, RotateCcw, Sparkles,
  PanelRightOpen, PanelRightClose,
  FileText, Clock, FileEdit, AlertCircle,
  ZoomIn,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchDocument, createDocument, updateDocument,
  createVersion, fetchVersions,
  type DocumentRecord, type DocumentVersionRecord,
} from '@/lib/supabase/document-api';
import { getP1Template } from '@/lib/document-templates-p1';
import { getGroupByKey } from '@/lib/document-groups';
import {
  resolveVariables,
  type CompanyVariableData,
} from '@/lib/document-variables';
import { EditorToolbar } from '@/components/documents/EditorToolbar';
import { AIAssistantPanel } from '@/components/documents/AIAssistantPanel';
import type { JSONContent } from '@tiptap/react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  taslak: { label: 'Taslak', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400', icon: FileEdit },
  hazir: { label: 'Hazır', color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  onay_bekliyor: { label: 'Onay Bekliyor', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  revizyon: { label: 'Revizyon', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
};

interface Props {
  paramsPromise?: Promise<{ id: string }>;
}

export function DocumentEditorClient({ paramsPromise }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = paramsPromise ? use(paramsPromise) : null;
  const documentId = resolvedParams?.id;
  const isNewDoc = !documentId;

  const qGroup = searchParams.get('group') || '';
  const qTitle = searchParams.get('title') || '';
  const qTemplateId = searchParams.get('templateId') || '';

  // State
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState(qTitle || 'Yeni Doküman');
  const [groupKey, setGroupKey] = useState(qGroup || '');
  const [status, setStatus] = useState<DocumentRecord['status']>('taslak');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [versions, setVersions] = useState<DocumentVersionRecord[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CompanyVariableData>({});
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [initialContent, setInitialContent] = useState<JSONContent | undefined>(undefined);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Auto-save debounce
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        handleAutoSave(ed.getJSON());
      }, 30000);
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
        }
      } else if (qTemplateId) {
        const template = getP1Template(qTemplateId);
        if (template) {
          setInitialContent(template.content);
          setTitle(template.title);
          setGroupKey(template.groupKey);
        }
      }

      setLoading(false);
    }
    load();
  }, [documentId, qTemplateId]);

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
    } catch (err) {
      console.error('Auto-save error:', err);
    } finally {
      setSaving(false);
    }
  }, [orgId, doc, title, status]);

  // Manual save
  const handleSave = useCallback(async () => {
    if (!orgId || !editor) return;
    setSaving(true);
    const content = editor.getJSON();

    try {
      if (doc) {
        const updated = await updateDocument(doc.id, {
          title,
          content_json: content as Record<string, unknown>,
          status,
        });
        if (updated) {
          setDoc(updated);
          await createVersion(doc.id, doc.version + 1, content as Record<string, unknown>, userId);
        }
      } else {
        const newDoc = await createDocument({
          organization_id: orgId,
          company_workspace_id: null,
          template_id: null,
          group_key: groupKey,
          title,
          content_json: content as Record<string, unknown>,
          variables_data: companyData as Record<string, string>,
          status: 'taslak',
          prepared_by: userId,
        });
        if (newDoc) {
          setDoc(newDoc);
          router.replace(`/documents/${newDoc.id}`);
        }
      }
      setLastSavedAt(new Date());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [orgId, editor, doc, title, status, groupKey, userId, companyData, router]);

  // Export
  const handleExport = useCallback(async () => {
    if (!editor) return;
    setExporting(true);
    try {
      const { generateDocx } = await import('@/lib/document-generator');
      const textContent = tiptapToMarkdown(editor.getJSON());
      const resolvedContent = resolveVariables(textContent, companyData);
      await generateDocx({
        title: resolveVariables(title, companyData),
        content: resolvedContent,
        type: 'docx',
      });
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [editor, title, companyData]);

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
    <div className="flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--card-border)] bg-white dark:bg-[#1e293b]">
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => router.push('/documents')}
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--text-secondary)] shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <nav className="flex items-center gap-1 text-sm text-[var(--text-secondary)] min-w-0">
            <span className="hover:text-[var(--text-primary)] cursor-pointer shrink-0" onClick={() => router.push('/documents')}>Dokümanlar</span>
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

        {/* Right: status + actions */}
        <div className="flex items-center gap-2 shrink-0">
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
            className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--text-secondary)]"
            title={showSidebar ? 'AI Paneli Kapat' : 'AI Asistan'}
          >
            {showSidebar ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-[var(--card-border)] rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--text-primary)] disabled:opacity-50"
          >
            <Download size={13} />
            {exporting ? 'İndiriliyor...' : 'Word'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-[var(--gold)] text-white rounded-md hover:bg-[var(--gold-hover)] transition-colors disabled:opacity-50"
          >
            {saving ? <RotateCcw size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi!' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      {editor && <EditorToolbar editor={editor} />}

      {/* ── Main Area ── */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas — scrollable gray bg with A4 page */}
        <div className="flex-1 overflow-y-auto editor-canvas">
          <div
            className="a4-page"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            {editor && <EditorContent editor={editor} />}
          </div>
          {/* Bottom spacer */}
          <div style={{ height: `${60 * zoom}px` }} />
        </div>

        {/* Sidebar — AI Assistant */}
        {showSidebar && (
          <aside className="w-[320px] shrink-0 border-l border-[var(--card-border)] bg-white dark:bg-[#1e293b] hidden lg:flex lg:flex-col">
            <AIAssistantPanel
              editor={editor}
              documentTitle={title}
              groupKey={groupKey}
              companyName={companyData.official_name || ''}
              companyData={companyData}
            />
          </aside>
        )}
      </div>

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
            <span>Son kayıt: {lastSavedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
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
    </div>
  );
}

/* ── Helper: TipTap JSON → Markdown ── */
function tiptapToMarkdown(json: JSONContent): string {
  if (!json.content) return '';
  const lines: string[] = [];

  for (const node of json.content) {
    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 1;
        lines.push(`${'#'.repeat(level)} ${extractText(node)}`);
        lines.push('');
        break;
      }
      case 'paragraph':
        lines.push(extractText(node));
        lines.push('');
        break;
      case 'bulletList':
        if (node.content) node.content.forEach((li) => lines.push(`- ${extractText(li)}`));
        lines.push('');
        break;
      case 'orderedList':
        if (node.content) node.content.forEach((li, i) => lines.push(`${i + 1}. ${extractText(li)}`));
        lines.push('');
        break;
      case 'blockquote':
        lines.push(`> ${extractText(node)}`);
        lines.push('');
        break;
      case 'horizontalRule':
        lines.push('---');
        lines.push('');
        break;
      case 'table':
        if (node.content) {
          for (const row of node.content) {
            if (row.content) {
              lines.push(`| ${row.content.map((cell) => extractText(cell)).join(' | ')} |`);
            }
          }
        }
        lines.push('');
        break;
      default:
        lines.push(extractText(node));
        lines.push('');
    }
  }
  return lines.join('\n');
}

function extractText(node: JSONContent): string {
  if (node.text) {
    let t = node.text;
    if (node.marks) {
      for (const m of node.marks) {
        if (m.type === 'bold') t = `**${t}**`;
        if (m.type === 'italic') t = `*${t}*`;
      }
    }
    return t;
  }
  return node.content ? node.content.map(extractText).join('') : '';
}
