'use client';

import { useState } from 'react';
import { Sparkles, Send, RotateCcw, Copy, Check, Wand2, FileText, AlertTriangle, BookOpen } from 'lucide-react';
import type { Editor } from '@tiptap/react';

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
  { icon: Wand2, label: 'Tam Doküman Oluştur', prompt: 'Bu dokümanı profesyonelce oluştur. Tüm bölümleri, tabloları, yasal referansları ekle.', primary: true },
  { icon: FileText, label: 'Giriş Bölümü Yaz', prompt: 'Bu doküman için profesyonel bir giriş/amaç bölümü yaz.' },
  { icon: AlertTriangle, label: 'Yasal Dayanak Ekle', prompt: '6331 sayılı kanun ve ilgili yönetmeliklere göre yasal dayanak bölümü hazırla.' },
  { icon: BookOpen, label: 'Mevzuat Referansları', prompt: 'Bu doküman türü için geçerli tüm mevzuat referanslarını listele.' },
];

export function AIAssistantPanel({ editor, documentTitle, groupKey, companyName, companyData }: AIAssistantPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const generateContent = async (prompt: string) => {
    if (loading) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          companyName,
          companyData,
          documentTitle,
          groupKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.content || data.analysis || data.response || 'Yanıt alınamadı.');
      } else {
        setResult('Hata: AI servisi şu anda yanıt veremiyor. Lütfen tekrar deneyin.');
      }
    } catch {
      setResult('Bağlantı hatası. Internet bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const insertToEditor = () => {
    if (!editor || !result) return;
    editor.chain().focus().insertContent(result).run();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCustomPrompt = () => {
    if (!customPrompt.trim()) return;
    generateContent(customPrompt.trim());
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
              onClick={() => generateContent(qp.prompt)}
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
              <span className="text-[11px] font-medium text-[var(--gold)]">AI Sonucu</span>
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
            <div className="text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap bg-[var(--gold)]/5 border border-[var(--gold)]/15 rounded-lg p-3 max-h-[300px] overflow-y-auto">
              {result}
            </div>
            <button
              onClick={insertToEditor}
              className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors"
            >
              <FileText size={14} />
              Editöre Ekle
            </button>
          </div>
        )}
      </div>

      {/* Seçili Bölümü İyileştir */}
      <div className="px-4 py-3 border-t border-[var(--gold)]/20">
        <button
          onClick={() => {
            if (!editor) return;
            const sel = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ');
            if (sel && sel.length > 3) {
              generateContent(`Aşağıdaki metni İSG mevzuatına uygun şekilde iyileştir ve profesyonelleştir:\n\n"${sel}"`);
            }
          }}
          disabled={loading}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--gold)]/20 rounded-lg text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 transition-colors disabled:opacity-50"
        >
          <Wand2 size={13} />
          Seçili Metni İyileştir
        </button>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">Editörde metin seçip bu butonu tıklayın.</p>
      </div>
    </div>
  );
}
