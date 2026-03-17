import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-border text-center shadow-[var(--shadow-soft)]",
        compact ? "px-5 py-6" : "px-6 py-8 sm:px-8 sm:py-10",
        "bg-[linear-gradient(135deg,rgba(11,95,193,0.08)_0%,rgba(255,255,255,0.96)_58%,rgba(151,197,31,0.12)_100%)]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-white/90 text-primary shadow-[var(--shadow-soft)]">
          <span className="text-lg font-semibold">RN</span>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground sm:text-xl">
            {title}
          </h3>

          {description ? (
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
