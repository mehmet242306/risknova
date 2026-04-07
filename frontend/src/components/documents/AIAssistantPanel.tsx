'use client';

import { useState, useCallback } from 'react';
import {
  Sparkles, Send, RotateCcw, Copy, Check, Wand2, FileText,
  AlertTriangle, BookOpen, CheckCircle2, X, Scissors, Maximize2,
  Scale, MessageSquare,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { markdownToTipTapJSON } from '@/lib/markdown-to-tiptap';

interface CompanyDataForAI {
  sector?: string;
  hazard_class?: string;
  nace_code?: string;
  address?: string;
  city?: string;
  district?: string;
  tax_number?: string;
  employee_count?: number;
  specialist_name?: string;
}

interface AIAssistantPanelProps {
  editor: Editor | null;
  documentTitle: string;
  groupKey: string;
  companyName: string;
  companyData?: CompanyDataForAI;
}

const QUICK_PROMPTS = [
  { icon: Wand2, label: 'Tam Doküman Oluştur', prompt: 'Bu dokümanı profesyonelce oluştur. Tüm bölümleri, tabloları, yasal referansları ekle. Firma bilgilerini içeriğe yerleştir, boş alan bırakma.', primary: true },
  { icon: FileText, label: 'Giriş Bölümü Yaz', prompt: 'Bu doküman için profesyonel bir giriş/amaç bölümü yaz. Firma adını ve sektörünü kullan.' },
  { icon: AlertTriangle, label: 'Yasal Dayanak Ekle', prompt: '6331 sayılı kanun ve ilgili yönetmeliklere göre yasal dayanak bölümü hazırla.' },
  { icon: BookOpen, label: 'Mevzuat Referansları', prompt: 'Bu doküman türü için geçerli tüm mevzuat referanslarını listele.' },
];

const IMPROVE_OPTIONS = [
  { icon: Wand2, label: 'Profesyonelleştir', prompt: 'Bu metni profesyonel İSG dili ile yeniden yaz. Resmi ve kurumsal ton kullan.' },
  { icon: Scissors, label: 'Kısalt', prompt: 'Bu metni özünü bozmadan kısalt ve sadeleştir.' },
  { icon: Maximize2, label: 'Detaylandır', prompt: 'Bu metni daha detaylı ve kapsamlı hale getir. Eksik bilgileri tamamla.' },
  { icon: Scale, label: 'Yasal Referans Ekle', prompt: 'Bu metne ilgili 6331 sayılı kanun maddeleri ve yönetmelik referanslarını ekle.' },
];

export function AIAssistantPanel({ editor, documentTitle, groupKey, companyName, companyData }: AIAssistantPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [inserted, setInserted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [savedSelection, setSavedSelection] = useState<{ text: string; from: number; to: number } | null>(null);
  const [showImproveDialog, setShowImproveDialog] = useState(false);
  const [customImprovePrompt, setCustomImprovePrompt] = useState('');

  const captureSelection = useCallback(() => {
    if (!editor) return null;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      const text = editor.state.doc.textBetween(from, to, ' ');
      if (text && text.trim().length > 3) {
        const sel = { text, from, to };
        setSavedSelection(sel);
        return sel;
      }
    }
    return null;
  }, [editor]);

  const insertToEditor = useCallback((markdown: string) => {
    if (!editor || !markdown) return;
    try {
      const json = markdownToTipTapJSON(markdown);
      if (json.content && json.content.length > 0) {
        const isEmpty = editor.state.doc.textContent.trim().length === 0;
        if (isEmpty) {
          editor.commands.setContent(json);
        } else {
          editor.chain().focus().insertContent(json.content).run();
        }
      }
      setInserted(true);
    } catch (err) {
      console.error('Markdown conversion error:', err);
      editor.chain().focus().insertContent(markdown).run();
      setInserted(true);
    }
  }, [editor]);

  const replaceSelection = useCallback((markdown: string, from: number, to: number) => {
    if (!editor || !markdown) return;
    try {
      const json = markdownToTipTapJSON(markdown);
      if (json.content && json.content.length > 0) {
        // Select the original text range and replace
        editor.chain().focus().setTextSelection({ from, to }).deleteSelection().insertContent(json.content).run();
      }
    } catch (err) {
      console.error('Replace error:', err);
      editor.chain().focus().setTextSelection({ from, to }).deleteSelection().insertContent(markdown).run();
    }
  }, [editor]);

  const generateContent = async (prompt: string, autoInsert = true) => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    setInserted(false);

    try {
      const res = await fetch('/api/document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, companyName, companyData, documentTitle, groupKey }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.content || data.analysis || data.response || '';
        setResult(content);
        // Auto-insert when generating full documents
        if (autoInsert && content) {
          insertToEditor(content);
        }
      } else {
        setResult('Hata: AI servisi şu anda yanıt veremiyor. Lütfen tekrar deneyin.');
      }
    } catch {
      setResult('Bağlantı hatası. Internet bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const generateImprovement = async (improvePrompt: string) => {
    if (!savedSelection) return;
    setShowImproveDialog(false);
    setLoading(true);
    setResult(null);
    setInserted(false);

    const fullPrompt = `${improvePrompt}\n\nİyileştirilecek metin:\n"${savedSelection.text}"`;

    try {
      const res = await fetch('/api/document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, companyName, companyData, documentTitle, groupKey }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.content || '';
        setResult(content);
        if (content) {
          replaceSelection(content, savedSelection.from, savedSelection.to);
          setInserted(true);
        }
      } else {
        setResult('Hata: AI servisi yanıt veremiyor.');
      }
    } catch {
      setResult('Bağlantı hatası.');
    } finally {
      setLoading(false);
      setSavedSelection(null);
    }
  };

  const handleCustomPrompt = () => {
    if (!customPrompt.trim()) return;
    generateContent(customPrompt.trim(), true);
    setCustomPrompt('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--gold)]/20">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--gold)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Asistan</h3>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
          {companyName ? `${companyName} için` : ''} içerik üretimi ve düzenleme
        </p>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 space-y-2 border-b border-[var(--gold)]/20">
        {QUICK_PROMPTS.map((qp, i) => {
          const Icon = qp.icon;
          return (
            <button
              key={i}
              onClick={() => generateContent(qp.prompt, true)}
              disabled={loading}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                qp.primary
                  ? 'bg-[var(--gold)] text-white hover:bg-[var(--gold-hover)]'
                  : 'border border-[var(--gold)]/20 text-[var(--text-primary)] hover:bg-[var(--gold)]/10 hover:border-[var(--gold)]/40'
              }`}
            >
              <Icon size={14} />
              {qp.label}
            </button>
          );
        })}
      </div>

      {/* Custom Prompt */}
      <div className="px-4 py-3 border-b border-[var(--gold)]/20">
        <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 block">Özel İstek</label>
        <div className="flex gap-2">
          <input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomPrompt(); }}
            placeholder="Ne üretmemi istersiniz?"
            className="flex-1 text-xs px-2.5 py-2 rounded-lg border border-[var(--gold)]/20 bg-white dark:bg-[#0f172a] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)] placeholder:text-[var(--text-secondary)]"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim() || loading}
            className="p-2 bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors disabled:opacity-40 shrink-0"
          >
            <Send size={13} />
          </button>
        </div>
      </div>

      {/* Seçili Metni İyileştir — buton sırası: önce bu, sonra sonuç */}
      <div className="px-4 py-3 border-b border-[var(--gold)]/20">
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            captureSelection();
          }}
          onClick={() => {
            if (savedSelection) {
              setShowImproveDialog(true);
            }
          }}
          disabled={loading}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium border rounded-lg transition-colors disabled:opacity-50 ${
            savedSelection
              ? 'border-[var(--gold)]/40 text-[var(--gold)] bg-[var(--gold)]/5'
              : 'border-[var(--gold)]/20 text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40'
          }`}
        >
          <Wand2 size={13} />
          Seçili Metni İyileştir
          {savedSelection && (
            <span className="ml-auto text-[10px] text-[var(--gold)]/70 truncate max-w-[120px]">
              &ldquo;{savedSelection.text.slice(0, 25)}...&rdquo;
            </span>
          )}
        </button>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">Editörde metin seçip bu butonu tıklayın.</p>
      </div>

      {/* Result Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <RotateCcw size={16} className="animate-spin text-[var(--gold)]" />
            <span className="text-sm text-[var(--text-secondary)]">İçerik oluşturuluyor...</span>
          </div>
        )}

        {!loading && !result && (
          <div className="text-center py-8">
            <Sparkles size={28} className="mx-auto text-[var(--gold)]/30 mb-3" />
            <p className="text-xs text-[var(--text-secondary)]">
              Yukarıdaki butonlardan birini tıklayarak<br />AI ile içerik oluşturmaya başlayın.
            </p>
          </div>
        )}

        {!loading && result && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-medium ${inserted ? 'text-green-600' : 'text-[var(--gold)]'}`}>
                {inserted ? '✓ Editöre Eklendi' : 'AI Sonucu'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  Kopyala
                </button>
              </div>
            </div>
            <div className={`text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap rounded-lg p-3 max-h-[250px] overflow-y-auto border ${
              inserted
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'
                : 'bg-[var(--gold)]/5 border-[var(--gold)]/15'
            }`}>
              {result}
            </div>
            {!inserted && (
              <button
                onClick={() => insertToEditor(result)}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors"
              >
                <FileText size={14} />
                Editöre Ekle
              </button>
            )}
            {inserted && (
              <div className="flex items-center justify-center gap-1.5 mt-2 py-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 size={13} />
                İçerik editöre başarıyla eklendi
              </div>
            )}
          </div>
        )}
      </div>

      {/* İyileştirme Dialog'u */}
      {showImproveDialog && savedSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl w-[380px] max-w-[95vw] border border-[var(--gold)]/20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--gold)]/20">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-[var(--gold)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Metni İyileştir</h3>
              </div>
              <button
                onClick={() => { setShowImproveDialog(false); setSavedSelection(null); }}
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3">
              <p className="text-[11px] text-[var(--text-secondary)] mb-1">Seçili metin:</p>
              <p className="text-xs text-[var(--text-primary)] bg-[var(--gold)]/5 rounded-lg p-2 mb-4 max-h-[80px] overflow-y-auto italic">
                &ldquo;{savedSelection.text.slice(0, 200)}{savedSelection.text.length > 200 ? '...' : ''}&rdquo;
              </p>

              <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-2">Ne tür iyileştirme yapılsın?</p>
              <div className="space-y-1.5">
                {IMPROVE_OPTIONS.map((opt, i) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => generateImprovement(opt.prompt)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--gold)]/20 rounded-lg text-[var(--text-primary)] hover:bg-[var(--gold)]/10 hover:border-[var(--gold)]/40 transition-colors"
                    >
                      <Icon size={13} className="text-[var(--gold)]" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Özel istek */}
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    value={customImprovePrompt}
                    onChange={(e) => setCustomImprovePrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customImprovePrompt.trim()) {
                        generateImprovement(customImprovePrompt.trim());
                        setCustomImprovePrompt('');
                      }
                    }}
                    placeholder="Özel iyileştirme isteği..."
                    className="flex-1 text-xs px-2.5 py-2 rounded-lg border border-[var(--gold)]/20 bg-white dark:bg-[#0f172a] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
                  />
                  <button
                    onClick={() => {
                      if (customImprovePrompt.trim()) {
                        generateImprovement(customImprovePrompt.trim());
                        setCustomImprovePrompt('');
                      }
                    }}
                    disabled={!customImprovePrompt.trim()}
                    className="p-2 bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors disabled:opacity-40"
                  >
                    <MessageSquare size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
