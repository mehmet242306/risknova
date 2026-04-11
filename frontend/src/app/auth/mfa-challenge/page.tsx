import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { MfaChallengeClient } from "./MfaChallengeClient";

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params?.next?.startsWith("/") ? params.next : "/dashboard";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const [{ data: assuranceData, error: assuranceError }, { data: factorData }] =
    await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

  if (assuranceError) {
    redirect("/login?error=Iki adimli dogrulama durumu okunamadi.");
  }

  if (
    assuranceData?.currentLevel === "aal2" ||
    assuranceData?.nextLevel !== "aal2"
  ) {
    redirect(next);
  }

  const verifiedFactors = (factorData?.totp ?? []).map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name || "Authenticator",
    factorType: factor.factor_type,
  }));

  return (
    <AuthShell
      eyebrow="2FA Challenge"
      title="Ikinci adimi dogrula"
      description="Hesabina erismek icin authenticator uygulamandaki tek kullanimlik kodu gir."
      footer={
        <p className="text-sm leading-7 text-muted-foreground">
          Kod ureten cihaza artik erisemiyorsan once destek ekibiyle iletisime gec.
        </p>
      }
    >
      <Badge variant="accent" className="w-fit">
        MFA zorunlu
      </Badge>

      {verifiedFactors.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Dogrulanmis bir MFA cihazi bulunamadi. Guvenlik ayarlarindan yeni cihaz
          tanimlaman gerekiyor.
        </div>
      ) : (
        <MfaChallengeClient
          next={next}
          userEmail={user.email ?? "Hesap"}
          factors={verifiedFactors}
        />
      )}
    </AuthShell>
  );
}
