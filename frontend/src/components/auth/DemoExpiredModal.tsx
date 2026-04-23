"use client";

import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  status: "expired" | "disabled";
};

export function DemoExpiredModal({ status }: Props) {
  const [open, setOpen] = useState(true);

  // ESC ile kapama
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-[var(--gold)]/50 bg-card shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
      >
        {/* Gradient üst bar */}
        <div className="relative bg-gradient-to-br from-[var(--gold)]/25 via-[var(--gold)]/10 to-transparent px-6 pb-4 pt-6">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/20 ring-4 ring-[var(--gold)]/30">
              <PartyPopper className="h-7 w-7 text-[var(--gold)]" />
            </span>
            <div>
              <h2 className="text-2xl font-bold leading-tight text-foreground">
                Teşekkürler! 🎉
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                RiskNova'yı denediğin için
              </p>
            </div>
          </div>
        </div>

        {/* İçerik */}
        <div className="space-y-4 px-6 py-5">
          <p className="text-base leading-7 text-foreground">
            {status === "disabled"
              ? "Demo erişimin kapatıldı."
              : "Demo erişim süren sona erdi."}
          </p>
          <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            Kaldığın yerden devam etmek ve <strong className="text-foreground">tüm özelliklere tam erişim</strong> için hemen kendi hesabını oluştur. İhtiyacına göre üç akıştan birini seçebilirsin:
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                <span><strong className="text-foreground">Bireysel</strong> — bağımsız profesyoneller</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                <span><strong className="text-foreground">OSGB</strong> — firma ve personel yönetimi</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                <span><strong className="text-foreground">Kurumsal</strong> — çok lokasyonlu enterprise</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Alt CTA */}
        <div className="flex flex-col gap-2 border-t border-border bg-muted/20 px-6 py-4">
          <Button size="lg" className="w-full" onClick={() => setOpen(false)}>
            Kayıt olmaya başla →
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Daha sonra
          </button>
        </div>
      </div>
    </div>
  );
}
