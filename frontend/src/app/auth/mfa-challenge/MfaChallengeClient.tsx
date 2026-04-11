"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type ChallengeFactor = {
  id: string;
  friendlyName: string;
  factorType: string;
};

type MfaChallengeClientProps = {
  next: string;
  userEmail: string;
  factors: ChallengeFactor[];
};

export function MfaChallengeClient({
  next,
  userEmail,
  factors,
}: MfaChallengeClientProps) {
  const router = useRouter();
  const [selectedFactorId, setSelectedFactorId] = useState(factors[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFactor = useMemo(
    () => factors.find((factor) => factor.id === selectedFactorId) ?? null,
    [factors, selectedFactorId]
  );

  async function handleVerify() {
    const normalizedCode = code.replace(/\s+/g, "");
    if (!selectedFactorId) {
      setError("Dogrulama yapilacak bir MFA cihazi secilemedi.");
      return;
    }
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("6 haneli dogrulama kodunu girin.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Kimlik dogrulama servisine baglanilamadi.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: selectedFactorId,
        code: normalizedCode,
      });

      if (verifyError) throw verifyError;

      router.replace(next);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Kod dogrulanamadi. Tekrar deneyin.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    if (!supabase) {
      router.replace("/login");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-secondary/35 p-4">
        <p className="text-sm leading-7 text-muted-foreground">
          <span className="font-medium text-foreground">{userEmail}</span> hesabi
          icin ikinci adim dogrulama zorunlu. Authenticator uygulamandaki 6 haneli
          kodu girerek devam edebilirsin.
        </p>
      </div>

      {factors.length > 1 ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Dogrulama cihazi
          </label>
          <div className="grid gap-2">
            {factors.map((factor) => (
              <button
                key={factor.id}
                type="button"
                onClick={() => setSelectedFactorId(factor.id)}
                className={[
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  selectedFactorId === factor.id
                    ? "border-primary bg-primary/8"
                    : "border-border bg-card hover:border-primary/35",
                ].join(" ")}
              >
                <div className="text-sm font-medium text-foreground">
                  {factor.friendlyName}
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {factor.factorType}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Input
        id="mfa-code"
        label="Dogrulama Kodu"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) =>
          setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
        }
        placeholder="123456"
        hint={
          selectedFactor
            ? `${selectedFactor.friendlyName} uygulamasindaki mevcut kodu girin.`
            : "Authenticator uygulamandaki mevcut kodu girin."
        }
        error={error ?? undefined}
        className="tracking-[0.25em]"
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={handleVerify}
          disabled={busy || code.length !== 6 || !selectedFactorId}
          className="sm:min-w-44"
        >
          {busy ? "Dogrulaniyor..." : "Devam Et"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSignOut}
          disabled={busy}
          className="sm:min-w-36"
        >
          Oturumu Kapat
        </Button>
      </div>
    </div>
  );
}
