"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (!password) {
    redirect("/reset-password?error=Yeni şifre zorunludur.");
  }

  if (password.length < 8) {
    redirect("/reset-password?error=Yeni şifre en az 8 karakter olmalıdır.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?reset=1");
}
