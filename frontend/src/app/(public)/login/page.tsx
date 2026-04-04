import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialLoginButtons } from "@/components/auth/social-login-buttons";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const reset = params?.reset === "1";

  return (
    <AuthShell
      eyebrow="Giriş"
      title="Hesabına giriş yap"
      description="Risk analizi, saha takibi ve raporlama süreçlerini tek platformda yönetmeye devam et."
      footer={
        <p className="text-sm leading-7 text-muted-foreground">
          Hesabın yok mu?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline underline-offset-4"
          >
            Kayıt ol
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
          Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.
        </div>
      ) : null}

      <SocialLoginButtons mode="login" />

      <form className="space-y-5">
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
          label="Şifre"
          placeholder="Şifreni gir"
        />

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Şifremi unuttum
          </Link>
        </div>

        <Button type="submit" formAction={login} className="w-full" size="lg">
          Giriş Yap
        </Button>
      </form>
    </AuthShell>
  );
}
