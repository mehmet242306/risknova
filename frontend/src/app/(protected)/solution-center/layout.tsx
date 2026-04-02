"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/solution-center", key: "solutionCenter.chat", exact: true },
  { href: "/solution-center/history", key: "solutionCenter.history" },
  { href: "/solution-center/documents", key: "solutionCenter.documents" },
];

export default function SolutionCenterLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-navigation tabs */}
      <nav className="flex gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-soft)]">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
