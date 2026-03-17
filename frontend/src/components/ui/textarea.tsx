import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export function Textarea({
  className,
  containerClassName,
  label,
  hint,
  error,
  id,
  name,
  rows = 5,
  ...props
}: TextareaProps) {
  const fieldId = id ?? (typeof name === "string" ? name : undefined);
  const hintId = fieldId ? `${fieldId}-hint` : undefined;
  const errorId = fieldId ? `${fieldId}-error` : undefined;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-2", containerClassName)}>
      {label ? (
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
      ) : null}

      <textarea
        id={fieldId}
        name={name}
        rows={rows}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={cn(
          "min-h-[132px] w-full rounded-2xl border px-4 py-3 text-sm text-foreground transition-colors transition-shadow",
          "border-primary/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,249,255,0.95)_100%)]",
          "shadow-[0_8px_20px_rgba(15,23,42,0.05)]",
          "hover:border-primary/30",
          "focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring),0_12px_28px_rgba(11,95,193,0.12)]",
          error &&
            "border-danger focus-visible:shadow-[0_0_0_4px_rgba(220,38,38,0.12)]",
          className,
        )}
        {...props}
      />

      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs font-medium leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
