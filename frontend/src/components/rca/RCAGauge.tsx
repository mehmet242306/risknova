"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RCAGaugeProps {
  score: number;               // 0..1
  label?: string;
}

const ZONES = [
  { from: 0.0, to: 0.2, color: "#639922" },   // yeşil
  { from: 0.2, to: 0.4, color: "#EF9F27" },   // sarı
  { from: 0.4, to: 0.6, color: "#D85A30" },   // turuncu
  { from: 0.6, to: 1.0, color: "#A32D2D" },   // kırmızı
];

function scoreColor(score: number): string {
  if (score >= 0.6) return "#A32D2D";
  if (score >= 0.4) return "#D85A30";
  if (score >= 0.2) return "#EF9F27";
  return "#639922";
}

export function RCAGauge({ score, label = "R₂D-RCA skoru" }: RCAGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h - 16;
    const radius = Math.min(w, h * 2) / 2 - 24;
    const thickness = 14;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Zone arcs
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    const totalAngle = endAngle - startAngle;

    ZONES.forEach((zone) => {
      const a0 = startAngle + totalAngle * zone.from;
      const a1 = startAngle + totalAngle * zone.to;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, a0, a1);
      ctx.lineWidth = thickness;
      ctx.lineCap = "round";
      ctx.strokeStyle = zone.color;
      ctx.stroke();
    });

    // Tick marks
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1.5;
    [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach((t) => {
      const ang = startAngle + totalAngle * t;
      const rOuter = radius + thickness / 2 + 3;
      const rInner = radius - thickness / 2 - 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * rInner, cy + Math.sin(ang) * rInner);
      ctx.lineTo(cx + Math.cos(ang) * rOuter, cy + Math.sin(ang) * rOuter);
      ctx.stroke();
    });

    // Needle
    const clampedScore = Math.max(0, Math.min(1, score));
    const needleAngle = startAngle + totalAngle * clampedScore;
    const needleLen = radius - 4;

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = "#1f2937";
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [score]);

  return (
    <Card aria-label={`${label}: ${score.toFixed(3)}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative" style={{ height: 140 }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
        </div>
        <div className="mt-2 text-center">
          <div className="font-mono text-3xl font-bold" style={{ color: scoreColor(score) }}>
            {score.toFixed(3)}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {score >= 0.6 ? "Kritik" : score >= 0.4 ? "Yüksek" : score >= 0.2 ? "Orta" : "Düşük"} risk
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
