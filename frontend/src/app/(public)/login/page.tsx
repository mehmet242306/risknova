import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; passwordUpdated?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const reset = params?.reset === "1" || params?.passwordUpdated === "1";
  const next = params?.next || "/dashboard";

  return (
    <AuthShell
      eyebrow="Giris"
      title="Hesabina giris yap"
      description="RiskNova hesabina giris yap. Platform admin kullanicilari her zaman once yonetim paneline, diger kullanicilar ise hesap tipine uygun ekrana yonlendirilir."
      highlights={[
        {
          title: "Bireysel giris",
          description:
            "Kendi firmalarini, kurumlarini ve workspace alanlarini yoneten bireysel profesyoneller icin.",
        },
        {
          title: "OSGB girisi",
          description:
            "Firma, personel, gorevlendirme ve risk sureclerini yoneten OSGB ekipleri icin.",
        },
        {
          title: "Platform yonetimi",
          description:
            "Platform admin rolu public bir hesap tipi degildir; giris sonrasi otomatik olarak admin paneline tasinir.",
        },
      ]}
      spotlight={
        <div className="space-y-3 text-sm leading-7 text-white/92">
          <p>
            Giris ekrani tum kullanicilar icin ortaktir. Ayrim, giris sonrasinda
            hesap baglamina gore yapilir.
          </p>
          <p>
            Platform Admin public onboarding secenegi degildir. Bireysel, OSGB ve
            Kurumsal disinda ayri bir musteri hesap tipi gosterilmez.
          </p>
        </div>
      }
      footer={
        <p className="text-sm leading-7 text-muted-foreground">
          Hesabin yok mu?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline underline-offset-4"
          >
            Kayit ol
          </Link>
        </p>
      }
    >
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {reset ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Sifren guncellendi. Yeni sifrenle giris yapabilirsin.
        </div>
      ) : null}

      <SocialLoginButtons mode="login" />

      <form className="space-y-5">
        <input type="hidden" name="next" value={next} />

        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          label="E-posta"
          placeholder="ornek@kurum.com"
        />

        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          label="Sifre"
          placeholder="Sifreni gir"
        />

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Sifremi unuttum
          </Link>
        </div>

        <Button type="submit" formAction={login} className="w-full" size="lg">
          Giris Yap
        </Button>
      </form>
    </AuthShell>
  );
}
