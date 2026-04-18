"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IshikawaRecord } from "@/lib/supabase/incident-api";

type CategoryKey = "man" | "machine" | "method" | "material" | "environment" | "measurement";

const categories: { key: CategoryKey; label: string; color: string; fieldA: keyof IshikawaRecord; }[] = [
  { key: "man", label: "Insan", color: "#B8860B", fieldA: "manCauses" },
  { key: "machine", label: "Makine", color: "#38BDF8", fieldA: "machineCauses" },
  { key: "method", label: "Yontem", color: "#F59E0B", fieldA: "methodCauses" },
  { key: "material", label: "Malzeme", color: "#D4A017", fieldA: "materialCauses" },
  { key: "environment", label: "Cevre", color: "#10B981", fieldA: "environmentCauses" },
  { key: "measurement", label: "Olcum", color: "#A855F7", fieldA: "measurementCauses" },
];

interface IshikawaCompareProps {
  analysisA: IshikawaRecord & { incidentCode?: string; incidentTitle?: string };
  analysisB: IshikawaRecord & { incidentCode?: string; incidentTitle?: string };
  onClose: () => void;
}

export function IshikawaCompare({ analysisA, analysisB, onClose }: IshikawaCompareProps) {
  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Analiz Karsilastirmasi</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-sm font-medium text-foreground">
            {analysisA.incidentCode || "Analiz A"}
          </div>
          <div className="text-xs text-muted-foreground">{formatDate(analysisA.createdAt)}</div>
          {analysisA.incidentTitle && (
            <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{analysisA.incidentTitle}</div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-sm font-medium text-foreground">
            {analysisB.incidentCode || "Analiz B"}
          </div>
          <div className="text-xs text-muted-foreground">{formatDate(analysisB.createdAt)}</div>
          {analysisB.incidentTitle && (
            <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{analysisB.incidentTitle}</div>
          )}
        </div>
      </div>

      {/* Category-by-category comparison */}
      {categories.map((cat) => {
        const causesA = (analysisA[cat.fieldA] as string[]) ?? [];
        const causesB = (analysisB[cat.fieldA] as string[]) ?? [];
        const maxLen = Math.max(causesA.length, causesB.length);
        if (maxLen === 0) return null;

        return (
          <div key={cat.key} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: cat.color }}>
              {cat.label}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Sol: A */}
              <div className="space-y-1" style={{ borderLeft: `3px solid ${cat.color}`, paddingLeft: 8 }}>
                {causesA.length === 0 ? (
                  <div className="text-xs italic text-muted-foreground">Neden yok</div>
                ) : causesA.map((cause, i) => {
                  const isDiff = cause !== (causesB[i] ?? "");
                  return (
                    <div key={i} className={`rounded px-2 py-1 text-xs ${isDiff ? "border border-warning/40 bg-warning/5 text-warning" : "border border-border bg-muted/30 text-foreground"}`}>
                      {cause}
                    </div>
                  );
                })}
              </div>
              {/* Sag: B */}
              <div className="space-y-1" style={{ borderLeft: `3px solid ${cat.color}`, paddingLeft: 8 }}>
                {causesB.length === 0 ? (
                  <div className="text-xs italic text-muted-foreground">Neden yok</div>
                ) : causesB.map((cause, i) => {
                  const isDiff = cause !== (causesA[i] ?? "");
                  return (
                    <div key={i} className={`rounded px-2 py-1 text-xs ${isDiff ? "border border-warning/40 bg-warning/5 text-warning" : "border border-border bg-muted/30 text-foreground"}`}>
                      {cause}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Root cause comparison */}
      {(analysisA.rootCauseConclusion || analysisB.rootCauseConclusion) && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            Kok Neden Sonucu
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-border bg-muted/30 p-2 text-xs text-foreground">
              {analysisA.rootCauseConclusion || <span className="italic text-muted-foreground">Belirtilmemis</span>}
            </div>
            <div className="rounded border border-border bg-muted/30 p-2 text-xs text-foreground">
              {analysisB.rootCauseConclusion || <span className="italic text-muted-foreground">Belirtilmemis</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
