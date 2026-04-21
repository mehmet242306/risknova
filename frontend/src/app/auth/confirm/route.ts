import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendWelcomeAccountEmail } from "@/lib/mailer";
import { createServiceClient } from "@/lib/security/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const service = createServiceClient();

      if (user?.id && user.email && !user.user_metadata?.welcome_email_sent_at) {
        try {
          await sendWelcomeAccountEmail({
            to: user.email,
            fullName:
              String(
                user.user_metadata?.full_name ??
                  user.user_metadata?.name ??
                  user.email.split("@")[0] ??
                  "Kullanici",
              ) || "Kullanici",
            loginUrl: `${origin}/login`,
            onboardingUrl: `${origin}/workspace/onboarding`,
          });

          await service.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...user.user_metadata,
              welcome_email_sent_at: new Date().toISOString(),
            },
          });
        } catch (mailError) {
          console.warn("[auth/confirm] welcome email failed:", mailError);
        }
      }

      const resolvedNext = user
        ? resolvePostLoginPath(await getAccountContextForUser(user.id))
        : next;

      return NextResponse.redirect(`${origin}${resolvedNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
