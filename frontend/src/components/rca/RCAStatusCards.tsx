"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertOctagon, TrendingUp, CheckCircle2 } from "lucide-react";

interface RCAStatusCardsProps {
  overrideActive: boolean;
  bozulanCount: number;
  stabilCount: number;
}

export function RCAStatusCards({ overrideActive, bozulanCount, stabilCount }: RCAStatusCardsProps) {
  return (
    <div className="grid h-full grid-rows-3 gap-2">
      {/* Override */}
      <Card
        aria-label="Override durumu"
        className={overrideActive ? "border-red-500/40 bg-red-500/10" : "border-emerald-500/40 bg-emerald-500/10"}
      >
        <CardContent className="flex items-center gap-3 p-3">
          <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${overrideActive ? "bg-red-500" : "bg-emerald-500"}`}>
            <AlertOctagon className="size-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Override</div>
            <div className={`text-sm font-bold ${overrideActive ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {overrideActive ? "Aktif" : "Pasif"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bozulan */}
      <Card aria-label="Bozulan boyut sayısı" className="border-amber-500/40 bg-amber-500/10">
        <CardContent className="flex items-center gap-3 p-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500">
            <TrendingUp className="size-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bozulan</div>
            <div className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {bozulanCount} / 9 boyut
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stabil */}
      <Card aria-label="Stabil boyut sayısı" className="border-emerald-500/40 bg-emerald-500/10">
        <CardContent className="flex items-center gap-3 p-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500">
            <CheckCircle2 className="size-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stabil</div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {stabilCount} / 9 boyut
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
