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
    "border border-red-400/40 bg-[linear-gradient(135deg,#0b5fc1_0%,#2788ff_100%)] text-white shadow-[0_0_0_1px_rgba(239,68,68,0.16),0_16px_34px_rgba(11,95,193,0.28),0_0_24px_rgba(239,68,68,0.16)] hover:brightness-[1.04]",
  accent:
    "border border-red-400/40 bg-[linear-gradient(135deg,#97c51f_0%,#b9e22f_100%)] text-accent-foreground shadow-[0_0_0_1px_rgba(239,68,68,0.16),0_16px_34px_rgba(151,197,31,0.28),0_0_24px_rgba(239,68,68,0.16)] hover:brightness-[1.03]",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-[#dce8f5]",
  outline:
    "border border-primary/25 bg-white/90 text-primary shadow-[0_0_0_1px_rgba(239,68,68,0.08)] hover:bg-secondary",
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
