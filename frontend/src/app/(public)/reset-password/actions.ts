"use server";

import { redirect } from "next/navigation";
import { sendPasswordChangedEmail } from "@/lib/mailer";
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
  const { error } = await supabase.auth.updateUser({
    password,
    data: {
      must_change_password: false,
    },
  });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    await sendPasswordChangedEmail({
      to: user.email,
      fullName:
        String(
          user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email.split("@")[0] ??
            "Kullanici",
        ) || "Kullanici",
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"}/login`,
      changedAt: new Date().toLocaleString("tr-TR"),
    });
  }

  redirect("/login?reset=1");
}
