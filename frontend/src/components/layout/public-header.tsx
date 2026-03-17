import Link from "next/link";
import { Brand } from "./brand";

const navLinkClass =
  "text-sm font-medium text-white/88 transition-colors hover:text-white";

const ghostButtonClass =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-red-300/35 bg-white/10 px-5 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(239,68,68,0.12)] transition-colors hover:bg-white/18";

const accentButtonClass =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-red-400/40 bg-[linear-gradient(135deg,#97c51f_0%,#b9e22f_100%)] px-5 text-sm font-medium text-[#10220a] shadow-[0_0_0_1px_rgba(239,68,68,0.16),0_16px_34px_rgba(151,197,31,0.28),0_0_24px_rgba(239,68,68,0.16)] transition-colors hover:brightness-[1.03]";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[linear-gradient(90deg,#0b5fc1_0%,#0f6dd2_48%,#084c9a_100%)] backdrop-blur-xl">
      <div className="page-shell py-4">
        <div className="flex items-center justify-between gap-4">
          <Brand href="/" inverted />

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-6 lg:flex">
              <Link href="/" className={navLinkClass}>
                Ana Sayfa
              </Link>
            </nav>

            <Link href="/login" className={ghostButtonClass}>
              Giriş Yap
            </Link>

            <Link href="/register" className={accentButtonClass}>
              Hesap Oluştur
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
