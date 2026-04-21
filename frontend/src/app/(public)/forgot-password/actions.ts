"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendPasswordResetLinkEmail } from "@/lib/mailer";
import { createServiceClient } from "@/lib/security/server";

export async function sendResetLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/forgot-password?error=E-posta zorunludur.");
  }

  const headerStore = await headers();
  const origin =
    headerStore.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const service = createServiceClient();

  try {
    const { data: profile } = await service
      .from("user_profiles")
      .select("full_name")
      .eq("email", email)
      .maybeSingle();

    const { data, error } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${origin}/reset-password`,
      },
    });

    if (error) {
      const normalized = error.message.toLowerCase();
      if (
        normalized.includes("user not found") ||
        normalized.includes("email not found") ||
        normalized.includes("not found")
      ) {
        redirect("/forgot-password?sent=1");
      }

      redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
    }

    const actionLink = data.properties?.action_link ?? null;

    if (!actionLink) {
      redirect("/forgot-password?sent=1");
    }

    await sendPasswordResetLinkEmail({
      to: email,
      fullName: profile?.full_name || email.split("@")[0] || "Kullanici",
      resetUrl: actionLink,
      expiresInLabel: "60 dakika",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sifre yenileme baglantisi gonderilemedi.";
    redirect(`/forgot-password?error=${encodeURIComponent(message)}`);
  }

  redirect("/forgot-password?sent=1");
}
