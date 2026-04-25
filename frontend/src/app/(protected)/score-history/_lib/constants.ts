import {
  ClipboardCheck,
  Target,
  TriangleAlert,
  Sparkles,
  FileDown,
} from "lucide-react";
import type { ComponentType } from "react";

export type SurfaceCategoryId =
  | "checklists"
  | "inspection"
  | "findings"
  | "nova"
  | "closure";

export type CategoryDefinition = {
  key: SurfaceCategoryId;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
};

export type SurfaceTone = {
  tabActive: string;
  tabIdle: string;
  countActive: string;
  countIdle: string;
};

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    key: "checklists",
    label: "Checklistler",
    description: "Hazır checklist ve saha senaryoları",
    icon: ClipboardCheck,
  },
  {
    key: "inspection",
    label: "Aktif İnceleme",
    description: "Sahada doldurulan soru akışı",
    icon: Target,
  },
  {
    key: "findings",
    label: "Tespitler",
    description: "Bugünkü eksik ve risk havuzu",
    icon: TriangleAlert,
  },
  {
    key: "nova",
    label: "Nova",
    description: "Checklist stüdyosu ve akıllı öneriler",
    icon: Sparkles,
  },
  {
    key: "closure",
    label: "Kapanış",
    description: "Denetim kontrolü ve raporlama",
    icon: FileDown,
  },
];

export const SURFACE_TONES: Record<SurfaceCategoryId, SurfaceTone> = {
  checklists: {
    tabActive: "border-sky-300 bg-gradient-to-br from-sky-200 via-cyan-200 to-blue-300 text-slate-950 shadow-[0_18px_45px_rgba(14,165,233,0.2)] dark:border-sky-300/45 dark:from-sky-500 dark:via-cyan-500 dark:to-blue-500 dark:text-slate-950",
    tabIdle: "border-sky-200/70 bg-sky-50/80 text-sky-800 hover:border-sky-300 hover:bg-sky-100 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200 dark:hover:bg-sky-400/15",
    countActive: "border-white/35 bg-white/25 text-slate-950 dark:border-white/30 dark:bg-white/20 dark:text-white",
    countIdle: "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/15 dark:text-sky-100",
  },
  inspection: {
    tabActive: "border-amber-300 bg-gradient-to-br from-amber-200 via-yellow-300 to-orange-300 text-slate-950 shadow-[0_18px_45px_rgba(217,119,6,0.24)] dark:border-amber-300/55 dark:from-amber-500 dark:via-yellow-500 dark:to-orange-500 dark:text-slate-950",
    tabIdle: "border-amber-200/70 bg-amber-50/80 text-amber-800 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/15",
    countActive: "border-white/35 bg-white/25 text-slate-950 dark:border-white/30 dark:bg-white/20 dark:text-white",
    countIdle: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/15 dark:text-amber-100",
  },
  findings: {
    tabActive: "border-rose-300 bg-gradient-to-br from-rose-200 via-orange-200 to-red-300 text-slate-950 shadow-[0_18px_45px_rgba(225,29,72,0.22)] dark:border-rose-300/50 dark:from-rose-500 dark:via-orange-500 dark:to-red-500 dark:text-white",
    tabIdle: "border-rose-200/70 bg-rose-50/80 text-rose-800 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/15",
    countActive: "border-white/35 bg-white/25 text-slate-950 dark:border-white/30 dark:bg-white/20 dark:text-white",
    countIdle: "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/15 dark:text-rose-100",
  },
  nova: {
    tabActive: "border-violet-300 bg-gradient-to-br from-violet-200 via-fuchsia-200 to-purple-300 text-slate-950 shadow-[0_18px_45px_rgba(124,58,237,0.2)] dark:border-violet-300/50 dark:from-violet-500 dark:via-fuchsia-500 dark:to-purple-500 dark:text-white",
    tabIdle: "border-violet-200/70 bg-violet-50/80 text-violet-800 hover:border-violet-300 hover:bg-violet-100 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200 dark:hover:bg-violet-400/15",
    countActive: "border-white/35 bg-white/25 text-slate-950 dark:border-white/30 dark:bg-white/20 dark:text-white",
    countIdle: "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-400/20 dark:bg-violet-400/15 dark:text-violet-100",
  },
  closure: {
    tabActive: "border-emerald-300 bg-gradient-to-br from-emerald-200 via-teal-200 to-green-300 text-slate-950 shadow-[0_18px_45px_rgba(16,185,129,0.22)] dark:border-emerald-300/50 dark:from-emerald-500 dark:via-teal-500 dark:to-green-500 dark:text-slate-950",
    tabIdle: "border-emerald-200/70 bg-emerald-50/80 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/15",
    countActive: "border-white/35 bg-white/25 text-slate-950 dark:border-white/30 dark:bg-white/20 dark:text-white",
    countIdle: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/15 dark:text-emerald-100",
  },
};

