import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePasswordAction } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <AuthShell
      eyebrow="Yeni şifre"
      title="Yeni şifre belirle"
      description="Yeni şifreni gir ve hesabına geri dön."
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

      <form className="space-y-5">
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          label="Yeni Şifre"
          placeholder="En az 8 karakter"
          hint="Güvenli bir şifre belirle."
        />

        <Button
          type="submit"
          formAction={updatePasswordAction}
          className="w-full"
          size="lg"
        >
          Şifreyi Güncelle
        </Button>
      </form>
    </AuthShell>
  );
}
