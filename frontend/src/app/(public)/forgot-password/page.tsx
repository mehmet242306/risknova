import Link from "next/link";
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
    <main className="mx-auto max-w-md p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Şifremi Unuttum</h1>
        <p className="text-sm text-gray-600">
          E-posta adresini yaz. Sana şifre yenileme bağlantısı gönderelim.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {sent ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          Eğer e-posta adresi uygunsa, şifre yenileme bağlantısı gönderildi.
        </div>
      ) : null}

      <form className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium">
            E-posta
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <button
          formAction={sendResetLink}
          className="w-full rounded-md border px-4 py-2"
        >
          Yenileme Bağlantısı Gönder
        </button>
      </form>

      <p className="text-sm text-gray-600">
        <Link href="/login" className="underline">
          Giriş ekranına dön
        </Link>
      </p>
    </main>
  );
}
