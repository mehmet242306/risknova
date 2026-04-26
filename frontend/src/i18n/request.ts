import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./routing";

/**
 * Phase 2 status (2026-04-25):
 *   - tr/en: native translations
 *   - ar/ru/de/fr/es/zh/ja/ko/hi/az/id: bootstrapped from en.json, awaiting
 *     professional translation. Replace each file with a real translation
 *     as it ships.
 */

async function readLocaleFromRequest(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const headerStore = await headers();
  const accept = headerStore.get("accept-language") ?? "";
  const preferred = accept.split(",")[0]?.split("-")[0]?.trim().toLowerCase();
  if (isLocale(preferred)) return preferred;

  return defaultLocale;
}

async function loadMessages(locale: Locale) {
  return (await import(`../../messages/${locale}.json`)).default;
}

export default getRequestConfig(async () => {
  const locale = await readLocaleFromRequest();
  return {
    locale,
    timeZone: "Europe/Istanbul",
    messages: await loadMessages(locale),
  };
});
