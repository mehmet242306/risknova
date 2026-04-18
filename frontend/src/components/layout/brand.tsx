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
      className={cn("inline-flex items-center gap-4", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo/risknova-favicon-64.svg"
        alt="RiskNova"
        className={cn(
          "rounded-xl shadow-[var(--shadow-soft)]",
          compact ? "h-8 w-8" : "h-[58px] w-[58px] xl:h-[62px] xl:w-[62px]",
        )}
      />

      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate tracking-tight",
            inverted ? "text-white" : "text-foreground",
            compact ? "text-sm font-semibold" : "text-[23px] font-semibold leading-none xl:text-[26px]",
          )}
        >
          Risk<span className="font-serif italic">Nova</span>
        </span>

        {!compact ? (
          <span
            className={cn(
              "truncate text-[13px] leading-tight xl:text-[14px]",
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
