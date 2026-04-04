import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth Callback Route
 * Supabase OAuth provider'larından dönen code parametresini session'a çevirir.
 * Google, Apple, LinkedIn, Facebook redirect'leri buraya gelir.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.warn("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  // Hata durumunda login sayfasına yönlendir
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.")}`);
}
