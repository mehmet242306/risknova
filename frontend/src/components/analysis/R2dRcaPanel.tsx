"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Sparkles, Save, Loader2, CheckCircle2, XCircle, Download, Share2,
  AlertTriangle, ShieldAlert, TrendingUp, GaugeCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  computeR2DRCA, DEMO_T0, DEMO_T1,
  R2D_DIMENSIONS, DIMENSION_META, SOURCE_COLORS,
} from "@/lib/r2d-rca-engine";
import { exportR2dRcaPdf, exportR2dRcaPdfBlob } from "@/lib/r2d-rca-pdf-template";
import { shareOrDownloadPdf } from "@/lib/pdf-generator";
import type { R2dRcaData } from "@/lib/analysis/types";
import { RCAGauge } from "@/components/rca/RCAGauge";
import { RCADeltaBarChart } from "@/components/rca/RCADeltaBarChart";
import { RCARadarChart } from "@/components/rca/RCARadarChart";
import { RCADoughnutChart } from "@/components/rca/RCADoughnutChart";
import { RCAHeatmap } from "@/components/rca/RCAHeatmap";
import { RCAWaterfallChart } from "@/components/rca/RCAWaterfallChart";
import { RCAPolarChart } from "@/components/rca/RCAPolarChart";
import { RCADeltaRadar } from "@/components/rca/RCADeltaRadar";
import { RCARootCauseChain } from "@/components/rca/RCARootCauseChain";
import { RCAMetricCards } from "@/components/rca/RCAMetricCards";
import { RCAStatusCards } from "@/components/rca/RCAStatusCards";
import type { PdfReportMeta } from "@/lib/pdf-shared-template";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface R2dRcaPanelProps {
  incidentTitle: string;
  initialData?: R2dRcaData | null;
  onSave: (data: R2dRcaData) => void;
  onAiRequest: () => Promise<{ t0?: number[]; t1?: number[]; narrative?: string }>;
  /** Opsiyonel — PDF için zengin meta (firma, lokasyon, hazırlayan, paylaşım URL, QR) */
  pdfMeta?: Omit<PdfReportMeta, "reportTitle" | "reportSubtitle" | "incidentTitle"> | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function num(n: number): string {
  return n.toFixed(3);
}

export function R2dRcaPanel({ incidentTitle, initialData, onSave, onAiRequest, pdfMeta }: R2dRcaPanelProps) {
  const [t0, setT0] = useState<number[]>(initialData?.t0 && initialData.t0.length === 9 ? initialData.t0 : Array(9).fill(0.2));
  const [t1, setT1] = useState<number[]>(initialData?.t1 && initialData.t1.length === 9 ? initialData.t1 : Array(9).fill(0.2));
  const [narrative, setNarrative] = useState<string>(initialData?.narrative ?? "");
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"shared" | "downloaded" | null>(null);

  const result = useMemo(() => computeR2DRCA(t0, t1), [t0, t1]);
  const isDefault = t0.every((v) => v === 0.2) && t1.every((v) => v === 0.2);

  // ── Auto-sync: t0/t1/narrative değişince wizard'a debounced yay  ──
  // Böylece AI skor + slider değişimleri + manuel narrative düzenlemeleri
  // wizard state'ine otomatik gider → PDF Paylaş butonu güncel veriyi alır.
  const isFirstRenderRef = useRef(true);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const timeoutId = setTimeout(() => {
      onSaveRef.current({ t0, t1, narrative });
    }, 400); // 400ms debounce — slider hareketleri için daha uzun
    return () => clearTimeout(timeoutId);
  }, [t0, t1, narrative]);

  const handleAiRequest = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const aiResult = await onAiRequest();
      if (Array.isArray(aiResult?.t0) && aiResult.t0.length === 9) setT0(aiResult.t0);
      if (Array.isArray(aiResult?.t1) && aiResult.t1.length === 9) setT1(aiResult.t1);
      if (aiResult?.narrative) setNarrative(aiResult.narrative);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI hatası");
    } finally {
      setAiLoading(false);
    }
  }, [onAiRequest]);

  const handleSave = useCallback(async () => {
    setSaveLoading(true);
    try {
      onSave({ t0, t1, narrative });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } finally {
      setSaveLoading(false);
    }
  }, [onSave, t0, t1, narrative]);

  function loadExample() {
    setT0(DEMO_T0);
    setT1(DEMO_T1);
  }

  /**
   * Paylaş — PDF üretir, native share ile paylaşır (mobile WhatsApp/Mail/AirDrop),
   * desteklenmiyorsa indirir. Sayfa URL'si DEĞİL, **PDF dosyası** paylaşılır.
   */
  const handleShare = useCallback(async () => {
    setShareBusy(true);
    setShareFeedback(null);
    setAiError(null);
    try {
      const fallbackUrl = typeof window !== "undefined" ? window.location.href : null;
      const blob = await exportR2dRcaPdfBlob(
        { t0, t1, narrative },
        {
          ...(pdfMeta ?? {}),
          shareUrl: pdfMeta?.shareUrl ?? fallbackUrl,
          incidentTitle,
        },
      );
      const safeTitle = (incidentTitle || "r2d-rca-rapor").replace(/[^a-z0-9-_]/gi, "_").slice(0, 60);
      const fileName = `${safeTitle || "r2d-rca-rapor"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const result = await shareOrDownloadPdf(
        blob,
        fileName,
        "R₂D-RCA Analiz Raporu",
        {
          shareText: incidentTitle ? `R₂D-RCA analizi: ${incidentTitle}` : "R₂D-RCA Analiz Raporu",
          shareUrl: pdfMeta?.shareUrl ?? fallbackUrl ?? undefined,
        },
      );
      if (result === "shared") setShareFeedback("shared");
      else if (result === "downloaded") setShareFeedback("downloaded");
      // Feedback'i 3 sn sonra temizle
      setTimeout(() => setShareFeedback(null), 3000);
    } catch (e) {
      console.error("handleShare:", e);
      setAiError(e instanceof Error ? e.message : "PDF üretilemedi");
    } finally {
      setShareBusy(false);
    }
  }, [t0, t1, narrative, pdfMeta, incidentTitle]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header — AI butonu her zaman burada görünür, scroll'a bağlı değil */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#e05a7a]/15">
                <Activity className="size-5 text-[#e05a7a]" />
              </span>
              <div>
                <CardTitle className="text-base">R₂D-RCA (C1-C9)</CardTitle>
                <CardDescription>9 boyutlu kompozit risk metriği · delta-tabanlı sayısal kök neden analizi</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warning">Sürekli Skala [0,1]</Badge>
              <Button
                variant="accent"
                size="sm"
                onClick={handleAiRequest}
                disabled={aiLoading}
                aria-label="AI ile analiz yap"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiLoading ? "AI skor üretiyor..." : "AI ile Analiz Yap"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isDefault && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#e05a7a]/30 bg-[#e05a7a]/10 px-4 py-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[#e05a7a]" />
          <div className="text-sm text-[#e05a7a]">
            <p className="font-semibold">Önce AI ile skorları oluşturun</p>
            <p className="text-xs opacity-80">Olay açıklamasına göre AI 9 boyut için t₀ ve t₁ skorlarını üretir. Dilerseniz manuel de ayarlayabilirsiniz.</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadExample} className="ml-auto shrink-0">Ornek Veri</Button>
        </div>
      )}

      {/* Score inputs — 9 satır */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">C1-C9 Skor Karşılaştırması</CardTitle>
          <CardDescription>Her boyut için olay öncesi (t₀) ve olay anı (t₁) skorları. Slider ile manuel ayarla veya AI'dan üret.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {R2D_DIMENSIONS.map((code, i) => {
            const meta = DIMENSION_META[code];
            const srcColor = SOURCE_COLORS[meta.sourceType];
            const delta = Math.max(0, t1[i] - t0[i]);
            return (
              <div key={code} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{code}</span>
                    <span className="text-sm font-medium text-foreground">{meta.nameTR}</span>
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-medium" style={{ background: srcColor.bg, color: srcColor.fg }}>
                      {meta.source}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">w = {meta.weight.toFixed(3)}</span>
                </div>
                <div className="grid grid-cols-[40px_1fr_60px] items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">t₀</span>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={t0[i]}
                    onChange={(e) => { const arr = [...t0]; arr[i] = Number(e.target.value); setT0(arr); }}
                    className="w-full accent-indigo-600"
                  />
                  <span className="text-right font-mono text-xs font-bold text-foreground">{num(t0[i])}</span>
                </div>
                <div className="mt-1 grid grid-cols-[40px_1fr_60px] items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">t₁</span>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={t1[i]}
                    onChange={(e) => { const arr = [...t1]; arr[i] = Number(e.target.value); setT1(arr); }}
                    className="w-full accent-orange-600"
                  />
                  <span className="text-right font-mono text-xs font-bold text-foreground">{num(t1[i])}</span>
                </div>
                {delta > 0 && (
                  <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px]">
                    <span className="text-muted-foreground">Δ̂:</span>
                    <span className={`font-mono font-bold ${delta >= 0.4 ? "text-red-600" : delta >= 0.15 ? "text-orange-600" : "text-amber-600"}`}>
                      {num(delta)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Canlı Önizleme</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={result.overrideTriggered ? "danger" : "warning"}>
                {result.calculationMode === "override" ? "Override" : "Base Score"}
              </Badge>
              <span className={`font-mono text-xl font-bold ${result.rRcaScore >= 0.6 ? "text-red-600" : result.rRcaScore >= 0.4 ? "text-orange-600" : result.rRcaScore >= 0.2 ? "text-amber-600" : "text-emerald-600"}`}>
                {num(result.rRcaScore)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max Δ̂</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                C{result.maxDeltaHatIndex + 1} · {num(result.maxDeltaHat)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bozulan / Stabil</div>
              <div className="mt-1 font-mono text-sm font-bold text-foreground">
                {result.bozulanCount} / {result.stabilCount}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Stabilite</div>
              <div className="mt-1 text-sm font-bold text-foreground">
                {result.isStable ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="size-3" /> Stabil</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600"><XCircle className="size-3" /> Dual Reporting</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* DUAL REPORTING UYARISI (max Δ̂ ≠ max weighted)                */}
      {/* ============================================================ */}
      {result.dualReportingRequired && !isDefault && (
        <Card className="border-2 border-amber-500/50">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" />
            <div className="flex-1 text-sm">
              <strong className="text-amber-700 dark:text-amber-400">⚠ Dual Reporting Gerekli</strong>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                En büyük Δ̂ boyutu (<strong>C{result.maxDeltaHatIndex + 1}</strong>) ile en yüksek ağırlıklı boyut (<strong>C{result.maxWeightedIndex + 1}</strong>) farklı.
                Stabilite teoremi bozuldu — rapor hem override modu hem base score modunu içermeli.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* ÜST DÜZEY ÖZET — MetricCards + StatusCards                   */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GaugeCircle className="size-4 text-[#e05a7a]" />
            Üst Düzey Özet
          </CardTitle>
          <CardDescription>Skor · En büyük sapma · Teorem durumu · Override</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RCAMetricCards result={result} />
          <div className="grid gap-3 lg:grid-cols-3">
            <RCAGauge score={result.rRcaScore} />
            <RCAStatusCards
              overrideActive={result.overrideTriggered}
              bozulanCount={result.bozulanCount}
              stabilCount={result.stabilCount}
            />
            <RCADeltaRadar deltaHat={result.deltaHat} />
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* RADAR + KÖK NEDEN ZİNCİRİ                                    */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4 text-[#D85A30]" />
            9 Boyutlu Risk Profili + Kök Neden Zinciri
          </CardTitle>
          <CardDescription>Olay öncesi (t₀) ile olay anı (t₁) karşılaştırması + öncelik sıralaması</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-2">
            <RCARadarChart t0={t0} t1={t1} />
            <RCARootCauseChain categorized={result.categorized} />
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* BOYUT DETAYI — Heatmap + DeltaBar + Priority (Donut + Polar) */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="size-4 text-[#1E2761]" />
            Boyut Detayı ve Priority Dağılımı
          </CardTitle>
          <CardDescription>9 boyut ısı haritası · sapma şiddeti (Δ̂) · priority katkı · waterfall</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RCAHeatmap t0={t0} t1={t1} deltaHat={result.deltaHat} />
          <RCADeltaBarChart deltaHat={result.deltaHat} />
          <div className="grid gap-3 lg:grid-cols-2">
            <RCADoughnutChart priorityRanking={result.priorityRanking} />
            <RCAPolarChart priorityRanking={result.priorityRanking} />
          </div>
          <RCAWaterfallChart priorityRanking={result.priorityRanking} rRcaScore={result.rRcaScore} />
        </CardContent>
      </Card>

      {/* AI Narrative */}
      {narrative && (
        <Card className="border-l-4 border-l-[#e05a7a]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-[#e05a7a]" />
              AI Değerlendirmesi
            </CardTitle>
            <CardDescription>RiskNova AI tarafından üretildi · uzman kontrolü zorunlu</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-foreground">{narrative}</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {aiError && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <XCircle className="size-4 shrink-0" /> {aiError}
        </div>
      )}

      {/* Actions — PDF / Kaydet / (yedek) AI butonu */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="accent" size="md" onClick={handleAiRequest} disabled={aiLoading}>
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {aiLoading ? "AI skor üretiyor..." : "AI ile Skor Oluştur"}
        </Button>

        <div className="flex-1" />

        <Button
          variant={shareFeedback ? "accent" : "outline"}
          size="md"
          onClick={() => void handleShare()}
          disabled={shareBusy}
          aria-label="PDF olarak paylaş"
          title="PDF üretip cihazın paylaşım menüsünden gönder (WhatsApp, Mail, AirDrop vb.)"
        >
          {shareBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          {shareBusy
            ? "PDF hazırlanıyor..."
            : shareFeedback === "shared"
              ? "Paylaşıldı"
              : shareFeedback === "downloaded"
                ? "İndirildi"
                : "PDF Paylaş"}
        </Button>

        <Button
          variant="outline"
          size="md"
          onClick={() => {
            const fallbackUrl = typeof window !== "undefined" ? window.location.href : null;
            void exportR2dRcaPdf(
              { t0, t1, narrative },
              {
                ...(pdfMeta ?? {}),
                shareUrl: pdfMeta?.shareUrl ?? fallbackUrl,
                incidentTitle,
              },
            );
          }}
          title={isDefault ? "Uyarı: Henüz AI skorlama yapılmadı — PDF boş grafiklerle oluşturulur" : "PDF rapor indir"}
        >
          <Download className="h-4 w-4" /> PDF
        </Button>

        <Button
          variant={savedFeedback ? "accent" : "primary"}
          size="md"
          onClick={handleSave}
          disabled={saveLoading}
        >
          {saveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : savedFeedback ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {savedFeedback ? "Kaydedildi" : "Kaydet"}
        </Button>
      </div>

    </div>
  );
}
