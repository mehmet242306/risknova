import Link from "next/link";
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
    <main className="mx-auto max-w-md p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Giriş Yap</h1>
        <p className="text-sm text-gray-600">
          Hesabınla giriş yap ve dashboard'a geç.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {reset ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.
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
            autoComplete="current-password"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="text-right text-sm">
          <Link href="/forgot-password" className="underline">
            Şifremi unuttum
          </Link>
        </div>

        <button
          formAction={login}
          className="w-full rounded-md border px-4 py-2"
        >
          Giriş Yap
        </button>
      </form>

      <p className="text-sm text-gray-600">
        Hesabın yok mu?{" "}
        <Link href="/register" className="underline">
          Kayıt ol
        </Link>
      </p>
    </main>
  );
}
