'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, PenTool, RotateCcw, Check, Loader2 } from 'lucide-react';
import SignaturePadLib from 'signature_pad';
import { createSignature } from '@/lib/supabase/document-api';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  signerName: string;
  signerRole: string;
  signerUserId: string | null;
  contentHash: string;
  onSigned: () => void;
}

export function SignatureModal({
  isOpen, onClose, documentId, signerName, signerRole, signerUserId, contentHash, onSigned,
}: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [signing, setSigning] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const initPad = useCallback(() => {
    if (canvasRef.current && !padRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(2, 2);

      padRef.current = new SignaturePadLib(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(15, 23, 42)',
        minWidth: 1,
        maxWidth: 2.5,
      });

      padRef.current.addEventListener('endStroke', () => {
        setIsEmpty(padRef.current?.isEmpty() ?? true);
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure canvas is in DOM
      const timer = setTimeout(initPad, 100);
      return () => clearTimeout(timer);
    } else {
      padRef.current?.off();
      padRef.current = null;
    }
  }, [isOpen, initPad]);

  const handleClear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSign = async () => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    setSigning(true);

    try {
      const signatureDataUrl = padRef.current.toDataURL('image/png');

      await createSignature({
        document_id: documentId,
        signer_user_id: signerUserId,
        signer_name: signerName,
        signer_role: signerRole,
        signature_image_url: signatureDataUrl,
        ip_address: null,
        certificate_hash: contentHash,
      });

      onSigned();
      onClose();
    } catch (err) {
      console.error('Signature error:', err);
      alert('İmza kaydedilirken bir hata oluştu.');
    } finally {
      setSigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl w-[480px] max-w-[95vw] border border-[var(--gold)]/20">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gold)]/20">
          <div className="flex items-center gap-2">
            <PenTool size={18} className="text-[var(--gold)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Dokümanı İmzala</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Signer info */}
          <div className="flex items-center gap-3 p-3 bg-[var(--gold)]/5 rounded-lg border border-[var(--gold)]/20">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{signerName}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">{signerRole}</p>
            </div>
          </div>

          {/* Signature canvas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-[var(--text-secondary)]">Aşağıdaki alana imzanızı atın</p>
              <button
                onClick={handleClear}
                className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-red-500 transition-colors"
              >
                <RotateCcw size={10} />
                Temizle
              </button>
            </div>
            <div className="border-2 border-dashed border-[var(--gold)]/30 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="w-full"
                style={{ height: 180, touchAction: 'none' }}
              />
            </div>
          </div>

          {/* Legal note */}
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            İmzalayarak bu dokümanın içeriğini okuduğunuzu ve onayladığınızı beyan etmiş olursunuz.
            İmzanız dijital olarak kaydedilecek ve doküman bütünlüğü hash ile doğrulanabilecektir.
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-xs font-medium border border-[var(--gold)]/20 rounded-lg text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSign}
              disabled={isEmpty || signing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors disabled:opacity-50"
            >
              {signing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {signing ? 'İmzalanıyor...' : 'İmzala ve Onayla'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
