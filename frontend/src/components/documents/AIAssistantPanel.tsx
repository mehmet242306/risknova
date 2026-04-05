'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, RotateCcw, Copy, Check, FileText, Wand2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface AIAssistantPanelProps {
  editor: Editor | null;
  documentTitle: string;
  groupKey: string;
  companyName: string;
}

type AIMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function AIAssistantPanel({ editor, documentTitle, groupKey, companyName }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/analyze-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Sen bir İSG (İş Sağlığı ve Güvenliği) uzman asistanısın. ${companyName} firması için "${documentTitle}" dokümanı hazırlanıyor (grup: ${groupKey}). Kullanıcının isteğine Türkçe yanıt ver. 6331 sayılı kanun ve ilgili mevzuata referans ver.\n\nKullanıcı: ${userMsg}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiText = data.analysis || data.response || data.result || 'Yanıt alınamadı.';
        setMessages((prev) => [...prev, { role: 'assistant', content: aiText }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Bir hata oluştu. Lütfen tekrar deneyin.' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Bağlantı hatası. Lütfen tekrar deneyin.' }]);
    } finally {
      setLoading(false);
    }
  };

  const insertToEditor = (text: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const generateFullDocument = async () => {
    if (loading) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: `"${documentTitle}" dokümanını ${companyName} firması için tam olarak oluştur.` }]);

    try {
      const res = await fetch('/api/analyze-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Sen bir İSG uzman asistanısın. ${companyName} firması için "${documentTitle}" dokümanını profesyonelce hazırla. Tüm bölümleri, tabloları ve yasal referansları ekle. 6331 sayılı kanun ve ilgili yönetmeliklere atıf yap. Doküman doğrudan kullanılabilir olmalı. Türkçe yaz.`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiText = data.analysis || data.response || data.result || '';
        setMessages((prev) => [...prev, { role: 'assistant', content: aiText }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Doküman oluşturulamadı.' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Bağlantı hatası.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--card-border)]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--gold)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Asistan</h3>
        </div>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">
          İSG mevzuatına uygun içerik önerisi alın veya dokümanı tamamen oluşturun.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 space-y-2 border-b border-[var(--card-border)]">
        <button
          onClick={generateFullDocument}
          disabled={loading}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium bg-[var(--gold)]/10 text-[var(--gold)] rounded-lg hover:bg-[var(--gold)]/20 transition-colors disabled:opacity-50"
        >
          <Wand2 size={14} />
          Tam Doküman Oluştur (AI)
        </button>
        <button
          onClick={() => {
            if (!editor) return;
            const selected = editor.state.doc.textBetween(
              editor.state.selection.from,
              editor.state.selection.to,
              ' '
            );
            if (selected) {
              setInput(`Bu bölümü iyileştir ve mevzuata uygun hale getir:\n\n"${selected}"`);
            }
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--card-border)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)]"
        >
          <FileText size={14} />
          Seçili Bölümü İyileştir
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles size={24} className="mx-auto text-[var(--gold)]/40 mb-2" />
            <p className="text-xs text-[var(--text-secondary)]">
              Sorularınızı sorun veya &quot;Tam Doküman Oluştur&quot; ile başlayın.
            </p>
            <div className="mt-3 space-y-1.5">
              {[
                'Risk değerlendirme raporuna giriş yazısı oluştur',
                'Acil durum planı için yasal dayanak ekle',
                'Eğitim formuna katılımcı tablosu ekle',
              ].map((hint) => (
                <button
                  key={hint}
                  onClick={() => setInput(hint)}
                  className="block w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors"
                >
                  → {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[95%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--gold)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-black/10 dark:border-white/10">
                  <button
                    onClick={() => insertToEditor(msg.content)}
                    className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? 'Eklendi' : 'Editöre Ekle'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-secondary)] rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5">
                <RotateCcw size={12} className="animate-spin text-[var(--gold)]" />
                <span className="text-xs text-[var(--text-secondary)]">Düşünüyor...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-[var(--card-border)]">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder="İSG sorusu sorun veya içerik isteyin..."
            rows={2}
            className="flex-1 resize-none text-xs px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)] placeholder:text-[var(--text-secondary)]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-2 bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
