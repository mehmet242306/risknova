"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateStrongPassword } from "@/lib/security/server";

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (!password) {
    redirect("/reset-password?error=Yeni şifre zorunludur.");
  }

  const passwordError = validateStrongPassword(password);
  if (passwordError) {
    redirect(`/reset-password?error=${encodeURIComponent(passwordError)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?reset=1");
}
