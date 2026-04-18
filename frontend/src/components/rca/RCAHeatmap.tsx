"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { R2D_DIMENSIONS, DIMENSION_META, SOURCE_COLORS } from "@/lib/r2d-rca-engine";

interface RCAHeatmapProps {
  t0: number[];
  t1: number[];
  deltaHat: number[];
}

function num(n: number): string {
  return n.toFixed(3);
}

/** Risk skalasına göre renk (hem t0 hem t1 için) */
function riskCellStyle(value: number): { bg: string; fg: string; darkBg: string; darkFg: string } {
  if (value <= 0.2) return { bg: "#E1F5EE", fg: "#085041", darkBg: "rgba(5,80,65,0.25)", darkFg: "#6ee7b7" };
  if (value <= 0.4) return { bg: "#EAF3DE", fg: "#27500A", darkBg: "rgba(39,80,10,0.3)", darkFg: "#bef264" };
  if (value <= 0.6) return { bg: "#FAEEDA", fg: "#854F0B", darkBg: "rgba(133,79,11,0.35)", darkFg: "#fcd34d" };
  if (value <= 0.8) return { bg: "#FAECE7", fg: "#712B13", darkBg: "rgba(113,43,19,0.35)", darkFg: "#fdba74" };
  return { bg: "#FCEBEB", fg: "#791F1F", darkBg: "rgba(121,31,31,0.35)", darkFg: "#fca5a5" };
}

/** Delta skalasına göre renk (sadece artış) */
function deltaCellStyle(delta: number): { bg: string; fg: string; darkBg: string; darkFg: string } | null {
  if (delta === 0) return null;
  return riskCellStyle(delta);
}

export function RCAHeatmap({ t0, t1, deltaHat }: RCAHeatmapProps) {
  return (
    <Card aria-label="9 boyut ısı haritası — t₀ / t₁ / Delta">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Boyut Bazlı Isı Haritası</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="min-w-[180px] border border-border bg-muted/50 px-3 py-2 text-left font-semibold text-foreground">Boyut</th>
              <th className="min-w-[110px] border border-border bg-muted/50 px-3 py-2 text-center font-semibold text-foreground">t₀ (öncesi)</th>
              <th className="min-w-[110px] border border-border bg-muted/50 px-3 py-2 text-center font-semibold text-foreground">t₁ (sonrası)</th>
              <th className="min-w-[110px] border border-border bg-muted/50 px-3 py-2 text-center font-semibold text-foreground">Δ̂ (Artış)</th>
            </tr>
          </thead>
          <tbody>
            {R2D_DIMENSIONS.map((code, i) => {
              const meta = DIMENSION_META[code];
              const v0 = t0[i] ?? 0;
              const v1 = t1[i] ?? 0;
              const d = deltaHat[i] ?? 0;
              const s0 = riskCellStyle(v0);
              const s1 = riskCellStyle(v1);
              const sd = deltaCellStyle(d);
              const srcC = SOURCE_COLORS[meta.sourceType];
              return (
                <tr key={code}>
                  <td className="border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 font-mono text-xs font-bold text-foreground">{code}</span>
                      <span className="truncate text-xs text-foreground">{meta.nameTR}</span>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium"
                        style={{ background: srcC.bg, color: srcC.fg }}
                      >
                        {meta.sourceType}
                      </span>
                    </div>
                  </td>
                  <td className="border border-border text-center" style={{ background: s0.bg, color: s0.fg }}>
                    <div className="relative py-2">
                      <div className="absolute inset-0" style={{ background: `linear-gradient(to right, rgba(0,0,0,0.08) ${v0 * 100}%, transparent ${v0 * 100}%)` }} />
                      <span className="relative font-mono font-bold">{num(v0)}</span>
                    </div>
                  </td>
                  <td className="border border-border text-center" style={{ background: s1.bg, color: s1.fg }}>
                    <div className="relative py-2">
                      <div className="absolute inset-0" style={{ background: `linear-gradient(to right, rgba(0,0,0,0.08) ${v1 * 100}%, transparent ${v1 * 100}%)` }} />
                      <span className="relative font-mono font-bold">{num(v1)}</span>
                    </div>
                  </td>
                  <td className="border border-border text-center" style={sd ? { background: sd.bg, color: sd.fg } : { background: "transparent" }}>
                    <div className="relative py-2">
                      {sd && (
                        <div className="absolute inset-0" style={{ background: `linear-gradient(to right, rgba(0,0,0,0.08) ${d * 100}%, transparent ${d * 100}%)` }} />
                      )}
                      <span className="relative font-mono font-bold">{d === 0 ? <span className="text-muted-foreground">—</span> : num(d)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
