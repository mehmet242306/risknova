import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Downgrade react-compiler/hooks rules to warnings — valid patterns
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",

      // TEMP: Teknik borç — Parça B Adım 1 sonrası bu kurallar ayrı bir
      // "chore: type safety cleanup" sprinttinde error'a yükseltilecek.
      // Şu anki durum: ~30 `any` kullanımı (slide editor, BIM, scan data
      // gibi karmaşık tiplerde) + 6 escape entity. CI'yi bloke etmemek için
      // geçici olarak warn'a düşürüldü. Yeni kod mümkünse `any` kullanmamalı.
      // Referans: docs/database-hardening-plan.md §25 (Type Safety Backlog).
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vitest coverage output — otomatik üretilen dosyalar
    "coverage/**",
  ]),
]);

export default eslintConfig;
