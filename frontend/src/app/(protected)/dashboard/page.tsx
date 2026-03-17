import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const metricCards = [
  {
    title: "Risk modülü",
    value: "Hazır temel",
    description: "Risk formu ve sonuç ekranı için ürün zemini kuruldu.",
  },
  {
    title: "Kurumsal yapı",
    value: "Aktif",
    description: "Organization tabanlı güvenli yapı çalışıyor.",
  },
  {
    title: "AI yorum katmanı",
    value: "Sıradaki adım",
    description: "Sonuç ekranına açıklayıcı yorum entegrasyonu hazırlanıyor.",
  },
  {
    title: "PDF akışı",
    value: "Planlı",
    description: "Kayıt ve çıktı ekranları için tasarım yönü netleşiyor.",
  },
];

const quickLinks = [
  {
    href: "/risk-analysis",
    title: "Risk analizi başlat",
    text: "Yeni değerlendirme akışını aç ve veri girişini başlat.",
  },
  {
    href: "/score-history",
    title: "Skor geçmişi",
    text: "Oluşturulan sonuçları zaman içinde izlemeye hazırlan.",
  },
  {
    href: "/reports",
    title: "Raporlar",
    text: "PDF ve raporlama tarafı için temel alanları yönet.",
  },
  {
    href: "/profile",
    title: "Profil ve hesap",
    text: "Kullanıcı ve hesap ayarlarını düzenle.",
  },
];

const focusItems = [
  "Risk formunu hızlı doldurulabilir hâle getirmek",
  "Sonuç ekranını karar destek merkezine dönüştürmek",
  "Geçmiş ve detay akışını okunabilir tutmak",
];

const primaryLinkClass =
  "inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-accent-hover";

const secondaryLinkClass =
  "inline-flex h-11 items-center justify-center rounded-2xl border border-primary/20 bg-card px-5 text-sm font-medium text-primary transition-colors hover:bg-secondary";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <>
      <PageHeader
        eyebrow="Kontrol Merkezi"
        title="RiskNova Dashboard"
        description="Risk analizi, kayıt, raporlama ve operasyon modüllerini tek panel altında yöneteceğin çalışma alanı."
        meta={
          <>
            <Badge>Aktif oturum</Badge>
            <Badge variant="neutral">{user.email ?? "Kullanıcı"}</Badge>
          </>
        }
        actions={
          <>
            <Link href="/risk-analysis" className={primaryLinkClass}>
              Yeni Risk Analizi
            </Link>
            <Link href="/score-history" className={secondaryLinkClass}>
              Skor Geçmişi
            </Link>
          </>
        }
      />

      <section className="data-grid">
        {metricCards.map((item, index) => {
          const accentClass =
            index % 4 === 0
              ? "bg-[linear-gradient(90deg,#0b5fc1_0%,#2788ff_100%)]"
              : index % 4 === 1
                ? "bg-[linear-gradient(90deg,#97c51f_0%,#b9e22f_100%)]"
                : index % 4 === 2
                  ? "bg-[linear-gradient(90deg,#f59e0b_0%,#fbbf24_100%)]"
                  : "bg-[linear-gradient(90deg,#ef4444_0%,#f87171_100%)]";

          return (
            <Card key={item.title} className="overflow-hidden">
              <div className={`h-1.5 w-full ${accentClass}`} />
              <CardHeader className="p-6 pb-3">
                <CardDescription className="text-sm font-medium text-muted-foreground">
                  {item.title}
                </CardDescription>
                <CardTitle className="text-3xl">{item.value}</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <p className="text-sm leading-7 text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader className="p-7">
            <Badge variant="accent" className="w-fit">
              Bugünün odağı
            </Badge>
            <CardTitle className="text-2xl">
              Ürünü risk intelligence akışına hazırlayan başlıklar
            </CardTitle>
            <CardDescription className="text-sm leading-7 sm:text-base">
              Bu panel, Aşama 2B boyunca risk formu, sonuç ekranı ve detay
              sayfalarının ürün hissini taşıyan ana çalışma alanı olacak.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 px-7 pb-7">
            {focusItems.map((item, index) => (
              <div
                key={item}
                className="rounded-3xl border border-border bg-muted p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Öncelik {index + 1}
                </p>
                <p className="mt-2 text-sm font-medium leading-7 text-foreground">
                  {item}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-7">
            <Badge className="w-fit">Hızlı erişim</Badge>
            <CardTitle className="text-2xl">Temel modüllere geçiş</CardTitle>
            <CardDescription className="text-sm leading-7 sm:text-base">
              Dashboard, kullanıcının bir sonraki aksiyona hızla geçebildiği
              net bir yönlendirme ekranı olmalı.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 px-7 pb-7">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:bg-secondary"
              >
                <p className="text-base font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {item.text}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card className="bg-[linear-gradient(135deg,rgba(11,95,193,0.08)_0%,#ffffff_62%,rgba(149,193,31,0.15)_100%)]">
          <CardHeader className="p-7">
            <Badge className="w-fit">Tasarım yönü</Badge>
            <CardTitle className="text-2xl">
              Dashboard artık ürünün kurumsal omurgası
            </CardTitle>
            <CardDescription className="text-sm leading-7 sm:text-base">
              Açık zemin, beyaz kartlar, yumuşak gölgeler ve kontrollü vurgu
              renkleri sayesinde ekranlar daha premium ve güvenilir görünür.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-7 pb-7">
            <p className="text-sm leading-7 text-muted-foreground">
              Bir sonraki turda risk analiz formu ve sonuç ekranı bu yapı
              üzerine taşındığında, kullanıcı ürün içinde kaybolmadan girişten
              sonuca kadar tutarlı bir deneyim yaşayacak.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-7">
            <Badge variant="warning" className="w-fit">
              Oturum
            </Badge>
            <CardTitle className="text-2xl">Hesap işlemleri</CardTitle>
            <CardDescription className="text-sm leading-7 sm:text-base">
              Hesabın açık. Gerekirse oturumu güvenli şekilde kapatabilirsin.
            </CardDescription>
          </CardHeader>

          <CardFooter className="px-7 py-6">
            <form>
              <Button formAction={signOutAction} variant="outline">
                Çıkış Yap
              </Button>
            </form>
          </CardFooter>
        </Card>
      </section>
    </>
  );
}

