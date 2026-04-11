"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * useIsAdmin — Super admin kontrolü (DB-based, fail-CLOSED).
 *
 * Bu hook, kullanıcının `is_super_admin()` RPC fonksiyonunu çağırarak
 * super admin olup olmadığını kontrol eder. RPC, Adım 0.5 Parça A
 * migration'ında oluşturuldu (docs/database-hardening-plan.md §13.2).
 *
 * Güvenlik ilkeleri:
 * - Tüm fail path'ler `false` döner (fail-CLOSED)
 * - Eski email allow-list kaldırıldı
 * - Eski `profile_roles` tablo sorgusu kaldırıldı (tablo zaten yoktu)
 *
 * Dönüş değerleri:
 *   - `null`  → yükleniyor (henüz RPC cevap vermedi)
 *   - `true`  → is_super_admin = true
 *   - `false` → değil, veya hata, veya oturum yok
 *
 * Kullanım:
 * ```tsx
 * const isAdmin = useIsAdmin();
 * if (isAdmin === null) return <Loading />;
 * if (isAdmin === false) return <AccessDenied />;
 * return <AdminPanel />;
 * ```
 *
 * Not: Bu hook sadece UI gating içindir. Güvenlik kritik tüm işlemler
 * backend'de `requireSuperAdmin` ile doğrulanır (Parça B).
 */
export function useIsAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      try {
        // 1. Auth kullanıcısı var mı?
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setIsAdmin(false);
          return;
        }

        // 2. is_super_admin() RPC çağrısı — default parametresi auth.uid() kullanır
        const { data, error } = await supabase.rpc("is_super_admin");
        if (cancelled) return;

        if (error) {
          console.error(
            `[useIsAdmin] [${new Date().toISOString()}] [user=${user.id}] RPC error:`,
            error,
          );
          setIsAdmin(false);
          return;
        }

        // RPC `boolean` döner. `true` dışındaki her şey false sayılır.
        setIsAdmin(data === true);
      } catch (err) {
        if (cancelled) return;
        console.error(
          `[useIsAdmin] [${new Date().toISOString()}] unexpected error:`,
          err,
        );
        setIsAdmin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
