import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type BadgeVariant =
  | "default"
  | "accent"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "border-primary/20 bg-[linear-gradient(90deg,rgba(11,95,193,0.12)_0%,rgba(39,136,255,0.10)_100%)] text-primary",
  accent:
    "border-accent/30 bg-[linear-gradient(90deg,rgba(151,197,31,0.22)_0%,rgba(185,226,47,0.18)_100%)] text-[#33410b]",
  neutral:
    "border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-slate-700",
  success:
    "border-green-100 bg-[linear-gradient(180deg,#f0fdf4_0%,#dcfce7_100%)] text-green-700",
  warning:
    "border-amber-100 bg-[linear-gradient(180deg,#fffbeb_0%,#fef3c7_100%)] text-amber-700",
  danger:
    "border-red-100 bg-[linear-gradient(180deg,#fef2f2_0%,#fee2e2_100%)] text-red-700",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide shadow-[0_4px_14px_rgba(15,23,42,0.04)]",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
