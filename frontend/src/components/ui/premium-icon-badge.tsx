import { cn } from "@/lib/utils";

const ICON_TONES = {
  risk: {
    shell:
      "border-rose-500/15 bg-[linear-gradient(145deg,rgba(127,29,29,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(159,18,57,0.28),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(251,113,133,0.34),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-rose-500 dark:text-rose-200",
  },
  cobalt: {
    shell:
      "border-blue-500/15 bg-[linear-gradient(145deg,rgba(29,78,216,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(37,99,235,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(96,165,250,0.32),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-blue-500 dark:text-blue-200",
  },
  amber: {
    shell:
      "border-amber-500/15 bg-[linear-gradient(145deg,rgba(180,83,9,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(217,119,6,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(251,191,36,0.32),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-amber-500 dark:text-amber-200",
  },
  violet: {
    shell:
      "border-violet-500/15 bg-[linear-gradient(145deg,rgba(109,40,217,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(124,58,237,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(167,139,250,0.34),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-violet-500 dark:text-violet-200",
  },
  emerald: {
    shell:
      "border-emerald-500/15 bg-[linear-gradient(145deg,rgba(5,150,105,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(16,185,129,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(52,211,153,0.34),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-emerald-500 dark:text-emerald-200",
  },
  teal: {
    shell:
      "border-teal-500/15 bg-[linear-gradient(145deg,rgba(13,148,136,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(20,184,166,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(45,212,191,0.32),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-teal-500 dark:text-teal-200",
  },
  indigo: {
    shell:
      "border-indigo-500/15 bg-[linear-gradient(145deg,rgba(67,56,202,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(79,70,229,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(129,140,248,0.34),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-indigo-500 dark:text-indigo-200",
  },
  orange: {
    shell:
      "border-orange-500/15 bg-[linear-gradient(145deg,rgba(194,65,12,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(249,115,22,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(251,146,60,0.34),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-orange-500 dark:text-orange-200",
  },
  plum: {
    shell:
      "border-fuchsia-500/15 bg-[linear-gradient(145deg,rgba(162,28,175,0.28),rgba(15,23,42,0.1))] dark:bg-[linear-gradient(145deg,rgba(192,38,211,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(232,121,249,0.34),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-fuchsia-500 dark:text-fuchsia-200",
  },
  gold: {
    shell:
      "border-[var(--gold)]/18 bg-[linear-gradient(145deg,rgba(200,155,91,0.28),rgba(15,23,42,0.08))] dark:bg-[linear-gradient(145deg,rgba(213,177,122,0.24),rgba(15,23,42,0.42))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(232,196,120,0.34),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-[var(--primary)] dark:text-[var(--gold)]",
  },
  neutral: {
    shell:
      "border-slate-400/15 bg-[linear-gradient(145deg,rgba(71,85,105,0.22),rgba(15,23,42,0.06))] dark:bg-[linear-gradient(145deg,rgba(71,85,105,0.22),rgba(15,23,42,0.34))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(148,163,184,0.25),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-slate-600 dark:text-slate-200",
  },
  success: {
    shell:
      "border-emerald-500/15 bg-[linear-gradient(145deg,rgba(4,120,87,0.24),rgba(15,23,42,0.08))] dark:bg-[linear-gradient(145deg,rgba(5,150,105,0.24),rgba(15,23,42,0.4))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(74,222,128,0.28),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-emerald-600 dark:text-emerald-200",
  },
  danger: {
    shell:
      "border-red-500/15 bg-[linear-gradient(145deg,rgba(153,27,27,0.24),rgba(15,23,42,0.08))] dark:bg-[linear-gradient(145deg,rgba(220,38,38,0.22),rgba(15,23,42,0.4))]",
    glow: "bg-[radial-gradient(circle_at_28%_24%,rgba(248,113,113,0.3),transparent_58%)]",
    plate: "bg-white/55 dark:bg-white/[0.04]",
    icon: "text-red-600 dark:text-red-200",
  },
} as const;

export type PremiumIconTone = keyof typeof ICON_TONES;

export function PremiumIconBadge({
  icon: Icon,
  tone,
  size = "md",
  className,
}: {
  icon: React.ElementType;
  tone: PremiumIconTone;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const cfg = ICON_TONES[tone];
  const sizeMap = {
    xs: {
      shell: "h-8 w-8 rounded-[0.85rem]",
      plate: "inset-[1px] rounded-[0.78rem]",
      icon: 14,
    },
    sm: {
      shell: "h-10 w-10 rounded-[1rem]",
      plate: "inset-[1px] rounded-[0.95rem]",
      icon: 17,
    },
    md: {
      shell: "h-12 w-12 rounded-[1.15rem]",
      plate: "inset-[1px] rounded-[1.08rem]",
      icon: 19,
    },
    lg: {
      shell: "h-14 w-14 rounded-[1.25rem]",
      plate: "inset-[1px] rounded-[1.18rem]",
      icon: 22,
    },
  } as const;

  const current = sizeMap[size];

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(15,23,42,0.16)]",
        current.shell,
        cfg.shell,
        className,
      )}
    >
      <div className={cn("absolute inset-0", cfg.glow)} />
      <div className={cn("absolute", current.plate, cfg.plate)} />
      <Icon
        size={current.icon}
        strokeWidth={1.85}
        className={cn(
          "relative z-10 shrink-0 drop-shadow-[0_4px_10px_rgba(15,23,42,0.16)]",
          cfg.icon,
        )}
      />
    </div>
  );
}
