import Link from "next/link";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePasswordAction } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; required?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;
  const required = params?.required === "1";

  return (
    <AuthShell
      eyebrow="Yeni sifre"
      title="Yeni sifre belirle"
      description={
        required
          ? "Gecici giris bilgileriyle oturum actin. Devam etmek icin once yeni sifreni belirlemelisin."
          : "Yeni sifreni gir ve hesabina geri don."
      }
      footer={
        <p className="text-sm leading-7 text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-4"
          >
            Giris ekranina don
          </Link>
        </p>
      }
    >
      {required ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          Guvenlik geregi ilk giriste sifreni degistirmen zorunludur.
        </div>
      ) : null}

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
          label="Yeni sifre"
          placeholder="En az 8 karakter"
          hint="Guvenli bir sifre belirle."
        />

        <Button
          type="submit"
          formAction={updatePasswordAction}
          className="w-full"
          size="lg"
        >
          Sifreyi guncelle
        </Button>
      </form>
    </AuthShell>
  );
}
