import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandProps = {
  href?: string;
  compact?: boolean;
  inverted?: boolean;
  className?: string;
};

export function Brand({
  href = "/",
  compact = false,
  inverted = false,
  className,
}: BrandProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-3", className)}
    >
      <span
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-2xl text-sm font-semibold shadow-[var(--shadow-soft)]",
          inverted
            ? "bg-white text-primary"
            : "bg-primary text-primary-foreground",
          compact && "size-9 rounded-xl text-xs",
        )}
      >
        RN
      </span>

      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate text-base font-semibold tracking-tight",
            inverted ? "text-white" : "text-foreground",
            compact && "text-sm",
          )}
        >
          RiskNova
        </span>

        {!compact ? (
          <span
            className={cn(
              "truncate text-xs",
              inverted ? "text-blue-50/85" : "text-muted-foreground",
            )}
          >
            AI destekli İSG karar destek platformu
          </span>
        ) : null}
      </span>
    </Link>
  );
}
