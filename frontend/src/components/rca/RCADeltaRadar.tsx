"use client";

import { Radar } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { R2D_DIMENSIONS } from "@/lib/r2d-rca-engine";
import { registerRcaChartDependencies } from "./chart-register";

registerRcaChartDependencies();

interface RCADeltaRadarProps {
  deltaHat: number[];
}

export function RCADeltaRadar({ deltaHat }: RCADeltaRadarProps) {
  const data = {
    labels: [...R2D_DIMENSIONS],
    datasets: [
      {
        label: "Δ̂",
        data: deltaHat,
        backgroundColor: "rgba(216,90,48,0.15)",
        borderColor: "#D85A30",
        borderWidth: 2,
        pointBackgroundColor: "#D85A30",
        pointRadius: 2.5,
      },
    ],
  };

  const maxVal = Math.max(0.5, ...deltaHat);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      r: {
        min: 0,
        max: Math.min(1, Math.ceil(maxVal * 10) / 10),
        ticks: { stepSize: 0.1, display: false },
        pointLabels: { font: { size: 8 } },
        grid: { color: "rgba(156,163,175,0.2)" },
        angleLines: { color: "rgba(156,163,175,0.2)" },
      },
    },
  };

  return (
    <Card aria-label="Delta radar mini grafik">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs">Δ̂ Radar Profili</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height: 140 }}>
          <Radar data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
