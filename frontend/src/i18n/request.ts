import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./routing";

/**
 * Locales that currently ship full JSON message files.
 * Other locales from `routing.ts` are accepted for cookie storage but
 * fall back to the default locale's messages until translations ship.
 */
const loadableLocales: Locale[] = ["tr", "en"];

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
  const target = loadableLocales.includes(locale) ? locale : defaultLocale;
  return (await import(`../../messages/${target}.json`)).default;
}

export default getRequestConfig(async () => {
  const locale = await readLocaleFromRequest();
  return {
    locale,
    timeZone: "Europe/Istanbul",
    messages: await loadMessages(locale),
  };
});
