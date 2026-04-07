'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Shield, CheckCircle2, Clock, FileText, PenTool } from 'lucide-react';

interface Signature {
  id: string;
  signer_name: string;
  signer_role: string;
  signed_at: string;
  certificate_hash: string | null;
}

interface Props {
  title: string;
  contentJson: Record<string, unknown>;
  companyName: string;
  status: string;
  createdAt: string;
  signatures: Signature[];
}

export function SharedDocumentView({ title, contentJson, companyName, status, createdAt, signatures }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Table.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline, TextStyle, Color,
    ],
    content: contentJson,
    editable: false,
    immediatelyRender: false,
  });

  const statusLabels: Record<string, { label: string; color: string }> = {
    taslak: { label: 'Taslak', color: 'text-yellow-600 bg-yellow-100' },
    hazir: { label: 'Hazır', color: 'text-green-600 bg-green-100' },
    onay_bekliyor: { label: 'Onay Bekliyor', color: 'text-blue-600 bg-blue-100' },
    revizyon: { label: 'Revizyon', color: 'text-orange-600 bg-orange-100' },
  };
  const st = statusLabels[status] || statusLabels.taslak;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-[#0F172A] text-white py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#D4A017] rounded-lg flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <span className="text-[#D4A017] font-bold text-sm">RiskNova</span>
              <span className="text-gray-400 text-xs ml-2">Paylaşılan Doküman</span>
            </div>
          </div>
          {companyName && (
            <span className="text-sm text-gray-300">{companyName}</span>
          )}
        </div>
      </header>

      {/* Document */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        {/* Title bar */}
        <div className="bg-white rounded-t-xl border border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Oluşturulma: {new Date(createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>

        {/* Content */}
        <div className="bg-white border-x border-gray-200 px-8 py-6 min-h-[500px]">
          {editor && <EditorContent editor={editor} />}
        </div>

        {/* Signatures */}
        {signatures.length > 0 && (
          <div className="bg-white border-x border-gray-200 px-8 py-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <PenTool size={14} className="text-[#D4A017]" />
              İmzalar
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {signatures.map((sig) => (
                <div key={sig.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{sig.signer_name}</p>
                    <p className="text-[11px] text-gray-500">{sig.signer_role}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(sig.signed_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 rounded-b-xl border border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Shield size={12} className="text-[#D4A017]" />
            RiskNova ile oluşturuldu
          </div>
          {signatures.length > 0 && signatures[0].certificate_hash && (
            <span className="text-[10px] text-gray-400 font-mono">
              Hash: {signatures[0].certificate_hash.slice(0, 16)}...
            </span>
          )}
        </div>
      </main>
    </div>
  );
}
