"use client";

import { Gauge, TrendingUp, Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DIMENSION_META, type RCAResult } from "@/lib/r2d-rca-engine";

interface RCAMetricCardsProps {
  result: RCAResult;
}

function num(n: number): string {
  return n.toFixed(3);
}

function getScoreColor(score: number): string {
  if (score >= 0.6) return "text-red-600 dark:text-red-400";
  if (score >= 0.4) return "text-orange-600 dark:text-orange-400";
  if (score >= 0.2) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

export function RCAMetricCards({ result }: RCAMetricCardsProps) {
  const maxDim = DIMENSION_META[`C${result.maxDeltaHatIndex + 1}` as keyof typeof DIMENSION_META];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {/* R₂D-RCA Skoru */}
      <Card aria-label="R₂D-RCA skoru kartı">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">R₂D-RCA Skoru</span>
            <Gauge className="size-4 text-muted-foreground" />
          </div>
          <div className={`mt-2 font-mono text-3xl font-bold ${getScoreColor(result.rRcaScore)}`}>
            {num(result.rRcaScore)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {result.calculationMode === "override" ? "Override" : "Base Score"}
          </div>
        </CardContent>
      </Card>

      {/* Max Sapma */}
      <Card aria-label="Maksimum sapma kartı">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Max Sapma</span>
            <TrendingUp className="size-4 text-muted-foreground" />
          </div>
          <div className={`mt-2 font-mono text-3xl font-bold ${getScoreColor(result.maxDeltaHat)}`}>
            {num(result.maxDeltaHat)}
          </div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {maxDim?.code} · {maxDim?.nameTR}
          </div>
        </CardContent>
      </Card>

      {/* Hesaplama Modu */}
      <Card aria-label="Hesaplama modu kartı">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mod</span>
            <Shield className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2">
            {result.overrideTriggered ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-sm font-bold text-red-600 dark:text-red-400">
                <AlertTriangle className="size-3.5" /> OVERRIDE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-300">
                BASE SCORE
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            τ = 0.40 eşiği {result.overrideTriggered ? "aşıldı" : "aşılmadı"}
          </div>
        </CardContent>
      </Card>

      {/* Teorem Durumu */}
      <Card aria-label="Stabilite teoremi kartı">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stabilite</span>
            {result.isStable ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-4 text-amber-500" />
            )}
          </div>
          <div className="mt-2">
            {result.isStable ? (
              <span className="inline-flex items-center rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                STABİL
              </span>
            ) : (
              <span className="inline-flex items-center rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-300">
                DUAL REPORTING
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {result.isStable ? "Tek kök neden" : "İki aday, manuel karar"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
