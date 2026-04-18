"use client";

import { Radar } from "react-chartjs-2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { R2D_DIMENSIONS, DIMENSION_META } from "@/lib/r2d-rca-engine";
import { registerRcaChartDependencies } from "./chart-register";

registerRcaChartDependencies();

interface RCARadarChartProps {
  t0: number[];
  t1: number[];
}

// Uzun isimleri kısalt: "C1 Tehlike Yoğunluğu" → "C1 Tehlike"
// Tam isim tooltip'te görünür, böylece bilgi kaybı yok.
function shortLabel(code: string, fullName: string): string {
  const firstWord = fullName.split(/[\s/]+/)[0] ?? "";
  // "Yük/Yorgunluk" gibi birleşik kelimelerde ilk kelime yeter
  if (firstWord.length > 10) return `${code} ${firstWord.slice(0, 10)}…`;
  return `${code} ${firstWord}`;
}

export function RCARadarChart({ t0, t1 }: RCARadarChartProps) {
  const labels = R2D_DIMENSIONS.map((code) => shortLabel(code, DIMENSION_META[code].nameTR));
  // Tooltip için tam isim saklıyoruz (Chart.js labels kısa, tooltip uzun)
  const fullLabels = R2D_DIMENSIONS.map((code) => `${code} ${DIMENSION_META[code].nameTR}`);

  const data = {
    labels,
    datasets: [
      {
        label: "Olay öncesi (t₀)",
        data: t0,
        backgroundColor: "rgba(30, 39, 97, 0.08)",
        borderColor: "rgba(30, 39, 97, 0.8)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(30, 39, 97, 0.9)",
        pointRadius: 3,
      },
      {
        label: "Olay anı (t₁)",
        data: t1,
        backgroundColor: "rgba(216, 90, 48, 0.08)",
        borderColor: "rgba(216, 90, 48, 0.8)",
        borderWidth: 2,
        borderDash: [5, 3],
        pointBackgroundColor: "rgba(216, 90, 48, 1)",
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    // Kart kenarlarına yakın label'ların taşmasını önler
    layout: { padding: { top: 10, right: 20, bottom: 10, left: 20 } },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { font: { size: 11 }, usePointStyle: true, padding: 14 },
      },
      tooltip: {
        callbacks: {
          title: (items: Array<{ dataIndex: number }>) =>
            items[0] ? fullLabels[items[0].dataIndex] : "",
          label: (ctx: { dataset: { label?: string }; parsed: { r: number } }) =>
            `${ctx.dataset.label ?? ""}: ${ctx.parsed.r.toFixed(3)}`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 1,
        ticks: { stepSize: 0.2, font: { size: 9 }, backdropColor: "transparent" },
        pointLabels: { font: { size: 9 }, padding: 2 },
        grid: { color: "rgba(156,163,175,0.25)" },
        angleLines: { color: "rgba(156,163,175,0.25)" },
      },
    },
  };

  return (
    <Card aria-label="R2D-RCA radar grafik">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">9 Boyutlu Risk Profili (t₀ vs t₁)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <Radar data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
