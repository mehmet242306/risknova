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
    "bg-[#0b5fc1] text-white shadow-lg hover:bg-[#0a4fa8] transition-colors",
  accent:
    "border-2 border-[#0b5fc1] bg-white text-[#0b5fc1] shadow-sm hover:bg-[#0b5fc1]/5 transition-colors",
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
