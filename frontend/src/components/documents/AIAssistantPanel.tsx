'use client';

import { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Maximize2,
  MessageSquare,
  RotateCcw,
  Scale,
  Scissors,
  Send,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
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

type DocumentAiResponse = {
  content?: string;
  analysis?: string;
  response?: string;
  error?: string;
  degraded?: boolean;
  queuedTaskId?: string | null;
  fallback?: {
    type?: string;
    label?: string;
  };
};

const QUICK_PROMPTS = [
  {
    icon: Wand2,
    label: 'Tam Dokuman Olustur',
    prompt:
      'Bu dokumani profesyonelce olustur. Tum bolumleri, tabloları ve yasal referanslari ekle. Firma bilgilerini icerige yerlestir, bos alan birakma.',
    primary: true,
  },
  {
    icon: FileText,
    label: 'Giris Bolumu Yaz',
    prompt: 'Bu dokuman icin profesyonel bir giris ve amac bolumu yaz. Firma adini ve sektorunu kullan.',
  },
  {
    icon: AlertTriangle,
    label: 'Yasal Dayanak Ekle',
    prompt: '6331 sayili kanun ve ilgili yonetmeliklere gore yasal dayanak bolumu hazirla.',
  },
  {
    icon: BookOpen,
    label: 'Mevzuat Referanslari',
    prompt: 'Bu dokuman turu icin gecerli tum mevzuat referanslarini listele.',
  },
] as const satisfies ReadonlyArray<{
  icon: typeof Wand2;
  label: string;
  prompt: string;
  primary?: boolean;
}>;

const IMPROVE_OPTIONS = [
  {
    icon: Wand2,
    label: 'Professionellestir',
    prompt: 'Bu metni profesyonel ISG dili ile yeniden yaz. Resmi ve kurumsal ton kullan.',
  },
  {
    icon: Scissors,
    label: 'Kisalt',
    prompt: 'Bu metni ozunu bozmadan kisalt ve sadeleştir.',
  },
  {
    icon: Maximize2,
    label: 'Detaylandir',
    prompt: 'Bu metni daha detayli ve kapsamli hale getir. Eksik bilgileri tamamla.',
  },
  {
    icon: Scale,
    label: 'Yasal Referans Ekle',
    prompt: 'Bu metne ilgili 6331 sayili kanun maddeleri ve yonetmelik referanslarini ekle.',
  },
] as const;

function extractContent(data: DocumentAiResponse) {
  return data.content || data.analysis || data.response || '';
}

export function AIAssistantPanel({
  editor,
  documentTitle,
  groupKey,
  companyName,
  companyData,
}: AIAssistantPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [queueTaskId, setQueueTaskId] = useState<string | null>(null);
  const [inserted, setInserted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [savedSelection, setSavedSelection] = useState<{ text: string; from: number; to: number } | null>(null);
  const [showImproveDialog, setShowImproveDialog] = useState(false);
  const [customImprovePrompt, setCustomImprovePrompt] = useState('');

  const captureSelection = useCallback(() => {
    if (!editor) return null;

    const { from, to } = editor.state.selection;
    if (from === to) return null;

    const text = editor.state.doc.textBetween(from, to, ' ');
    if (!text || text.trim().length <= 3) return null;

    const selection = { text, from, to };
    setSavedSelection(selection);
    return selection;
  }, [editor]);

  const insertToEditor = useCallback(
    (markdown: string) => {
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
      } catch (error) {
        console.error('Markdown conversion error:', error);
        editor.chain().focus().insertContent(markdown).run();
        setInserted(true);
      }
    },
    [editor],
  );

  const replaceSelection = useCallback(
    (markdown: string, from: number, to: number) => {
      if (!editor || !markdown) return;

      try {
        const json = markdownToTipTapJSON(markdown);
        if (json.content && json.content.length > 0) {
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .deleteSelection()
            .insertContent(json.content)
            .run();
        }
      } catch (error) {
        console.error('Replace error:', error);
        editor.chain().focus().setTextSelection({ from, to }).deleteSelection().insertContent(markdown).run();
      }
    },
    [editor],
  );

  const resetRunState = useCallback(() => {
    setResult(null);
    setDegraded(false);
    setQueueTaskId(null);
    setInserted(false);
  }, []);

  const applyAiError = useCallback((data: DocumentAiResponse, fallbackMessage: string) => {
    const content = extractContent(data);
    setDegraded(Boolean(data.degraded));
    setQueueTaskId(typeof data.queuedTaskId === 'string' ? data.queuedTaskId : null);
    setResult(
      content ||
        (typeof data.error === 'string' && data.error.trim().length > 0 ? data.error : fallbackMessage),
    );
    return content;
  }, []);

  const generateContent = async (prompt: string, autoInsert = true) => {
    if (loading) return;

    setLoading(true);
    resetRunState();

    try {
      const res = await fetch('/api/document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, companyName, companyData, documentTitle, groupKey }),
      });

      const data = (await res.json().catch(() => ({}))) as DocumentAiResponse;

      if (!res.ok) {
        const fallbackContent = applyAiError(
          data,
          'Hata: AI servisi su anda yanit veremiyor. Lutfen tekrar deneyin.',
        );
        if (autoInsert && fallbackContent) {
          insertToEditor(fallbackContent);
        }
        return;
      }

      const content = extractContent(data);
      setDegraded(Boolean(data.degraded));
      setQueueTaskId(typeof data.queuedTaskId === 'string' ? data.queuedTaskId : null);
      setResult(content);
      if (autoInsert && content) {
        insertToEditor(content);
      }
    } catch {
      setResult('Baglanti hatasi. Internet baglantinizi kontrol edip tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const generateImprovement = async (improvePrompt: string) => {
    if (!savedSelection) return;

    setShowImproveDialog(false);
    setLoading(true);
    resetRunState();

    const fullPrompt = `${improvePrompt}\n\nIyilestirilecek metin:\n"${savedSelection.text}"`;

    try {
      const res = await fetch('/api/document-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, companyName, companyData, documentTitle, groupKey }),
      });

      const data = (await res.json().catch(() => ({}))) as DocumentAiResponse;

      if (!res.ok) {
        applyAiError(data, 'Hata: AI servisi su anda yanit veremiyor.');
        return;
      }

      const content = extractContent(data);
      setDegraded(Boolean(data.degraded));
      setQueueTaskId(typeof data.queuedTaskId === 'string' ? data.queuedTaskId : null);
      setResult(content);

      if (content) {
        replaceSelection(content, savedSelection.from, savedSelection.to);
        setInserted(true);
      }
    } catch {
      setResult('Baglanti hatasi.');
    } finally {
      setLoading(false);
      setSavedSelection(null);
    }
  };

  const handleCustomPrompt = () => {
    if (!customPrompt.trim()) return;
    void generateContent(customPrompt.trim(), true);
    setCustomPrompt('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--gold)]/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--gold)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">AI Asistan</h3>
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
          {companyName ? `${companyName} icin ` : ''}icerik uretimi ve duzenleme
        </p>
      </div>

      <div className="space-y-2 border-b border-[var(--gold)]/20 px-4 py-3">
        {QUICK_PROMPTS.map((prompt) => {
          const Icon = prompt.icon;
          return (
            <button
              key={prompt.label}
              onClick={() => void generateContent(prompt.prompt, true)}
              disabled={loading}
              className={`w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                ("primary" in prompt && prompt.primary)
                  ? 'flex items-center gap-2 bg-[var(--gold)] text-white hover:bg-[var(--gold-hover)]'
                  : 'flex items-center gap-2 border border-[var(--gold)]/20 text-[var(--text-primary)] hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/10'
              }`}
            >
              <Icon size={14} />
              {prompt.label}
            </button>
          );
        })}
      </div>

      <div className="border-b border-[var(--gold)]/20 px-4 py-3">
        <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-secondary)]">Ozel Istek</label>
        <div className="flex gap-2">
          <input
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleCustomPrompt();
              }
            }}
            placeholder="Ne uretmemi istersiniz?"
            className="flex-1 rounded-lg border border-[var(--gold)]/20 bg-white px-2.5 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)] dark:bg-[#0f172a]"
          />
          <button
            onClick={handleCustomPrompt}
            disabled={!customPrompt.trim() || loading}
            className="shrink-0 rounded-lg bg-[var(--gold)] p-2 text-white transition-colors hover:bg-[var(--gold-hover)] disabled:opacity-40"
          >
            <Send size={13} />
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--gold)]/20 px-4 py-3">
        <button
          onMouseDown={(event) => {
            event.preventDefault();
            captureSelection();
          }}
          onClick={() => {
            if (savedSelection) {
              setShowImproveDialog(true);
            }
          }}
          disabled={loading}
          className={`w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
            savedSelection
              ? 'flex items-center gap-2 border-[var(--gold)]/40 bg-[var(--gold)]/5 text-[var(--gold)]'
              : 'flex items-center gap-2 border-[var(--gold)]/20 text-[var(--text-secondary)] hover:border-[var(--gold)]/40 hover:text-[var(--gold)]'
          }`}
        >
          <Wand2 size={13} />
          Secili Metni Iyilestir
          {savedSelection ? (
            <span className="ml-auto max-w-[120px] truncate text-[10px] text-[var(--gold)]/70">
              &ldquo;{savedSelection.text.slice(0, 25)}...&rdquo;
            </span>
          ) : null}
        </button>
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">Editorde metin secip bu butonu tiklayin.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <RotateCcw size={16} className="animate-spin text-[var(--gold)]" />
            <span className="text-sm text-[var(--text-secondary)]">Icerik olusturuluyor...</span>
          </div>
        ) : null}

        {!loading && !result ? (
          <div className="py-8 text-center">
            <Sparkles size={28} className="mx-auto mb-3 text-[var(--gold)]/30" />
            <p className="text-xs text-[var(--text-secondary)]">
              Yukaridaki butonlardan birini tiklayarak
              <br />
              AI ile icerik olusturmaya baslayin.
            </p>
          </div>
        ) : null}

        {!loading && result ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`text-[11px] font-medium ${
                inserted
                  ? 'text-green-600'
                  : degraded
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-[var(--gold)]'
                }`}
              >
                {inserted ? 'Editora Eklendi' : degraded ? 'Yerel Taslak' : 'AI Sonucu'}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                Kopyala
              </button>
            </div>

            <div
              className={`max-h-[250px] overflow-y-auto whitespace-pre-wrap rounded-lg border p-3 text-xs leading-relaxed text-[var(--text-primary)] ${
                inserted
                  ? 'border-green-200 bg-green-50 dark:border-green-800/30 dark:bg-green-900/10'
                  : degraded
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20'
                    : 'border-[var(--gold)]/15 bg-[var(--gold)]/5'
              }`}
            >
              {result}
            </div>

            {degraded ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200">
                AI servisi gecici olarak korumali modda calisti. Yerel taslak uretildi; duzenleyip kaydedebilirsiniz.
                {queueTaskId
                  ? ` Kuyruk gorevi: ${queueTaskId}`
                  : ' Istek arka planda isleniyor olabilir; kisa sure sonra tekrar deneyin.'}
              </div>
            ) : null}

            {!inserted ? (
              <button
                onClick={() => insertToEditor(result)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--gold)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--gold-hover)]"
              >
                <FileText size={14} />
                {degraded ? 'Yerel Taslagi Editore Ekle' : 'Editore Ekle'}
              </button>
            ) : null}

            {inserted ? (
              <div className="mt-2 flex items-center justify-center gap-1.5 py-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 size={13} />
                Icerik editore basariyla eklendi
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showImproveDialog && savedSelection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[380px] max-w-[95vw] rounded-xl border border-[var(--gold)]/20 bg-white shadow-2xl dark:bg-[#1e293b]">
            <div className="flex items-center justify-between border-b border-[var(--gold)]/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-[var(--gold)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Metni Iyilestir</h3>
              </div>
              <button
                onClick={() => {
                  setShowImproveDialog(false);
                  setSavedSelection(null);
                }}
                className="rounded-md p-1 text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3">
              <p className="mb-1 text-[11px] text-[var(--text-secondary)]">Secili metin:</p>
              <p className="mb-4 max-h-[80px] overflow-y-auto rounded-lg bg-[var(--gold)]/5 p-2 text-xs italic text-[var(--text-primary)]">
                &ldquo;{savedSelection.text.slice(0, 200)}
                {savedSelection.text.length > 200 ? '...' : ''}&rdquo;
              </p>

              <p className="mb-2 text-[11px] font-medium text-[var(--text-secondary)]">Ne tur iyilestirme yapilsin?</p>
              <div className="space-y-1.5">
                {IMPROVE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.label}
                      onClick={() => void generateImprovement(option.prompt)}
                      className="flex w-full items-center gap-2 rounded-lg border border-[var(--gold)]/20 px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--gold)]/40 hover:bg-[var(--gold)]/10"
                    >
                      <Icon size={13} className="text-[var(--gold)]" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    value={customImprovePrompt}
                    onChange={(event) => setCustomImprovePrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && customImprovePrompt.trim()) {
                        void generateImprovement(customImprovePrompt.trim());
                        setCustomImprovePrompt('');
                      }
                    }}
                    placeholder="Ozel iyilestirme istegi..."
                    className="flex-1 rounded-lg border border-[var(--gold)]/20 bg-white px-2.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)] dark:bg-[#0f172a]"
                  />
                  <button
                    onClick={() => {
                      if (customImprovePrompt.trim()) {
                        void generateImprovement(customImprovePrompt.trim());
                        setCustomImprovePrompt('');
                      }
                    }}
                    disabled={!customImprovePrompt.trim()}
                    className="rounded-lg bg-[var(--gold)] p-2 text-white transition-colors hover:bg-[var(--gold-hover)] disabled:opacity-40"
                  >
                    <MessageSquare size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
