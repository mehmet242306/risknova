'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Save, Download, FileText, Clock, CheckCircle2,
  FileEdit, AlertCircle, Sparkles, ChevronRight, Eye,
  RotateCcw, Settings2, PanelRightOpen, PanelRightClose,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fetchDocument, createDocument, updateDocument,
  createVersion, fetchVersions,
  type DocumentRecord, type DocumentVersionRecord,
} from '@/lib/supabase/document-api';
import { getP1Template } from '@/lib/document-templates-p1';
import { getGroupByKey, DOCUMENT_GROUPS } from '@/lib/document-groups';
import {
  resolveVariables, DOCUMENT_VARIABLES,
  type CompanyVariableData,
} from '@/lib/document-variables';
import { TipTapEditor } from '@/components/documents/TipTapEditor';
import { VariableMenu } from '@/components/documents/VariableMenu';
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

  // Query params for new doc
  const qGroup = searchParams.get('group') || '';
  const qTitle = searchParams.get('title') || '';
  const qTemplateId = searchParams.get('templateId') || '';

  // State
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [content, setContent] = useState<JSONContent | null>(null);
  const [title, setTitle] = useState(qTitle || 'Yeni Doküman');
  const [groupKey, setGroupKey] = useState(qGroup || '');
  const [status, setStatus] = useState<DocumentRecord['status']>('taslak');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [versions, setVersions] = useState<DocumentVersionRecord[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CompanyVariableData>({});
  const [variablesResolved, setVariablesResolved] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load user, org, company data
  useEffect(() => {
    async function loadContext() {
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

      // Load company data for variables
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

      // Load existing document or template
      if (documentId) {
        const existingDoc = await fetchDocument(documentId);
        if (existingDoc) {
          setDoc(existingDoc);
          setContent(existingDoc.content_json as JSONContent);
          setTitle(existingDoc.title);
          setGroupKey(existingDoc.group_key);
          setStatus(existingDoc.status);

          const vers = await fetchVersions(documentId);
          setVersions(vers);
        }
      } else if (qTemplateId) {
        // Load P1 template
        const template = getP1Template(qTemplateId);
        if (template) {
          setContent(template.content);
          setTitle(template.title);
          setGroupKey(template.groupKey);
        }
      }

      setLoading(false);
    }
    loadContext();
  }, [documentId, qTemplateId]);

  // Save document
  const handleSave = useCallback(async () => {
    if (!orgId || !content) return;
    setSaving(true);

    try {
      if (doc) {
        // Update existing
        const updated = await updateDocument(doc.id, {
          title,
          content_json: content as Record<string, unknown>,
          status,
        });
        if (updated) {
          setDoc(updated);
          // Create version
          await createVersion(doc.id, doc.version + 1, content as Record<string, unknown>, userId);
        }
      } else {
        // Create new
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
          // Navigate to the doc's edit URL
          router.replace(`/documents/${newDoc.id}`);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [orgId, content, doc, title, status, groupKey, userId, companyData, router]);

  // Export to DOCX
  const handleExport = useCallback(async () => {
    if (!content) return;
    setExporting(true);
    try {
      // Dynamic import to reduce bundle
      const { generateDocx } = await import('@/lib/document-generator');

      // Convert TipTap JSON to markdown-like content
      const textContent = tiptapToMarkdown(content);
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
  }, [content, title, groupKey, companyData]);

  // Insert variable into editor
  const handleInsertVariable = useCallback((key: string) => {
    // This inserts the variable placeholder text
    // The editor will show it as {{key}}
    const text = `{{${key}}}`;
    // We can't directly control TipTap from here easily,
    // so we'll use a global event approach
    window.dispatchEvent(new CustomEvent('insert-variable', { detail: text }));
  }, []);

  // Change status
  const handleStatusChange = (newStatus: DocumentRecord['status']) => {
    setStatus(newStatus);
  };

  const group = getGroupByKey(groupKey);
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.taslak;
  const StatusIcon = statusCfg.icon;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3 mb-4" />
        <div className="h-[500px] bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header card — breadcrumb + title + actions */}
      <div className="border border-[var(--card-border)] rounded-xl bg-white dark:bg-[#1e293b] shadow-sm mb-6 overflow-hidden">
        {/* Top row: breadcrumb left + action buttons right */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--card-border)] bg-[var(--bg-secondary)]/30">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/documents')}
              className="p-1 rounded-md hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)]"
              title="Geri"
            >
              <ArrowLeft size={16} />
            </button>
            <nav className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
              <span className="hover:text-[var(--text-primary)] cursor-pointer" onClick={() => router.push('/documents')}>Dokümanlar</span>
              <ChevronRight size={14} className="opacity-40" />
              {group && <span>{group.title}</span>}
              {group && <ChevronRight size={14} className="opacity-40" />}
              <span className="text-[var(--text-primary)] font-medium">{title}</span>
            </nav>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)]"
              title={showSidebar ? 'Paneli Kapat' : 'Değişken Paneli'}
            >
              {showSidebar ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || !content}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--card-border)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-primary)] disabled:opacity-50"
            >
              <Download size={14} />
              {exporting ? 'İndiriliyor...' : 'Word İndir'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !content}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors disabled:opacity-50"
            >
              {saving ? (
                <RotateCcw size={14} className="animate-spin" />
              ) : saved ? (
                <CheckCircle2 size={14} />
              ) : (
                <Save size={14} />
              )}
              {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi' : 'Kaydet'}
            </button>
          </div>
        </div>

        {/* Bottom row: title + status */}
        <div className="flex items-center gap-3 px-5 py-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 text-lg font-bold text-[var(--text-primary)] bg-transparent border-none outline-none min-w-0"
            placeholder="Doküman başlığı..."
          />
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusCfg.color}`}>
            <StatusIcon size={12} />
            {statusCfg.label}
          </div>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as DocumentRecord['status'])}
            className="text-xs px-2 py-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)] shrink-0"
          >
            <option value="taslak">Taslak</option>
            <option value="hazir">Hazır</option>
            <option value="onay_bekliyor">Onay Bekliyor</option>
            <option value="revizyon">Revizyon</option>
          </select>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex gap-4">
        {/* Editor */}
        <div className="flex-1 min-w-0">
          <TipTapEditor
            content={content || undefined}
            onChange={setContent}
            placeholder="Doküman içeriğini yazın veya şablondan başlayın..."
          />

          {/* Version info */}
          {doc && (
            <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
              <span>Versiyon: {doc.version}</span>
              <span>Son güncelleme: {new Date(doc.updated_at).toLocaleString('tr-TR')}</span>
              {versions.length > 0 && (
                <span>{versions.length} önceki sürüm</span>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="w-64 shrink-0 hidden lg:block">
            <div className="sticky top-24 border border-[var(--card-border)] rounded-xl p-4 bg-white dark:bg-[#1e293b] shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto">
              <VariableMenu onInsert={handleInsertVariable} />

              {/* Quick info */}
              <div className="mt-6 pt-4 border-t border-[var(--card-border)]">
                <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Doküman Bilgisi</h4>
                <div className="space-y-1.5">
                  {group && (
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      <span className="font-medium">Grup:</span> {group.title}
                    </div>
                  )}
                  <div className="text-[10px] text-[var(--text-secondary)]">
                    <span className="font-medium">Durum:</span> {statusCfg.label}
                  </div>
                  {doc && (
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      <span className="font-medium">Oluşturulma:</span>{' '}
                      {new Date(doc.created_at).toLocaleDateString('tr-TR')}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Suggestion placeholder */}
              <div className="mt-4 pt-4 border-t border-[var(--card-border)]">
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--gold)] bg-[var(--gold)]/10 rounded-lg hover:bg-[var(--gold)]/20 transition-colors"
                  onClick={() => {/* AI integration coming soon */}}
                >
                  <Sparkles size={14} />
                  AI İçerik Önerisi
                </button>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
                  Mevzuata uygun içerik önerisi alın.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: Convert TipTap JSON to markdown-like text for export
function tiptapToMarkdown(json: JSONContent): string {
  if (!json.content) return '';

  const lines: string[] = [];

  for (const node of json.content) {
    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 1;
        const prefix = '#'.repeat(level);
        lines.push(`${prefix} ${extractText(node)}`);
        lines.push('');
        break;
      }
      case 'paragraph':
        lines.push(extractText(node));
        lines.push('');
        break;
      case 'bulletList':
        if (node.content) {
          for (const li of node.content) {
            lines.push(`- ${extractText(li)}`);
          }
        }
        lines.push('');
        break;
      case 'orderedList':
        if (node.content) {
          node.content.forEach((li, i) => {
            lines.push(`${i + 1}. ${extractText(li)}`);
          });
        }
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
              const cells = row.content.map((cell) => extractText(cell));
              lines.push(`| ${cells.join(' | ')} |`);
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
    let text = node.text;
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `**${text}**`;
        if (mark.type === 'italic') text = `*${text}*`;
        if (mark.type === 'underline') text = `__${text}__`;
      }
    }
    return text;
  }
  if (node.content) {
    return node.content.map(extractText).join('');
  }
  return '';
}
