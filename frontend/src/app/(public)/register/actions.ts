"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/register?error=E-posta ve şifre zorunludur.");
  }

  if (password.length < 8) {
    redirect("/register?error=Şifre en az 8 karakter olmalıdır.");
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect("/dashboard");
  }

  redirect("/register?checkEmail=1");
}
