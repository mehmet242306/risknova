import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest konfigürasyonu — RiskNova frontend
 *
 * Kurulum tarihi: 2026-04-11
 * Referans: docs/database-hardening-plan.md §20
 *
 * Komutlar (frontend/ dizininden):
 *   npm run test           # Tek seferlik çalıştırma (CI için)
 *   npm run test:watch     # Watch mode (geliştirme)
 *   npm run test:ui        # Görsel test runner (web UI)
 *   npm run test:coverage  # Coverage raporu
 */
export default defineConfig({
  test: {
    // Node ortamı — şimdilik sadece server-side helper'lar test ediliyor
    // (lib/supabase/*, lib/utils/*, API route'lar)
    // İleride React bileşen testleri için 'jsdom' eklenecek
    environment: "node",

    // Test dosyası kalıbı
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],

    // Global API kapalı — her dosyada explicit import (vi, describe, it, expect)
    globals: false,

    // Coverage (sadece --coverage flag'i ile çalışır)
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.test.ts",
        "src/lib/**/*.d.ts",
        "src/lib/**/index.ts",
      ],
    },

    // Her test için maksimum süre — yavaş test'ler problem
    testTimeout: 10_000,

    // Temizlik: her testten sonra mock'ları sıfırla
    clearMocks: true,
  },

  resolve: {
    alias: {
      // Next.js'in @/ alias'ını Vitest için de ayarla
      // tsconfig.json'daki "paths": { "@/*": ["./src/*"] } ile uyumlu
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
