"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const PREFIX = "rn_state_";

/**
 * useState gibi çalışır ama değeri sessionStorage'da saklar.
 * Sayfa değişip geri dönüldüğünde son değer korunur.
 * Tab kapanınca (sessionStorage) otomatik temizlenir.
 *
 * Hydration-safe: Her zaman initialValue ile başlar,
 * useEffect ile client-side'da sessionStorage'dan yükler.
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const fullKey = PREFIX + key;
  const initialized = useRef(false);

  const [state, setStateRaw] = useState<T>(initialValue);

  // Client-side: sessionStorage'dan yukle (hydration sonrasi)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(fullKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as T;
        setStateRaw(parsed);
      }
    } catch { /* ignore */ }
    initialized.current = true;
  }, [fullKey]);

  // State degistiginde sessionStorage'a yaz
  useEffect(() => {
    if (!initialized.current) return;
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [fullKey, state]);

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateRaw(value);
  }, []);

  return [state, setState];
}

/**
 * Belirli bir sayfa prefix'ine ait tüm state'leri temizler.
 */
export function clearPersistedStates(pagePrefix: string) {
  if (typeof window === "undefined") return;
  const fullPrefix = PREFIX + pagePrefix;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(fullPrefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}
