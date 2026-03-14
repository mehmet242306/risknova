import Link from "next/link";
import { updatePasswordAction } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Yeni Şifre Belirle</h1>
        <p className="text-sm text-gray-600">
          Yeni şifreni gir ve hesabına geri dön.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium">
            Yeni Şifre
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
          formAction={updatePasswordAction}
          className="w-full rounded-md border px-4 py-2"
        >
          Şifreyi Güncelle
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
