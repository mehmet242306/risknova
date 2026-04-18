"use client";

import { Sparkles, Download, FileText, Scale, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RCAAINarrativeProps {
  narrative: string;
  calculationMode: "override" | "base_score";
  onTechnicalAnalysis?: () => void;
  onLegalProcess?: () => void;
  onPreventionPlan?: () => void;
  onExportPdf?: () => void;
  loading?: boolean;
}

export function RCAAINarrative({
  narrative,
  calculationMode,
  onTechnicalAnalysis,
  onLegalProcess,
  onPreventionPlan,
  onExportPdf,
  loading = false,
}: RCAAINarrativeProps) {
  return (
    <Card aria-label="AI değerlendirme kartı">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--gold)]/15">
              <Sparkles className="size-4 text-[var(--gold)]" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Değerlendirmesi</h3>
              <p className="text-[10px] text-muted-foreground">Claude ile hazırlandı · RiskNova R₂D-RCA</p>
            </div>
          </div>
          <Badge variant={calculationMode === "override" ? "danger" : "warning"}>
            {calculationMode === "override" ? "Override Mod" : "Base Score Mod"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Narrative */}
        <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
          {loading ? (
            <div className="space-y-2">
              <div className="h-3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-[80%] animate-pulse rounded bg-muted" />
              <div className="h-3 w-[60%] animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <p className="text-sm leading-6 text-foreground">{narrative || "AI değerlendirmesi henüz oluşturulmadı."}</p>
          )}
        </div>

        {/* Aksiyon butonları */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button type="button" variant="outline" size="sm" onClick={onTechnicalAnalysis}>
            <FileText className="mr-1 size-3.5" /> Teknik Analiz
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onLegalProcess}>
            <Scale className="mr-1 size-3.5" /> Yasal Süreç
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onPreventionPlan}>
            <ClipboardList className="mr-1 size-3.5" /> Önlem Planı
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onExportPdf}>
            <Download className="mr-1 size-3.5" /> PDF Rapor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
