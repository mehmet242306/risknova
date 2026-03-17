import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-border p-6 shadow-[var(--shadow-card)] sm:p-8",
        "bg-[linear-gradient(135deg,rgba(11,95,193,0.11)_0%,rgba(255,255,255,0.97)_55%,rgba(151,197,31,0.16)_100%)]",
        className,
      )}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>

            {description ? (
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>

          {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
        </div>

        {actions ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
