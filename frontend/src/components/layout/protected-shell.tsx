"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProtectedShellProps = {
  children: ReactNode;
};

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/companies", label: "Firmalar / Kurumlar" },
  { href: "/risk-analysis", label: "Risk Analizi" },
  { href: "/score-history", label: "Skor Geçmişi" },
  { href: "/reports", label: "Raporlar" },
  { href: "/profile", label: "Profil" },
  { href: "/settings", label: "Ayarlar" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname.startsWith(href);
}

function navItemClass(isActive: boolean) {
  return cn(
    "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition-colors transition-shadow",
    isActive
      ? "border border-red-400/35 bg-[linear-gradient(90deg,#0b5fc1_0%,#2788ff_100%)] text-white shadow-[0_0_0_1px_rgba(239,68,68,0.14),0_16px_34px_rgba(11,95,193,0.22),0_0_20px_rgba(239,68,68,0.12)]"
      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
  );
}

export function ProtectedShell({ children }: ProtectedShellProps) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[linear-gradient(90deg,#0b5fc1_0%,#0f6dd2_48%,#084c9a_100%)] backdrop-blur-xl">
        <div className="page-shell py-4">
          <div className="flex items-center justify-between gap-4">
            <Brand href="/dashboard" compact inverted />

            <div className="hidden items-center gap-3 md:flex">
              <Badge className="border-white/20 bg-white/10 text-white">
                Kurumsal Çalışma Alanı
              </Badge>

              <Link
                href="/profile"
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-red-300/35 bg-white/10 px-4 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(239,68,68,0.10)] transition-colors hover:bg-white/18"
              >
                Profil
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="page-shell py-6">
        <div className="mb-4 overflow-x-auto lg:hidden">
          <div className="flex min-w-max gap-2 pb-1">
            {navigation.map((item) => {
              const active = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors transition-shadow",
                    active
                      ? "border border-red-400/35 bg-[linear-gradient(90deg,#0b5fc1_0%,#2788ff_100%)] text-white shadow-[0_0_0_1px_rgba(239,68,68,0.14),0_16px_34px_rgba(11,95,193,0.22),0_0_20px_rgba(239,68,68,0.12)]"
                      : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,248,255,0.96)_100%)]">
              <CardHeader className="p-6">
                <Badge className="w-fit">RiskNova Paneli</Badge>
                <CardTitle className="text-xl">Operasyon menüsü</CardTitle>
                <CardDescription>
                  Tüm işyeri operasyonlarını sade ve odaklı bir çalışma alanında yönet.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-2 px-4 pb-4">
                {navigation.map((item) => {
                  const active = isActivePath(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={navItemClass(active)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </aside>

          <div className="min-w-0">
            <div className="page-stack">{children}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
