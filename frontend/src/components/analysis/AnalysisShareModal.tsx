"use client";

import { useEffect, useState } from "react";
import {
  X, Copy, Check, QrCode, Share2, Mail, MessageCircle, ExternalLink, Link2,
  FileDown, Loader2,
} from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

interface AnalysisShareModalProps {
  open: boolean;
  onClose: () => void;
  /** Paylaşılacak URL — verilmezse window.location.href kullanılır */
  url?: string | null;
  /** Modal başlığı (örn. "R₂D-RCA Analizini Paylaş") */
  title?: string;
  /** Açıklama/önizleme metni — copy ile beraber */
  shareText?: string;
  /**
   * Opsiyonel: PDF üreten async callback.
   * Verilirse modal'da "PDF olarak indir" butonu görünür.
   * PDF içinde paylaşım QR kodu otomatik gömülü olur (PDF template footer'ında).
   */
  onDownloadPdf?: () => Promise<void> | void;
}

/**
 * Generic paylaşım modal'ı.
 *  - URL kopyala
 *  - QR kod (qrcode paketi → data URL)
 *  - Web Share API native (mobilde)
 *  - Email + WhatsApp + yeni sekmede aç
 *
 * Tüm RCA / DÖF / döküman panellerinde kullanılabilir.
 */
export function AnalysisShareModal({
  open,
  onClose,
  url,
  title = "Analizi Paylaş",
  shareText,
  onDownloadPdf,
}: AnalysisShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Modal açılınca URL ve QR oluştur
  useEffect(() => {
    if (!open) return;
    const finalUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    setShareUrl(finalUrl);
    setHasNativeShare(typeof navigator !== "undefined" && "share" in navigator);

    if (finalUrl) {
      QRCode.toDataURL(finalUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 240,
        color: { dark: "#0F172A", light: "#FFFFFF" },
      })
        .then(setQrDataUrl)
        .catch((e) => console.warn("QR generation failed:", e));
    }
  }, [open, url]);

  // ESC ile kapat
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select + execCommand
      console.warn("Clipboard API başarısız");
    }
  };

  const handleNativeShare = async () => {
    if (!("share" in navigator)) return;
    try {
      await navigator.share({
        title,
        text: shareText ?? title,
        url: shareUrl,
      });
    } catch {
      // Kullanıcı iptal etti — sessizce geç
    }
  };

  const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent((shareText ?? "") + "\n\n" + shareUrl)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(((shareText ?? title) + " — " + shareUrl))}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/15">
              <Share2 className="size-5 text-primary" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">Link, QR kod veya doğrudan paylaşım</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* QR kod */}
        {qrDataUrl && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="rounded-xl border border-border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Paylaşım QR kodu" className="size-44" />
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <QrCode className="size-3" />
              Mobil ile tarayın — anında erişim
            </p>
          </div>
        )}

        {/* URL kutusu + kopyala */}
        <div className="mt-4">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Paylaşım Linki
          </label>
          <div className="flex items-stretch gap-2">
            <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-lg border border-border bg-muted/40 px-3 py-2">
              <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-xs text-foreground" title={shareUrl}>
                {shareUrl || "—"}
              </span>
            </div>
            <Button
              type="button"
              variant={copied ? "accent" : "outline"}
              size="sm"
              onClick={handleCopy}
              disabled={!shareUrl}
              aria-label={copied ? "Kopyalandı" : "Linki kopyala"}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
        </div>

        {/* Hızlı paylaşım butonları */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {hasNativeShare && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleNativeShare}
              className="col-span-2 sm:col-span-1"
            >
              <Share2 className="size-4" /> Paylaş
            </Button>
          )}
          <a
            href={emailHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Mail className="size-4" /> E-posta
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <ExternalLink className="size-4" /> Yeni sekme
          </a>
        </div>

        {/* PDF olarak indir + paylaş — opsiyonel */}
        {onDownloadPdf && (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <FileDown className="size-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">PDF olarak paylaş</span>
            </div>
            <p className="mb-3 text-[11px] leading-4 text-muted-foreground">
              PDF dosyasının altında <strong>aynı QR kod</strong> ve paylaşım linki gömülüdür.
              İndirip mesajlaşma uygulamanızdan, e-posta ile veya yazıcıdan basıp dağıtabilirsiniz.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pdfBusy}
              className="w-full"
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await onDownloadPdf();
                } finally {
                  setPdfBusy(false);
                }
              }}
            >
              {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              {pdfBusy ? "PDF hazırlanıyor..." : "PDF olarak İndir / Yazdır"}
            </Button>
          </div>
        )}

        {/* Yasal not */}
        <p className="mt-3 rounded-lg bg-amber-500/10 p-2.5 text-[10px] leading-4 text-amber-700 dark:text-amber-300">
          <strong>Not:</strong> Paylaşılan link RiskNova platformuna yönlendirir. Erişim için karşı tarafın yetkili kullanıcı olması gerekebilir.
          Hassas bilgi içeren analizleri yalnızca yetkilendirilmiş kişilerle paylaşın.
        </p>
      </div>
    </div>
  );
}
