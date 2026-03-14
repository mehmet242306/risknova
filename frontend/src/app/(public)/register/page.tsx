import Link from "next/link";
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
    <main className="mx-auto max-w-md p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Kayıt Ol</h1>
        <p className="text-sm text-gray-600">
          Yeni hesap oluştur. Gerekliyse e-posta kutunu kontrol et.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {checkEmail ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          Kayıt işlemi başlatıldı. Gerekliyse e-posta kutunu kontrol et.
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

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium">
            Şifre
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <button
          formAction={signup}
          className="w-full rounded-md border px-4 py-2"
        >
          Kayıt Ol
        </button>
      </form>

      <p className="text-sm text-gray-600">
        Hesabın var mı?{" "}
        <Link href="/login" className="underline">
          Giriş yap
        </Link>
      </p>
    </main>
  );
}
