'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Table as TableIcon, Highlighter, Palette,
  Undo, Redo, Minus, Printer, Type,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor;
}

/* ── Reusable Button ── */
function Btn({
  onClick, active, disabled, title, children, className = '',
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
        active
          ? 'bg-[var(--gold)]/15 text-[var(--gold)]'
          : 'text-[var(--text-secondary)] hover:bg-black/5 hover:text-[var(--text-primary)] dark:hover:bg-white/10'
      } ${disabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-[var(--card-border)] mx-1" />;
}

/* ── Hook: fixed popup positioning ── */
function useFixedPopup() {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const toggle = useCallback(() => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(!open);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return { triggerRef, open, pos, toggle, close };
}

/* ── Color Picker Popover ── */
const COLORS = [
  '#000000', '#434343', '#666666', '#999999',
  '#DC2626', '#EA580C', '#CA8A04', '#16A34A',
  '#2563EB', '#7C3AED', '#DB2777', '#0891B2',
];

function ColorPicker({
  icon: Icon, title, currentColor, onSelect,
}: {
  icon: React.ElementType; title: string; currentColor?: string; onSelect: (color: string) => void;
}) {
  const { triggerRef, open, pos, toggle, close } = useFixedPopup();

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={toggle}
        title={title}
        className="flex flex-col items-center justify-center w-8 h-8 rounded-md cursor-pointer text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <Icon size={15} />
        <div className="w-4 h-1 rounded-full mt-0.5" style={{ background: currentColor || '#000' }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={close} />
          <div
            className="fixed p-2 bg-white dark:bg-[#1e293b] border border-[var(--card-border)] rounded-lg shadow-2xl z-[101]"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="color-grid">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="color-swatch"
                  style={{ background: c }}
                  onClick={() => { onSelect(c); close(); }}
                  title={c}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => { onSelect(''); close(); }}
              className="w-full mt-1.5 text-[10px] text-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1"
            >
              Rengi Kaldır
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Table Grid Picker ── */
function TablePicker({ editor }: { editor: Editor }) {
  const { triggerRef, open, pos, toggle, close } = useFixedPopup();
  const [hover, setHover] = useState({ r: 0, c: 0 });

  return (
    <div ref={triggerRef}>
      <Btn onClick={toggle} title="Tablo Ekle">
        <TableIcon size={15} />
      </Btn>
      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={close} />
          <div
            className="fixed p-2 bg-white dark:bg-[#1e293b] border border-[var(--card-border)] rounded-lg shadow-2xl z-[101]"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="text-[10px] text-[var(--text-secondary)] text-center mb-1.5">
              {hover.r > 0 ? `${hover.r} × ${hover.c}` : 'Tablo boyutu seçin'}
            </div>
            <div className="table-grid">
              {Array.from({ length: 6 }, (_, r) =>
                Array.from({ length: 8 }, (_, c) => (
                  <div
                    key={`${r}-${c}`}
                    className={`table-grid-cell ${r < hover.r && c < hover.c ? 'active' : ''}`}
                    onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
                    onClick={() => {
                      editor.chain().focus().insertTable({ rows: hover.r, cols: hover.c, withHeaderRow: true }).run();
                      close();
                      setHover({ r: 0, c: 0 });
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Font Size Selector ── */
const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32'];

function FontSizeSelect({ editor }: { editor: Editor }) {
  const { triggerRef, open, pos, toggle, close } = useFixedPopup();

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={toggle}
        title="Yazı Boyutu"
        className="h-7 px-2 text-xs rounded border border-[var(--card-border)] bg-transparent text-[var(--text-primary)] cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
      >
        Boyut <span className="text-[10px] opacity-50">&#9662;</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={close} />
          <div
            className="fixed py-1 bg-white dark:bg-[#1e293b] border border-[var(--card-border)] rounded-lg shadow-2xl z-[101] min-w-[70px]"
            style={{ top: pos.top, left: pos.left }}
          >
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  editor.chain().focus().setMark('textStyle', { fontSize: `${s}px` }).run();
                  close();
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-[var(--text-primary)] hover:bg-[var(--gold)]/10 transition-colors"
              >
                {s}px
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* Main Toolbar                                                  */
/* ══════════════════════════════════════════════════════════════ */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  const s = 15;

  return (
    <div className="editor-toolbar flex items-center gap-0.5 px-3 py-1.5 overflow-x-auto">
      {/* History */}
      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Geri Al (Ctrl+Z)">
        <Undo size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="İleri Al (Ctrl+Y)">
        <Redo size={s} />
      </Btn>

      <Divider />

      {/* Font Size */}
      <FontSizeSelect editor={editor} />

      <Divider />

      {/* Headings */}
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Başlık 1">
        <Heading1 size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Başlık 2">
        <Heading2 size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Başlık 3">
        <Heading3 size={s} />
      </Btn>

      <Divider />

      {/* Text Formatting */}
      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Kalın (Ctrl+B)">
        <Bold size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="İtalik (Ctrl+I)">
        <Italic size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Altı Çizili (Ctrl+U)">
        <UnderlineIcon size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Üstü Çizili">
        <Strikethrough size={s} />
      </Btn>

      <Divider />

      {/* Colors */}
      <ColorPicker
        icon={Type}
        title="Yazı Rengi"
        currentColor={editor.getAttributes('textStyle').color || '#000'}
        onSelect={(c) => {
          if (c) editor.chain().focus().setColor(c).run();
          else editor.chain().focus().unsetColor().run();
        }}
      />
      <ColorPicker
        icon={Highlighter}
        title="Vurgu Rengi"
        currentColor={editor.getAttributes('highlight').color || '#fef08a'}
        onSelect={(c) => {
          if (c) editor.chain().focus().toggleHighlight({ color: c }).run();
          else editor.chain().focus().unsetHighlight().run();
        }}
      />

      <Divider />

      {/* Alignment */}
      <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Sola Hizala">
        <AlignLeft size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Ortala">
        <AlignCenter size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Sağa Hizala">
        <AlignRight size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="İki Yana Yasla">
        <AlignJustify size={s} />
      </Btn>

      <Divider />

      {/* Lists */}
      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Madde İşareti">
        <List size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numaralı Liste">
        <ListOrdered size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Alıntı">
        <Quote size={s} />
      </Btn>

      <Divider />

      {/* Insert */}
      <TablePicker editor={editor} />
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Yatay Çizgi">
        <Minus size={s} />
      </Btn>

      <Divider />

      {/* Print */}
      <Btn onClick={() => window.print()} title="Yazdır (Ctrl+P)">
        <Printer size={s} />
      </Btn>
    </div>
  );
}
