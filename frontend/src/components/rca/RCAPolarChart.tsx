"use client";

import { PolarArea } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type PriorityItem, DIMENSION_META, TAU_PRIMARY, TAU_SECONDARY } from "@/lib/r2d-rca-engine";
import { registerRcaChartDependencies } from "./chart-register";

registerRcaChartDependencies();

interface RCAPolarChartProps {
  priorityRanking: PriorityItem[];
}

function polarColor(d: number, alpha = 0.55): string {
  // Opacity delta büyüklüğüne göre
  const a = Math.min(1, Math.max(0.35, 0.35 + d * 0.8));
  if (d >= TAU_PRIMARY) return `rgba(216,90,48,${a})`;      // override
  if (d >= TAU_SECONDARY) return `rgba(239,159,39,${a})`;   // major
  return `rgba(180,178,169,${alpha})`;                      // minor
}

export function RCAPolarChart({ priorityRanking }: RCAPolarChartProps) {
  const labels = priorityRanking.map((p) => `${p.code} ${DIMENSION_META[p.code].nameTR}`);
  const values = priorityRanking.map((p) => p.deltaHat);
  const colors = priorityRanking.map((p) => polarColor(p.deltaHat));

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: colors.map((c) => c.replace(/[\d.]+\)$/, "0.9)")),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { font: { size: 10 }, padding: 10, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: { r: number } }) => `${ctx.label}: Δ̂ = ${ctx.parsed.r.toFixed(3)}`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 1,
        ticks: { stepSize: 0.2, font: { size: 8 }, backdropColor: "transparent" },
        grid: { color: "rgba(156,163,175,0.2)" },
      },
    },
  };

  return (
    <Card aria-label="Polar alan grafiği — delta dağılımı">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Delta Polar Dağılımı</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          {priorityRanking.length > 0 ? (
            <PolarArea data={data} options={options} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Bozulan boyut yok
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
