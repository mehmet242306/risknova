import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-amber-500/20 bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#FBBF24_100%)] text-white shadow-[0_16px_34px_rgba(184,134,11,0.28)] hover:brightness-[1.05]",
  accent:
    "border border-amber-400/30 bg-[linear-gradient(135deg,#F59E0B_0%,#FBBF24_100%)] text-amber-950 shadow-[0_16px_34px_rgba(245,158,11,0.25)] hover:brightness-[1.03]",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-slate-200 dark:hover:bg-slate-700",
  outline:
    "border border-border bg-card text-primary shadow-[var(--shadow-soft)] hover:bg-secondary",
  ghost:
    "bg-transparent text-foreground hover:bg-secondary",
  danger:
    "bg-danger text-white hover:bg-[#b91c1c]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 rounded-xl px-3.5 text-sm",
  md: "h-11 rounded-2xl px-5 text-sm",
  lg: "h-12 rounded-2xl px-6 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type,
  ...props
}: ButtonProps) {
  const resolvedType =
    type ?? (props.formAction !== undefined ? "submit" : "button");

  return (
    <button
      type={resolvedType}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors transition-shadow",
        "focus-visible:shadow-[0_0_0_4px_var(--ring)]",
        "disabled:pointer-events-none disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
