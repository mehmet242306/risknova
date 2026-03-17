import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(226,232,240,0.9)_0%,rgba(241,245,249,1)_50%,rgba(226,232,240,0.9)_100%)]",
        className,
      )}
      {...props}
    />
  );
}
