"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateStrongPassword } from "@/lib/security/server";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";
import { resolveAppOriginFromHeaders } from "@/lib/server/app-origin";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const accountType = String(formData.get("accountType") ?? "individual").trim();
  const countryCode = String(formData.get("countryCode") ?? "TR").trim().toUpperCase();
  const languageCode = String(formData.get("languageCode") ?? "tr").trim().toLowerCase();

  if (!email || !password) {
    redirect("/register?error=E-posta ve şifre zorunludur.");
  }

  const passwordError = validateStrongPassword(password);
  if (passwordError) {
    redirect(`/register?error=${encodeURIComponent(passwordError)}`);
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin = resolveAppOriginFromHeaders(headerStore);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
      data: {
        preferred_account_type: accountType === "individual" ? "individual" : null,
        preferred_country_code: /^[A-Z]{2}$/.test(countryCode) ? countryCode : "TR",
        preferred_language: /^[a-z]{2}$/.test(languageCode) ? languageCode : "tr",
      },
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect(resolvePostLoginPath(await getAccountContextForUser(data.session.user.id)));
  }

  redirect("/register?checkEmail=1");
}
