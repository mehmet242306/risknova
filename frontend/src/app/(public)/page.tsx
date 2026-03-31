import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { Brand } from "@/components/layout/brand";
import {
  BrainCircuit,
  Search,
  BarChart3,
  ShieldCheck,
  Monitor,
  Sparkles,
  Lock,
  FileInput,
  Cpu,
  ClipboardCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const featureIcons: Record<string, LucideIcon> = {
  "brain-circuit": BrainCircuit,
  search: Search,
  "bar-chart": BarChart3,
  "shield-check": ShieldCheck,
  monitor: Monitor,
  sparkles: Sparkles,
};

const workflowIcons: Record<string, LucideIcon> = {
  lock: Lock,
  "file-input": FileInput,
  cpu: Cpu,
  "clipboard-check": ClipboardCheck,
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const stats = [
  { value: "500+", label: "AKTIF KULLANICI" },
  { value: "%99.5", label: "UPTIME" },
  { value: "15sn", label: "ANALİZ SÜRESİ" },
  { value: "R-SKOR", label: "RİSK PUANLAMA" },
];

const features = [
  {
    iconKey: "brain-circuit",
    title: "AI destekli risk analizi",
    text: "Manuel veya modül bazlı risk girdilerini tek akışta toplayan, sonuçları daha görünür hâle getiren ürün temeli.",
  },
  {
    iconKey: "search",
    title: "Saha bulguları ve aksiyon yönetimi",
    text: "Denetim, bulgu, görev ve takip alanlarını operasyon ekibinin okuyabileceği düzen içinde bir araya getirir.",
  },
  {
    iconKey: "bar-chart",
    title: "Raporlama ve kayıt altyapısı",
    text: "Oluşturulan sonuçların geçmiş, detay ve çıktı süreçlerine bağlanabileceği tutarlı ekran omurgası sağlar.",
  },
  {
    iconKey: "shield-check",
    title: "Risk modülü için ürün vitrini",
    text: "Risk analizi ekranı, sonuç ekranı ve skor geçmişi gibi alanlar için profesyonel ve güven veren zemin hazırlar.",
  },
  {
    iconKey: "monitor",
    title: "Mobil, tablet ve desktop uyumu",
    text: "Tek kolon, iki kolon ve geniş ekran yerleşimleriyle farklı cihazlarda okunabilirliğini korur.",
  },
  {
    iconKey: "sparkles",
    title: "Kurumsal ve modern görsel dil",
    text: "Açık yüzeyler, kontrollü kontrast ve net CTA yapısıyla profesyonel SaaS hissi üretir.",
  },
];

const workflow = [
  {
    step: "01",
    iconKey: "lock",
    title: "Güvenli Erişim",
    text: "Kurumunuza özel hesabınızla platforma güvenli bir şekilde giriş yapın.",
  },
  {
    step: "02",
    iconKey: "file-input",
    title: "Risk Verisinin Girilmesi",
    text: "Alan denetimleri, tehlike bildirimleri ve risk parametrelerini sisteme aktarın.",
  },
  {
    step: "03",
    iconKey: "cpu",
    title: "R-SKOR Üretimi",
    text: "AI destekli analiz motorumuz verilerinizi işleyerek risk skorlarını hesaplar.",
  },
  {
    step: "04",
    iconKey: "clipboard-check",
    title: "Aksiyon ve Takip",
    text: "Sonuçlara dayalı aksiyon planları oluşturun, takip edin ve raporlayın.",
  },
];

const benefits = [
  "Temiz, modern ve güven veren İSG görünümü",
  "Operasyon odaklı, dikkat dağıtmayan ekran kurgusu",
  "Risk Intelligence modülüne hazır tasarım sistemi",
  "Multi-tenant organizasyon bazlı güvenli yapı",
  "AI destekli karar destek mekanizması",
  "Kurumsal raporlama ve arşiv altyapısı",
];

const testimonials = [
  {
    quote:
      "RiskNova ile saha denetimlerimiz çok daha sistematik hale geldi. AI yorumları gerçekten faydalı.",
    author: "Mehmet K.",
    role: "İSG Uzmanı",
  },
  {
    quote:
      "Tek platformda risk analizi, raporlama ve takip yapabilmek operasyonel verimliliğimizi artırdı.",
    author: "Ayşe T.",
    role: "İSG Müdürü",
  },
  {
    quote:
      "Kurumsal görünümü ve kullanım kolaylığı sayesinde ekip adaptasyonu çok hızlı oldu.",
    author: "Can D.",
    role: "Operasyon Yöneticisi",
  },
];

const footerLinks = [
  {
    title: "Ürün",
    links: [
      { label: "Özellikler", href: "/#features" },
      { label: "Nasıl Çalışır", href: "/#how-it-works" },
      { label: "R-SKOR", href: "/#features" },
    ],
  },
  {
    title: "Şirket",
    links: [
      { label: "Hakkımızda", href: "/" },
      { label: "İletişim", href: "/" },
      { label: "Blog", href: "/" },
    ],
  },
  {
    title: "Destek",
    links: [
      { label: "Yardım Merkezi", href: "/" },
      { label: "Dokümantasyon", href: "/" },
      { label: "API", href: "/" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Shared classes                                                     */
/* ------------------------------------------------------------------ */

const primaryLinkClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#FBBF24_100%)] px-7 text-sm font-medium text-white shadow-[0_16px_34px_rgba(184,134,11,0.28)] transition-all hover:brightness-[1.05]";

const secondaryLinkClass =
  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] px-7 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <main className="app-shell">
      <PublicHeader />

      {/* ============================================================ */}
      {/* HERO                                                          */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-[var(--navy-dark)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,160,23,0.06),transparent_50%)]" />
        <div className="page-shell relative flex min-h-[85vh] flex-col items-center justify-center py-20 text-center">
          <span className="tag-label reveal mb-8">
            YAPAY ZEKA DESTEKLİ İSG PLATFORMU
          </span>

          <h1 className="reveal max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl xl:text-6xl">
            İSG Risk Yönetimini{" "}
            <span className="text-accent-serif">Sanata</span>{" "}
            Dönüştürün
          </h1>

          <p className="reveal reveal-delay-1 mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            RiskNova; risk analizi, saha takibi, kayıt, raporlama ve karar
            desteği süreçlerini tek ürün hissi içinde birleştirmek için
            tasarlanmış AI destekli İSG platformudur.
          </p>

          <div className="reveal reveal-delay-2 mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/register" className={primaryLinkClass + " hover-glow"}>
              Ücretsiz Başla
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="ml-1"
              >
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="/login" className={secondaryLinkClass}>
              Platforma Giriş Yap
            </Link>
          </div>

          {/* Stats */}
          <div className="reveal reveal-delay-3 mt-16 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md md:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-1 bg-[var(--navy-dark)] px-6 py-5"
              >
                <span className="text-2xl font-bold tracking-tight text-[var(--gold)]">
                  {s.value}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-slate-400">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURES                                                      */}
      {/* ============================================================ */}
      <section id="features" className="bg-background">
        <div className="page-shell py-20">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="tag-label mb-6 inline-flex">ÖZELLİKLER</span>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Kapsamlı{" "}
              <span className="text-accent-serif">Çözümler</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              İSG süreçlerinizi uçtan uca yöneten profesyonel araçlar.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {features.map((item) => {
              const Icon = featureIcons[item.iconKey];
              return (
              <div
                key={item.title}
                className="reveal group rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)] hover-lift"
              >
                <span className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-[var(--gold-glow)]">
                  <Icon className="size-6 text-[var(--gold)]" strokeWidth={1.5} />
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {item.text}
                </p>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* HOW IT WORKS                                                  */}
      {/* ============================================================ */}
      <section id="how-it-works" className="bg-[var(--navy-dark)]">
        <div className="page-shell py-20">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="tag-label mb-6 inline-flex">NASIL ÇALIŞIR</span>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Dört Adımda{" "}
              <span className="text-accent-serif">Kontrol</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-400">
              Platformumuzu kullanmaya başlamak için basit adımlar.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {workflow.map((item) => {
              const Icon = workflowIcons[item.iconKey];
              return (
              <div
                key={item.step}
                className="reveal hover-lift relative overflow-hidden rounded-2xl glass-card p-7"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-lg bg-[var(--gold)]/10">
                    <Icon className="size-5 text-[var(--gold)]" strokeWidth={1.5} />
                  </span>
                  <div className="h-1 w-8 rounded-full bg-[linear-gradient(90deg,var(--gold),var(--gold-light))]" />
                </div>
                <span className="pointer-events-none absolute right-4 top-2 select-none text-6xl font-bold text-white/[0.04]">
                  {item.step}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  {item.text}
                </p>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* VALUE PROPOSITION                                             */}
      {/* ============================================================ */}
      <section className="bg-background">
        <div className="page-shell py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="reveal">
              <span className="tag-label mb-6 inline-flex">
                NEDEN RİSKNOVA
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Güven Veren{" "}
                <span className="text-accent-serif">Premium</span>{" "}
                Deneyim
              </h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
                Mavi güven hissini ve altın kalite vurgusunu taşıyan, açık
                yüzeyler ve yumuşak kontrast ile profesyonel SaaS deneyimi
                oluşturur.
              </p>

              <ul className="mt-8 space-y-4">
                {benefits.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--gold)] text-white">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
                        <path
                          d="M3 7l3 3 5-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="text-sm font-medium leading-7 text-foreground">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="reveal hover-lift rounded-3xl border border-border bg-[radial-gradient(circle_at_top_right,var(--gold-glow),transparent_50%)] p-10 shadow-[var(--shadow-card)]">
              <span className="eyebrow mb-4 inline-flex">Hazır CTA Alanı</span>
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                Risk modülünü ürün vitrini hâline getirin
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Risk formu, sonuç ekranı ve geçmiş ekranları bu tasarım dili
                üzerinden ürün seviyesine çıkarılacak.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#FBBF24_100%)] px-6 text-sm font-medium text-white shadow-[0_16px_34px_rgba(184,134,11,0.28)] transition-all hover:brightness-[1.05]"
                >
                  Hesap Oluştur
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Giriş Yap
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* TESTIMONIALS                                                  */}
      {/* ============================================================ */}
      <section className="bg-[var(--navy-dark)]">
        <div className="page-shell py-20">
          <div className="reveal mx-auto max-w-2xl text-center">
            <span className="tag-label mb-6 inline-flex">MÜŞTERİ YORUMLARI</span>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Kullanıcılarımız{" "}
              <span className="text-accent-serif">Ne Diyor</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.author}
                className="reveal hover-lift rounded-2xl glass-card p-7"
              >
                <div className="mb-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="var(--gold)"
                    >
                      <path d="M8 1l2.2 4.5L15 6.3l-3.5 3.4.8 4.9L8 12.3 3.7 14.6l.8-4.9L1 6.3l4.8-.8z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-7 text-slate-300">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-sm font-semibold text-white">
                    {t.author}
                  </p>
                  <p className="text-xs text-slate-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* BOTTOM CTA                                                    */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-[var(--navy-dark)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,160,23,0.08),transparent_60%)]" />
        <div className="page-shell relative py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl xl:text-5xl">
            İSG Süreçlerinizi{" "}
            <span className="text-accent-serif">Dönüştürün</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400">
            RiskNova ile risk analizinden raporlamaya kadar tüm İSG
            operasyonlarınızı tek platformda yönetin.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register" className={primaryLinkClass}>
              Ücretsiz Başla
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="ml-1"
              >
                <path
                  d="M6 3l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link href="/login" className={secondaryLinkClass}>
              Giriş Yap
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                        */}
      {/* ============================================================ */}
      <footer className="border-t border-white/[0.06] bg-[var(--navy-deep)]">
        <div className="page-shell py-14">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <Brand href="/" inverted />
              <p className="mt-4 max-w-xs text-sm leading-7 text-slate-500">
                AI destekli İSG risk analizi ve operasyon platformu.
                Profesyonel, güvenilir, modern.
              </p>
            </div>

            {footerLinks.map((group) => (
              <div key={group.title}>
                <h4 className="text-sm font-semibold text-white">
                  {group.title}
                </h4>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-slate-500 transition-colors hover:text-slate-300"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 border-t border-white/[0.06] pt-6 text-center text-xs text-slate-600">
            &copy; {new Date().getFullYear()} RiskNova. Tüm hakları saklıdır.
          </div>
        </div>
      </footer>
    </main>
  );
}
