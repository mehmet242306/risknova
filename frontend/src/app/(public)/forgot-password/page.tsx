import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendResetLink } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const sent = params?.sent === "1";

  return (
    <AuthShell
      eyebrow="Şifre sıfırlama"
      title="Şifreni sıfırla"
      description="E-posta adresini gir, sana şifre yenileme bağlantısı gönderelim."
      footer={
        <p className="text-sm leading-7 text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-4"
          >
            Giriş ekranına dön
          </Link>
        </p>
      }
    >
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {sent ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          Eğer e-posta adresi uygunsa, şifre yenileme bağlantısı gönderildi.
        </div>
      ) : null}

      <form className="space-y-5">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          label="E-posta"
          placeholder="ornek@kurum.com"
          hint="Kayıt olduğun e-posta adresini gir."
        />

        <Button
          type="submit"
          formAction={sendResetLink}
          className="w-full"
          size="lg"
        >
          Yenileme Bağlantısı Gönder
        </Button>
      </form>
    </AuthShell>
  );
}
