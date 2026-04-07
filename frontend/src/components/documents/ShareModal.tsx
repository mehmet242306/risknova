'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Link2, Copy, Check, QrCode, Share2, MessageCircle, Smartphone, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import { toggleDocumentSharing } from '@/lib/supabase/document-api';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  shareToken: string | null;
  isShared: boolean;
  onShareChanged: (shared: boolean, token: string | null) => void;
}

export function ShareModal({ isOpen, onClose, documentId, documentTitle, shareToken, isShared, onShareChanged }: ShareModalProps) {
  const [shared, setShared] = useState(isShared);
  const [token, setToken] = useState(shareToken);
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const shareUrl = token ? `${window.location.origin}/share/${token}` : '';

  useEffect(() => {
    setShared(isShared);
    setToken(shareToken);
  }, [isShared, shareToken]);

  // Generate QR code when shared
  useEffect(() => {
    if (shared && shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }).then(setQrDataUrl).catch(console.error);
    }
  }, [shared, shareUrl]);

  const handleToggle = async () => {
    setToggling(true);
    const result = await toggleDocumentSharing(documentId, !shared);
    if (result) {
      setShared(result.is_shared);
      setToken(result.share_token);
      onShareChanged(result.is_shared, result.share_token);
    }
    setToggling(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = `${documentTitle}\n${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareSMS = () => {
    const text = `${documentTitle}: ${shareUrl}`;
    window.open(`sms:?body=${encodeURIComponent(text)}`);
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: documentTitle, url: shareUrl });
      } catch { /* user cancelled */ }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-2xl w-[420px] max-w-[95vw] border border-[var(--gold)]/20">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gold)]/20">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-[var(--gold)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Dokümanı Paylaş</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Toggle sharing */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Paylaşım Linki</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {shared ? 'Link ile herkes görüntüleyebilir' : 'Paylaşım kapalı'}
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                shared ? 'bg-[var(--gold)]' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                shared ? 'left-[22px]' : 'left-0.5'
              }`} />
            </button>
          </div>

          {shared && (
            <>
              {/* Link */}
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-[#0f172a] rounded-lg border border-[var(--gold)]/20 overflow-hidden">
                  <Link2 size={13} className="text-[var(--gold)] shrink-0" />
                  <span className="text-xs text-[var(--text-primary)] truncate">{shareUrl}</span>
                </div>
                <button
                  onClick={copyLink}
                  className="p-2 bg-[var(--gold)] text-white rounded-lg hover:bg-[var(--gold-hover)] transition-colors shrink-0"
                  title="Linki Kopyala"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              {/* QR Code */}
              {qrDataUrl && (
                <div className="flex flex-col items-center py-3">
                  <img src={qrDataUrl} alt="QR Code" className="w-[160px] h-[160px] rounded-lg border border-gray-200 dark:border-gray-700" />
                  <p className="text-[10px] text-[var(--text-secondary)] mt-2">QR kodu taratarak dokümanı görüntüleyin</p>
                </div>
              )}

              {/* Share buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={shareWhatsApp}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-green-200 dark:border-green-800/30 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
                >
                  <MessageCircle size={20} className="text-green-600" />
                  <span className="text-[10px] font-medium text-green-700 dark:text-green-400">WhatsApp</span>
                </button>
                <button
                  onClick={shareSMS}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-blue-200 dark:border-blue-800/30 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
                >
                  <Smartphone size={20} className="text-blue-600" />
                  <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400">SMS</span>
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={shareNative}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-purple-200 dark:border-purple-800/30 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors"
                  >
                    <ExternalLink size={20} className="text-purple-600" />
                    <span className="text-[10px] font-medium text-purple-700 dark:text-purple-400">Diğer</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
