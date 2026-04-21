"use client";

import type { ReactNode } from "react";
import { NextIntlClientProvider, type Messages } from "next-intl";
import { DemoSessionGuard } from "@/components/auth/DemoSessionGuard";
import { I18nProvider } from "@/lib/i18n";

type Props = {
  children: ReactNode;
  locale: string;
  messages: Messages;
};

export function Providers({ children, locale, messages }: Props) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Europe/Istanbul"
    >
      <I18nProvider>
        <DemoSessionGuard />
        {children}
      </I18nProvider>
    </NextIntlClientProvider>
  );
}
