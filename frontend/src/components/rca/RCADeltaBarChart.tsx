"use client";

import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { R2D_DIMENSIONS, DIMENSION_META, TAU_PRIMARY, TAU_SECONDARY } from "@/lib/r2d-rca-engine";
import { registerRcaChartDependencies } from "./chart-register";

registerRcaChartDependencies();

interface RCADeltaBarChartProps {
  deltaHat: number[];
}

function deltaColor(d: number): string {
  if (d >= TAU_PRIMARY) return "#D85A30";       // override
  if (d >= TAU_SECONDARY) return "#EF9F27";     // major
  if (d > 0) return "#B4B2A9";                  // minor
  return "#D3D1C7";                             // none
}

export function RCADeltaBarChart({ deltaHat }: RCADeltaBarChartProps) {
  const labels = R2D_DIMENSIONS.map((code) => `${code} ${DIMENSION_META[code].nameTR}`);
  const colors = deltaHat.map(deltaColor);

  const data = {
    labels,
    datasets: [
      {
        label: "Δ̂",
        data: deltaHat,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 0,
        borderRadius: 2,
        barThickness: 14,
      },
    ],
  };

  const maxVal = Math.max(0.5, ...deltaHat);

  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `Δ̂ = ${(ctx.parsed.x as number).toFixed(3)}`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: Math.min(1, Math.ceil(maxVal * 10) / 10),
        ticks: { font: { size: 10 }, stepSize: 0.1 },
        grid: { color: "rgba(156,163,175,0.15)" },
      },
      y: {
        ticks: { font: { size: 10 } },
        grid: { display: false },
      },
    },
  };

  return (
    <Card aria-label="Delta bar grafik — 9 boyut">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Bozulma Şiddeti (Δ̂)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <Bar data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
