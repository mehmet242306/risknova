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
  const requestedNext = searchParams.get("next") ?? "/dashboard";
  const next = requestedNext.startsWith("/") ? requestedNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: assuranceData, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (
        !assuranceError &&
        assuranceData?.nextLevel === "aal2" &&
        assuranceData.currentLevel !== "aal2"
      ) {
        return NextResponse.redirect(
          `${origin}/auth/mfa-challenge?next=${encodeURIComponent(next)}`
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }

    console.warn("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  // Hata durumunda login sayfasına yönlendir
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.")}`);
}
