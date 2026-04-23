import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { DemoSessionCleaner } from "@/components/auth/DemoSessionCleaner";
import { signup } from "./actions";

function AccountTypePreview() {
  const items = [
    {
      title: "Bireysel",
      description:
        "Bagimsiz calisan uzman, hekim, DSP veya bireysel profesyoneller icin.",
      note: "Varsayilan baslangic plani: 1 aktif firma / workspace.",
    },
    {
      title: "OSGB",
      description:
        "OSGB firmalari, ekip yonetimi, personel gorevlendirme ve is takibi icin.",
      note: "Firma ve personel limitleri pakete gore yonetilir.",
    },
    {
      title: "Kurumsal",
      description:
        "Cok lokasyonlu ve ozel ihtiyacli kurumlar icin enterprise akis.",
      note: "Self-service degil; iletisim talebi ile ilerler.",
    },
  ];

  return (
    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
      <div className="mb-3 text-sm font-semibold text-foreground">
        Kayit sonrasi hesap secimi
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm font-semibold text-foreground">{item.title}</div>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              {item.description}
            </div>
            <div className="mt-2 text-xs font-medium text-primary">{item.note}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        Platform Admin public kayit secenegi degildir. Admin kullanicilar giris
        yaptiginda otomatik olarak platform yonetim paneline yonlendirilir.
      </p>
    </div>
  );
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkEmail?: string; fromDemo?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const checkEmail = params?.checkEmail === "1";
  const fromDemo = params?.fromDemo;
  const demoExpired = fromDemo === "demo-expired" || fromDemo === "1";
  const demoDisabled = fromDemo === "demo-disabled";

  return (
    <AuthShell
      eyebrow="Yeni hesap"
      title="RiskNova hesabini olustur"
      description="Kaydini tamamla, sonra sadece Bireysel, OSGB veya Kurumsal akislardan birini secerek devam et."
      highlights={[
        {
          title: "Sade urun modeli",
          description:
            "Musteri tarafinda yalnizca Bireysel, OSGB ve Kurumsal hesap akislarini gosteririz.",
        },
        {
          title: "Uzmanlik ayri katman",
          description:
            "Is Guvenligi Uzmani, Isyeri Hekimi ve Diger Saglik Personeli gibi roller hesap tipinden ayridir.",
        },
        {
          title: "Admin rolu ayri",
          description:
            "Platform Admin bir kayit secenegi degil, global ic yetkidir ve giriste onceliklidir.",
        },
      ]}
      spotlight={
        <div className="space-y-3 text-sm leading-7 text-white/92">
          <p>
            Kamu kurumu kullanicisi, bagimsiz uzman, hekim veya danisman olmak ayri
            bir musteri hesap tipi dogurmaz.
          </p>
          <p>
            Bu ayrimlar uzmanlik ve sertifika katmaninda tutulur. Ornegin ISG
            uzmaninin A, B, C sinifi sertifika bilgisidir; hesap tipi degildir.
          </p>
        </div>
      }
      footer={
        <p className="text-sm leading-7 text-muted-foreground">
          Hesabin var mi?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-4"
          >
            Giris yap
          </Link>
        </p>
      }
    >
      {demoExpired || demoDisabled ? (
        <>
          <DemoSessionCleaner />
          <div className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-4 text-sm leading-6 text-[#4f2f06] dark:text-[#f6d79b]">
            <p className="mb-1 text-base font-semibold">
              RiskNova'yı denediğin için teşekkürler! 🎉
            </p>
            <p>
              {demoDisabled
                ? "Demo erişimin kapatıldı."
                : "Demo erişimin sona erdi."}{" "}
              Kaldığın yerden devam etmek ve tüm özelliklere tam erişim için hemen kendi hesabını oluştur — Bireysel, OSGB veya Kurumsal akıştan sana uygun olanı seç.
            </p>
          </div>
        </>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {checkEmail ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Kayit islemi baslatildi. Gerekliyse e-posta kutunu kontrol et.
        </div>
      ) : null}

      <AccountTypePreview />

      <SocialLoginButtons mode="register" />

      <form className="space-y-5">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          label="E-posta"
          placeholder="ornek@kurum.com"
          hint="Kayit sonrasi onboarding akisi ve erisim islemleri bu adres uzerinden yurur."
        />

        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          label="Sifre"
          placeholder="En az 8 karakter"
          hint="Guclu bir sifre belirle. Hesap tipi secimini kayit sonrasi yapacaksin."
        />

        <Button type="submit" formAction={signup} className="w-full" size="lg">
          Hesap Olustur
        </Button>
      </form>
    </AuthShell>
  );
}
