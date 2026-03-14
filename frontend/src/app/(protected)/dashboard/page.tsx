import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Giriş başarılı. Aktif kullanıcı: {user.email}
        </p>
      </div>

      <form>
        <button
          formAction={signOutAction}
          className="rounded-md border px-4 py-2"
        >
          Çıkış Yap
        </button>
      </form>
    </main>
  );
}
