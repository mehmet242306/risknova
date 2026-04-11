"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext =
    String(formData.get("next") ?? "/dashboard").trim() || "/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard";

  if (!email || !password) {
    redirect("/login?error=E-posta ve sifre zorunludur.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const raw = error.message.toLowerCase();

    let message = "Giris basarisiz. Bilgilerini kontrol et.";
    if (raw.includes("email not confirmed")) {
      message = "E-posta adresini dogrulaman gerekiyor.";
    } else if (raw.includes("invalid login credentials")) {
      message = "E-posta veya sifre hatali.";
    }

    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  const accessToken = data.session?.access_token;
  const backendBaseUrl =
    process.env.BACKEND_API_URL || "http://127.0.0.1:8000";

  if (accessToken) {
    try {
      await fetch(`${backendBaseUrl}/api/v1/audit-events/login`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
    } catch (auditError) {
      console.error("Login audit log request failed:", auditError);
    }
  }

  const { data: assuranceData, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  revalidatePath("/", "layout");

  if (
    !assuranceError &&
    assuranceData?.nextLevel === "aal2" &&
    assuranceData.currentLevel !== "aal2"
  ) {
    redirect(`/auth/mfa-challenge?next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}
