import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { signup } from "./actions";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkEmail?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const checkEmail = params?.checkEmail === "1";

  return (
    <AuthShell
      eyebrow="Yeni hesap"
      title="RiskNova hesabını oluştur"
      description="Kuruluşunu, çalışma alanını ve risk yönetimi süreçlerini profesyonel bir panel içinde toplamaya başla."
      footer={
        <p className="text-sm leading-7 text-muted-foreground">
          Hesabın var mı?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-4"
          >
            Giriş yap
          </Link>
        </p>
      }
    >
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {checkEmail ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Kayıt işlemi başlatıldı. Gerekliyse e-posta kutunu kontrol et.
        </div>
      ) : null}

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
          hint="Hesap doğrulama ve erişim işlemleri bu adres üzerinden yürütülür."
        />

        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          label="Şifre"
          placeholder="En az 8 karakter"
          hint="Daha güvenli bir erişim için güçlü bir şifre belirle."
        />

        <Button type="submit" formAction={signup} className="w-full" size="lg">
          Kayıt Ol
        </Button>
      </form>
    </AuthShell>
  );
}

