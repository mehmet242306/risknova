import Link from "next/link";
import Image from "next/image";
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
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo/risknova-favicon-64.svg"
        alt="RiskNova"
        className={cn(
          "rounded-xl shadow-[var(--shadow-soft)]",
          compact ? "h-8 w-8" : "h-10 w-10",
        )}
      />

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
            AI destekli İSG platformu
          </span>
        ) : null}
      </span>
    </Link>
  );
}
