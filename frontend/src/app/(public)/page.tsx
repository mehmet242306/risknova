import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const highlights = [
  { label: "Risk Intelligence", value: "R-SKOR odaklı analiz akışı" },
  { label: "AI Yorumlama", value: "Daha anlaşılır karar desteği" },
  { label: "Kurumsal Panel", value: "Tek merkezden operasyon yönetimi" },
  { label: "Multi-tenant", value: "Organizasyon bazlı güvenli yapı" },
];

const features = [
  {
    title: "AI destekli risk analizi",
    text: "Manuel veya modül bazlı risk girdilerini tek akışta toplayan, sonuçları daha görünür hâle getiren ürün temeli.",
  },
  {
    title: "Saha bulguları ve aksiyon yönetimi",
    text: "Denetim, bulgu, görev ve takip alanlarını operasyon ekibinin okuyabileceği düzen içinde bir araya getirir.",
  },
  {
    title: "Raporlama ve kayıt altyapısı",
    text: "Oluşturulan sonuçların geçmiş, detay ve çıktı süreçlerine bağlanabileceği tutarlı ekran omurgası sağlar.",
  },
  {
    title: "Risk modülü için ürün vitrini",
    text: "Risk analizi ekranı, sonuç ekranı ve skor geçmişi gibi alanlar için profesyonel ve güven veren zemin hazırlar.",
  },
  {
    title: "Mobil, tablet ve desktop uyumu",
    text: "Tek kolon, iki kolon ve geniş ekran yerleşimleriyle farklı cihazlarda okunabilirliğini korur.",
  },
  {
    title: "Kurumsal ve modern görsel dil",
    text: "Açık yüzeyler, kontrollü kontrast ve net CTA yapısıyla oyuncak değil, satılabilir SaaS hissi üretir.",
  },
];

const workflow = [
  "Kuruma güvenli erişim",
  "Risk verisinin girilmesi",
  "R-SKOR sonucunun üretilmesi",
  "AI yorum ve kayıt akışı",
];

const reasons = [
  "Temiz, modern ve güven veren İSG görünümü",
  "Operasyon odaklı, dikkat dağıtmayan ekran kurgusu",
  "Risk Intelligence modülüne hazır tasarım sistemi",
];

const primaryLinkClass =
  "inline-flex h-12 items-center justify-center rounded-2xl bg-[#0b5fc1] px-6 text-sm font-medium text-white shadow-lg transition-colors hover:bg-[#0a4fa8]";

const secondaryLinkClass =
  "inline-flex h-12 items-center justify-center rounded-2xl border-2 border-[#0b5fc1] bg-white px-6 text-sm font-medium text-[#0b5fc1] transition-colors hover:bg-[#0b5fc1]/5";

export default function LandingPage() {
  return (
    <main className="app-shell">
      <PublicHeader />

      <section className="page-shell pt-8 lg:pt-10">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-card p-8 sm:p-10">
            <span className="eyebrow">Risk Intelligence Platform</span>

            <div className="mt-6 max-w-4xl space-y-5">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl xl:text-6xl">
                İSG risk yönetimini analiz, yorum ve operasyon akışıyla tek
                merkezde toplayın.
              </h1>

              <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
                RiskNova; risk analizi, saha takibi, kayıt, raporlama ve karar
                desteği süreçlerini tek ürün hissi içinde birleştirmek için
                tasarlanmış AI destekli İSG platformudur.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/register" className={primaryLinkClass}>
                Hemen Başla
              </Link>

              <Link href="/login" className={secondaryLinkClass}>
                Platforma Giriş Yap
              </Link>
            </div>

            <div className="mt-10 data-grid">
              {highlights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-border bg-card/90 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm"
                >
                  <p className="metric-label">{item.label}</p>
                  <p className="mt-2 text-base font-semibold leading-7 text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader className="p-7">
              <Badge variant="accent" className="w-fit">
                Ürün Özeti
              </Badge>
              <CardTitle className="text-2xl">
                Tek ürün, tek görsel dil, net operasyon deneyimi
              </CardTitle>
              <CardDescription className="text-sm leading-7 sm:text-base">
                Risk analizinden sonuç ekranına, dashboard’dan rapor akışına
                kadar tüm modüllerin aynı profesyonel ürün içinde görünmesi için
                tasarlanan yapı.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 px-7 pb-7">
              {workflow.map((item, index) => (
                <div
                  key={item}
                  className="rounded-3xl border border-border bg-muted p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Adım {index + 1}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-7 text-foreground">
                    {item}
                  </p>
                </div>
              ))}

              <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-[var(--shadow-soft)]">
                <p className="text-sm leading-7 text-muted-foreground">
                  Bu landing yapısı; ürünü daha güvenilir, daha okunur ve
                  dönüşüm odaklı göstermeye başlar. Özellikle kayıt/giriş
                  akışına geçen kullanıcıda profesyonel SaaS hissi oluşturur.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-shell pt-0">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((item) => (
            <Card key={item.title} className="h-full">
              <CardHeader className="p-6">
                <CardTitle className="text-xl">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-7">
                  {item.text}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell pt-0">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader className="p-7">
              <Badge variant="neutral" className="w-fit">
                Neden bu tema dili?
              </Badge>
              <CardTitle className="text-2xl">
                Güven veren ama ağırlaşmayan bir ürün görünümü
              </CardTitle>
              <CardDescription className="text-sm leading-7 sm:text-base">
                Mavi güven hissini, canlı yeşil ise güçlü aksiyon vurgusunu
                taşır. Açık yüzeyler ve yumuşak kontrast da profesyonel bir SaaS
                deneyimi oluşturur.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 px-7 pb-7">
              {reasons.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm font-medium leading-7 text-foreground"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[linear-gradient(135deg,rgba(11,95,193,0.14)_0%,var(--card)_62%,rgba(96,165,250,0.12)_100%)]">
            <CardHeader className="p-7">
              <Badge className="w-fit">Hazır CTA Alanı</Badge>
              <CardTitle className="text-2xl">
                Risk modülünü ürün vitrini hâline getirin
              </CardTitle>
              <CardDescription className="text-sm leading-7 sm:text-base">
                Aşama 2B’nin devamında risk formu, sonuç ekranı ve geçmiş
                ekranları bu tasarım dili üzerinden ürün seviyesine çıkarılacak.
              </CardDescription>
            </CardHeader>

            <CardContent className="px-7 pb-7">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className={primaryLinkClass}>
                  Hesap Oluştur
                </Link>
                <Link href="/login" className={secondaryLinkClass}>
                  Giriş Yap
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
