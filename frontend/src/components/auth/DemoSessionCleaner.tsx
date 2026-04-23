"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Süresi dolan demo kullanıcısı /register'a yönlendirildiğinde çalışır.
 * Session cookie'si hâlâ auth'lı sayılıyor ama demo_access_expired olduğu için
 * tekrar /dashboard'a dönünce middleware onu tekrar /register'a atar.
 *
 * Bu component sessizce signOut() çağırıp session'ı temizler — kullanıcı
 * gerçekten "logged out" durumuna geçer, kayıt akışı normal çalışır.
 */
export function DemoSessionCleaner() {
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void supabase.auth.signOut();
  }, []);

  return null;
}
