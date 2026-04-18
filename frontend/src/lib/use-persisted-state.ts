"use client";

import { useState, useEffect, useCallback, useLayoutEffect } from "react";

const PREFIX = "rn_state_";
// Wizard taslakları 24 saat saklanır — daha eski taslak stale sayılır, temizlenir.
const TTL_MS = 24 * 60 * 60 * 1000;

interface StoredEntry<T> {
  value: T;
  savedAt: number;
}

function isStoredEntry(obj: unknown): obj is StoredEntry<unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "value" in obj &&
    "savedAt" in obj &&
    typeof (obj as { savedAt: unknown }).savedAt === "number"
  );
}

/**
 * Server'da useEffect, client'ta useLayoutEffect — paint öncesi senkron yükleme.
 * Bu kullanıcının "default değer flash"ını görmesini engeller.
 */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * localStorage'dan değeri okur (TTL kontrollü, eski format uyumlu, hata-toleranslı).
 * SSR'da güvenli — server'da window yok.
 */
function readStoredValue<T>(fullKey: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(fullKey);
    if (stored === null) return fallback;
    const parsed = JSON.parse(stored);
    if (isStoredEntry(parsed)) {
      if (Date.now() - parsed.savedAt < TTL_MS) {
        return parsed.value as T;
      }
      // TTL geçmiş, sil
      window.localStorage.removeItem(fullKey);
      return fallback;
    }
    // Geriye dönük uyumluluk: eski sessionStorage format (direkt değer, no wrapper)
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * useState gibi çalışır ama değeri localStorage'da 24 saat TTL ile saklar.
 *
 * **Hydration stratejisi:**
 * - SSR'da `initialValue` döner.
 * - Client mount'ta `useLayoutEffect` ile **paint öncesi** localStorage'dan okur,
 *   böylece kullanıcı default değeri hiç görmez (flash yok, race yok).
 *
 * **Garanti:** Tab kapansa, F5 yapılsa, tarayıcı restart olsa bile (24 saat içinde) state korunur.
 *
 * @returns `[state, setState, isHydrated]` — `isHydrated` localStorage okuması bittikten
 *          sonra true olur. Wizard buna göre disabled state göstermek isteyebilir.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const fullKey = PREFIX + key;

  // SSR-safe initial value (server'da localStorage okumaz, client mount'ta useLayoutEffect güncelleyecek)
  const [state, setStateRaw] = useState<T>(initialValue);

  // Track: localStorage okuma tamamlandı mı? Tamamlanmadan yazma yapma (race önler).
  const [hydrated, setHydrated] = useState(false);

  // Mount'ta paint ÖNCESİ localStorage'dan oku — flash yok
  useIsoLayoutEffect(() => {
    const stored = readStoredValue<T>(fullKey, initialValue);
    setStateRaw(stored);
    setHydrated(true);
    // initialValue eklemiyoruz deps'e çünkü değişmesi yeniden yükleme tetiklemesin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  // State değişince localStorage'a yaz (sadece hydration sonrası, race önlemek için)
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      const entry: StoredEntry<T> = { value: state, savedAt: Date.now() };
      window.localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch {
      /* localStorage doluluk veya izin hatası — sessizce geç */
    }
  }, [fullKey, state, hydrated]);

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateRaw(value);
  }, []);

  return [state, setState];
}

/**
 * Belirli bir sayfa prefix'ine ait tüm state'leri temizler.
 * Wizard başarıyla tamamlandıktan sonra çağrılmalı.
 */
export function clearPersistedStates(pagePrefix: string) {
  if (typeof window === "undefined") return;
  const fullPrefix = PREFIX + pagePrefix;
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(fullPrefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => window.localStorage.removeItem(k));
}
