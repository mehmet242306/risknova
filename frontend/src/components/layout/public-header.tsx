import Link from "next/link";
import { Brand } from "./brand";

const navLinkClass =
  "text-sm font-medium text-white/88 transition-colors hover:text-white";

const ghostButtonClass =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-medium text-white transition-colors hover:bg-white/20";

const accentButtonClass =
  "inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-[#0b5fc1] shadow-lg transition-colors hover:bg-white/90";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--header-bg)] backdrop-blur-xl">
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
