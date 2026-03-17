import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatusAlertTone = "success" | "warning" | "danger" | "info";

type StatusAlertProps = {
  tone?: StatusAlertTone;
  children: ReactNode;
  className?: string;
};

const toneClasses: Record<StatusAlertTone, string> = {
  success:
    "border-green-200 bg-[linear-gradient(180deg,#f0fdf4_0%,#dcfce7_100%)] text-green-700",
  warning:
    "border-amber-200 bg-[linear-gradient(180deg,#fffbeb_0%,#fde68a_100%)] text-amber-700",
  danger:
    "border-red-200 bg-[linear-gradient(180deg,#fef2f2_0%,#fee2e2_100%)] text-red-700",
  info:
    "border-primary/20 bg-[linear-gradient(180deg,rgba(11,95,193,0.08)_0%,rgba(39,136,255,0.10)_100%)] text-primary",
};

export function StatusAlert({
  tone = "info",
  children,
  className,
}: StatusAlertProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_8px_18px_rgba(15,23,42,0.04)]",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
