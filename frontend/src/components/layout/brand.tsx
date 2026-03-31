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
          "inline-flex items-center justify-center rounded-2xl text-sm font-semibold shadow-[var(--shadow-soft)]",
          inverted
            ? "bg-white text-[#B8860B]"
            : "bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_100%)] text-white",
          compact ? "size-9 rounded-xl text-xs" : "size-11",
        )}
      >
        RN
      </span>

      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate tracking-tight",
            inverted ? "text-white" : "text-foreground",
            compact ? "text-sm font-semibold" : "text-base font-semibold",
          )}
        >
          Risk<span className="font-serif italic">Nova</span>
        </span>

        {!compact ? (
          <span
            className={cn(
              "truncate text-xs",
              inverted ? "text-amber-100/85" : "text-muted-foreground",
            )}
          >
            AI destekli İSG karar destek platformu
          </span>
        ) : null}
      </span>
    </Link>
  );
}