export function getSurfaceTone(id: SurfaceCategoryId): SurfaceTone {
  return SURFACE_TONES[id];
}

export const RESPONSE_COPY = {
  uygun: {
    label: "Uygun",
    buttonClassName:
      "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-950/20 dark:text-emerald-200 dark:hover:bg-emerald-950/30",
    badgeVariant: "success" as const,
  },
  uygunsuz: {
    label: "Uygunsuz",
    buttonClassName:
      "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-950/30",
    badgeVariant: "warning" as const,
  },
  kritik: {
    label: "Kritik",
    buttonClassName:
      "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-700/40 dark:bg-red-950/20 dark:text-red-200 dark:hover:bg-red-950/30",
    badgeVariant: "danger" as const,
  },
  na: {
    label: "N/A",
    buttonClassName:
      "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10",
    badgeVariant: "neutral" as const,
  },
};

export const RESPONSE_TONES = {
  unanswered: {
    card: "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-amber-50/35 dark:border-white/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950",
    accent: "bg-slate-300 dark:bg-slate-500",
    marker: "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
    info: "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
  },
  uygun: {
    card: "border-emerald-200 bg-gradient-to-br from-white via-emerald-50/65 to-teal-50/50 dark:border-emerald-400/20 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950",
    accent: "bg-gradient-to-b from-emerald-400 to-teal-500",
    marker: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/15 dark:text-emerald-100",
    info: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100",
  },
  uygunsuz: {
    card: "border-amber-200 bg-gradient-to-br from-white via-amber-50/70 to-orange-50/50 dark:border-amber-400/20 dark:from-slate-950 dark:via-amber-950/20 dark:to-slate-950",
    accent: "bg-gradient-to-b from-amber-400 to-orange-500",
    marker: "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/15 dark:text-amber-100",
    info: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100",
  },
  kritik: {
    card: "border-rose-200 bg-gradient-to-br from-white via-rose-50/70 to-red-50/50 dark:border-rose-400/20 dark:from-slate-950 dark:via-rose-950/20 dark:to-slate-950",
    accent: "bg-gradient-to-b from-rose-500 to-red-600",
    marker: "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/15 dark:text-rose-100",
    info: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100",
  },
  na: {
    card: "border-indigo-200 bg-gradient-to-br from-white via-indigo-50/60 to-slate-50/50 dark:border-indigo-400/20 dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-950",
    accent: "bg-gradient-to-b from-indigo-400 to-slate-500",
    marker: "border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-400/20 dark:bg-indigo-400/15 dark:text-indigo-100",
    info: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-100",
  },
} as const;

export function getResponseTone(status?: keyof typeof RESPONSE_COPY | null) {
  return status ? RESPONSE_TONES[status] : RESPONSE_TONES.unanswered;
}

export const MODE_COPY = {
  quick: { label: "Hızlı kontrol", questionCount: 10, description: "8-12 soru ile sahada kısa tarama." },
  standard: { label: "Standart denetim", questionCount: 20, description: "15-30 soruluk dengeli saha denetimi." },
  detailed: { label: "Detaylı inceleme", questionCount: 30, description: "Kök neden ve tekrarları derinlemesine tarar." },
};

export const SOURCE_LABELS = {
  manual: "Manuel",
  nova: "Nova",
  library: "Kütüphane",
  risk_analysis: "Risk Analizi",
  imported: "İçe Aktarılan",
};

export function getSidebarBadgeClass(isActive: boolean): string {
  return isActive
    ? "border-white/25 bg-white/20 text-current"
    : "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/15 dark:text-amber-100";
}

export const SIDEBAR_ITEM_BASE =
  "flex w-full items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-left text-sm transition";

export const SIDEBAR_ITEM_ACTIVE =
  "border-amber-300 bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200 text-amber-950 shadow-[0_16px_34px_rgba(217,119,6,0.18)] dark:border-amber-300/40 dark:from-amber-500/25 dark:via-yellow-500/20 dark:to-orange-500/20 dark:text-amber-100";

export const SIDEBAR_ITEM_INACTIVE =
  "border-amber-200/60 bg-amber-50/70 text-amber-900 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-400/15 dark:bg-amber-400/10 dark:text-amber-100 dark:hover:bg-amber-400/15";
