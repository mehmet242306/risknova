"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDemoAccessState } from "@/lib/platform-admin/demo-access";

const CHECK_INTERVAL_MS = 15000;

export function DemoSessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const signingOutRef = useRef(false);

  useEffect(() => {
    const client = createClient();
    if (client === null) return;
    const supabaseClient: NonNullable<ReturnType<typeof createClient>> = client;

    let disposed = false;

    async function handleBlockedSession(status: "expired" | "disabled") {
      if (signingOutRef.current || disposed) return;
      signingOutRef.current = true;

      try {
        await supabaseClient.auth.signOut();
      } finally {
        // Kullanıcıyı kayıt akışına yönlendir — login'e error pop-up göstermek yerine
        // "teşekkürler + hesap oluştur" deneyimine çıkar. Süresi dolmuş mu yoksa
        // disable edilmiş mi ayırt edebilmek için query param taşınır.
        const from = status === "disabled" ? "demo-disabled" : "demo-expired";
        router.replace(`/register?fromDemo=${from}`);
      }
    }

    async function checkSession() {
      if (disposed || signingOutRef.current) return;

      const { data, error } = await supabaseClient.auth.getUser();
      if (disposed || error || !data.user) return;

      const access = getDemoAccessState({
        userMetadata: data.user.user_metadata,
        appMetadata: data.user.app_metadata,
      });

      if (access.isBlocked) {
        await handleBlockedSession(access.status === "disabled" ? "disabled" : "expired");
      }
    }

    void checkSession();

    const intervalId = window.setInterval(() => {
      void checkSession();
    }, CHECK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname, router]);

  return null;
}
