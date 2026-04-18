"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Building2,
  Sparkles,
  Plus,
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  Eye,
  ShieldAlert,
  Settings2,
  Lightbulb,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { exportPanelPdf } from "@/lib/export-panel-pdf";
import type { MortData } from "@/lib/analysis/types";
import { renderEtbTraceSvg, renderMortTreeSvg } from "@/lib/mort-pdf-template";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MortPanelProps {
  incidentTitle: string;
  initialData?: MortData | null;
  onSave: (data: MortData) => void;
  onAiRequest: () => Promise<MortData>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function defaultData(): MortData {
  return {
    topEvent: "",
    sections: {
      whatHappened: "",
      supervisoryControl: [],
      managementSystem: [],
      lessonsLearned: [],
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Editable List sub-component                                        */
/* ------------------------------------------------------------------ */

interface EditableListProps {
  items: string[];
  onUpdate: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
}

function EditableList({
  items,
  onUpdate,
  placeholder,
  addLabel,
}: EditableListProps) {
  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onUpdate(next);
  };

  const removeItem = (index: number) => {
    onUpdate(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onUpdate([...items, ""]);
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
            {index + 1}
          </div>
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            placeholder={placeholder}
            className="h-10 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_var(--ring)]"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeItem(index)}
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {items.length === 0 && (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Henuz oge eklenmedi.
        </p>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={addItem}
        className="self-start"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section config                                                     */
/* ------------------------------------------------------------------ */

interface SectionConfig {
  key: "whatHappened" | "supervisoryControl" | "managementSystem" | "lessonsLearned";
  title: string;
  description: string;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  type: "textarea" | "list";
  placeholder: string;
  addLabel: string;
}

const SECTIONS: SectionConfig[] = [
  {
    key: "whatHappened",
    title: "Ne Oldu?",
    description: "Olayin detayli aciklamasi. Kronolojik sirayla anlatiniz.",
    borderColor: "border-l-purple-500",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    icon: <Eye className="h-5 w-5" />,
    type: "textarea",
    placeholder: "Olayin detayli aciklamasini yazin...",
    addLabel: "",
  },
  {
    key: "supervisoryControl",
    title: "Denetim Kontrol Eksiklikleri",
    description: "Denetim ve gozetim sureclerindeki yetersizlikler.",
    borderColor: "border-l-red-500",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-500",
    icon: <ShieldAlert className="h-5 w-5" />,
    type: "list",
    placeholder: "Denetim eksikligi",
    addLabel: "Eksiklik Ekle",
  },
  {
    key: "managementSystem",
    title: "Yonetim Sistemi Sorunlari",
    description: "Organizasyonel ve yonetimsel eksiklikler.",
    borderColor: "border-l-orange-500",
    iconBg: "bg-orange-500/10",
    iconColor: "text-orange-500",
    icon: <Settings2 className="h-5 w-5" />,
    type: "list",
    placeholder: "Yonetim sistemi sorunu",
    addLabel: "Sorun Ekle",
  },
  {
    key: "lessonsLearned",
    title: "Alinan Dersler",
    description: "Olaydan cikarilan dersler ve iyilestirme onerileri.",
    borderColor: "border-l-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    icon: <Lightbulb className="h-5 w-5" />,
    type: "list",
    placeholder: "Alinan ders",
    addLabel: "Ders Ekle",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MortPanel({
  incidentTitle,
  initialData,
  onSave,
  onAiRequest,
}: MortPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MortData>(
    initialData ?? defaultData(),
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // ── Otomatik sync: local `data` değişince wizard'a yay (debounced)  ──
  // Böylece AI yanıtı + manuel değişiklikler wizard state'ine gider →
  // PDF Paylaş butonu güncel veriyi alır.
  const isFirstRender = useRef(true);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timeoutId = setTimeout(() => {
      onSaveRef.current(data);
    }, 300); // 300ms debounce — hızlı yazmada spam yok
    return () => clearTimeout(timeoutId);
  }, [data]);

  /* ---- updaters --------------------------------------------------- */

  const updateTopEvent = useCallback((value: string) => {
    setData((prev) => ({ ...prev, topEvent: value }));
  }, []);

  const updateWhatHappened = useCallback((value: string) => {
    setData((prev) => ({
      ...prev,
      sections: { ...prev.sections, whatHappened: value },
    }));
  }, []);

  const updateList = useCallback(
    (key: "supervisoryControl" | "managementSystem" | "lessonsLearned", items: string[]) => {
      setData((prev) => ({
        ...prev,
        sections: { ...prev.sections, [key]: items },
      }));
    },
    [],
  );

  /* ---- AI --------------------------------------------------------- */

  const handleAiRequest = useCallback(async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const result = await onAiRequest();
      setData(result);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "AI istegi basarisiz oldu",
      );
    } finally {
      setAiLoading(false);
    }
  }, [onAiRequest]);

  /* ---- save ------------------------------------------------------- */

  const handleSave = useCallback(async () => {
    setSaveLoading(true);
    try {
      await onSave(data);
    } finally {
      setSaveLoading(false);
    }
  }, [data, onSave]);

  /* ---- stats ------------------------------------------------------ */

  const totalItems =
    (data.sections.whatHappened ? 1 : 0) +
    data.sections.supervisoryControl.length +
    data.sections.managementSystem.length +
    data.sections.lessonsLearned.length;

  const hasContent = data.topEvent.trim().length > 0 || totalItems > 0;

  /* ---- render ----------------------------------------------------- */

  return (
    <div ref={panelRef} className="flex flex-col gap-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <Building2 className="h-5 w-5 text-violet-500" />
            </div>
            <div className="flex-1">
              <CardTitle>MORT Analizi</CardTitle>
              <CardDescription className="mt-1">
                {incidentTitle}
              </CardDescription>
            </div>
            <Badge variant="default">{totalItems} oge</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Top Event */}
      <Card>
        <CardContent className="pt-5">
          <Input
            label="Ust Olay (Top Event)"
            value={data.topEvent}
            onChange={(e) => updateTopEvent(e.target.value)}
            placeholder="Ornegin: Is kazasi meydana geldi"
          />
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Durum Özeti — LTA Değerlendirme İstatistiği                  */}
      {/* ============================================================ */}
      {(() => {
        const allBarriers = [
          ...(data.sa1Barriers ?? []),
          ...(data.sa2Barriers ?? []),
          ...(data.sa3Barriers ?? []),
        ];
        const mgmtValues = Object.values(data.mortMgmtFactors ?? {});
        const totalAdequate = allBarriers.filter((b) => b.status === "adequate").length
          + mgmtValues.filter((s) => s === "adequate").length;
        const totalLta = allBarriers.filter((b) => b.status === "lta").length
          + mgmtValues.filter((s) => s === "lta").length;
        const totalNotAssessed = allBarriers.filter((b) => b.status === "not_assessed").length
          + mgmtValues.filter((s) => s === "not_assessed" || !s).length
          + Math.max(0, 7 - mgmtValues.length); // eksik faktörler
        const totalChecked = totalAdequate + totalLta + totalNotAssessed;
        if (totalChecked === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Durum Özeti</CardTitle>
              <CardDescription>
                Tüm bariyerler ve yönetim faktörlerinin LTA değerlendirme dağılımı
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl border-l-4 border-l-green-500 bg-green-50 p-4 dark:bg-green-900/20">
                  <span className="text-3xl font-bold text-green-700 dark:text-green-400">✓</span>
                  <div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">{totalAdequate}</div>
                    <div className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Yeterli</strong> · Çalışan bariyer/kontrol
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-900/20">
                  <span className="text-3xl font-bold text-red-700 dark:text-red-400">✗</span>
                  <div>
                    <div className="text-2xl font-bold text-red-700 dark:text-red-400">{totalLta}</div>
                    <div className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Yetersiz (LTA)</strong> · Düzeltme gerekli
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border-l-4 border-l-amber-500 bg-amber-50 p-4 dark:bg-amber-900/20">
                  <span className="text-3xl font-bold text-amber-700 dark:text-amber-400">?</span>
                  <div>
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{totalNotAssessed}</div>
                    <div className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Değerlendirilmedi</strong> · Uzman incelemesi gereken
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Yorum:</strong> Profesyonel MORT analizinde üç durum da önemlidir.{" "}
                <strong className="text-green-700 dark:text-green-400">Yeterli</strong> olanlar sistemin çalışan güçlü yönleridir ve korunmalıdır.{" "}
                <strong className="text-red-700 dark:text-red-400">LTA</strong> olanlar aksiyon gerektiren zayıflıklardır.{" "}
                <strong className="text-amber-700 dark:text-amber-400">Değerlendirilmedi</strong> işaretliler yetkili İSG uzmanının manuel incelemesiyle sonuçlandırılmalıdır.
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ============================================================ */}
      {/* MORT GÖRSEL DİYAGRAMLAR — PDF ile aynı kaynak (DRY)          */}
      {/* ETB Trace + MORT Tree (S/M dalları, LTA renk kodlu)          */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Enerji-Hedef-Bariyer (ETB) Akışı</CardTitle>
          <CardDescription>
            Enerji kaynağından hedefe akış ve aradaki bariyerlerin LTA durumu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-xl border border-border bg-white p-3 dark:bg-zinc-50"
            dangerouslySetInnerHTML={{ __html: renderEtbTraceSvg(data) }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">MORT Ağacı (Yönetim Gözetim Risk Ağacı)</CardTitle>
          <CardDescription>
            S dalı (spesifik kontrol faktörleri) + M dalı (yönetim sistemi faktörleri) — LTA durumlarıyla
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-xl border border-border bg-white p-3 dark:bg-zinc-50 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: renderMortTreeSvg(data) }}
          />
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SA1/SA2/SA3 Bariyer Değerlendirmesi                          */}
      {/* ============================================================ */}
      {((data.sa1Barriers?.length ?? 0) + (data.sa2Barriers?.length ?? 0) + (data.sa3Barriers?.length ?? 0)) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Spesifik Kontrol Bariyerleri (SA1 · SA2 · SA3)</CardTitle>
            <CardDescription>Her bariyerin LTA (Less Than Adequate) değerlendirmesi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["sa1", "sa2", "sa3"] as const).map((key) => {
              const items =
                key === "sa1" ? data.sa1Barriers
                : key === "sa2" ? data.sa2Barriers
                : data.sa3Barriers;
              const titles = {
                sa1: "SA1 — Enerji Kontrolü Bariyerleri",
                sa2: "SA2 — Hedef Koruma Bariyerleri",
                sa3: "SA3 — Genel Bariyer/Kontroller",
              };
              const colors = {
                sa1: "border-red-500 bg-red-500/5",
                sa2: "border-orange-500 bg-orange-500/5",
                sa3: "border-violet-500 bg-violet-500/5",
              };
              if (!items || items.length === 0) return null;
              return (
                <div key={key} className={`rounded-lg border-l-4 p-3 ${colors[key]}`}>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground">{titles[key]}</h4>
                  <div className="space-y-2">
                    {items.map((b, i) => {
                      const statusMeta = b.status === "adequate"
                        ? { label: "✓ Yeterli", cls: "bg-green-100 text-green-800 border-green-300" }
                        : b.status === "lta"
                          ? { label: "✗ Yetersiz (LTA)", cls: "bg-red-100 text-red-800 border-red-300" }
                          : { label: "? Değerlendirilmedi", cls: "bg-amber-100 text-amber-800 border-amber-300" };
                      return (
                        <div key={i} className="flex flex-wrap items-start gap-2 rounded-md bg-card p-2 text-xs">
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground">{b.label}</div>
                            {b.notes && <div className="mt-0.5 text-[11px] text-muted-foreground">{b.notes}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Yönetim Faktörleri Matrisi (7 faktör)                        */}
      {/* ============================================================ */}
      {data.mortMgmtFactors && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Yönetim Sistemi Faktörleri (LTA Matrisi)</CardTitle>
            <CardDescription>7 yönetim faktörünün her birinin yeterlilik değerlendirmesi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries({
                policy: { label: "Politika", desc: "İSG politikası, prosedürler" },
                implementation: { label: "Uygulama", desc: "Sahada uygulama" },
                riskAssessment: { label: "Risk Değerlendirme", desc: "Risk analizi yapılmış mı?" },
                resources: { label: "Kaynaklar", desc: "Bütçe, personel, ekipman" },
                communication: { label: "İletişim", desc: "Bilgi akışı, raporlama" },
                training: { label: "Eğitim", desc: "Eğitim programı, sertifika" },
                monitoring: { label: "İzleme/Denetim", desc: "Denetim, KPI takibi" },
              }).map(([key, info]) => {
                const status = (data.mortMgmtFactors as Record<string, string | undefined>)?.[key] ?? "not_assessed";
                const meta = status === "adequate"
                  ? { icon: "✓", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-300" }
                  : status === "lta"
                    ? { icon: "✗", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-300" }
                    : { icon: "?", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-300" };
                return (
                  <div key={key} className={`rounded-lg border ${meta.border} ${meta.bg} p-3`}>
                    <div className="flex items-start gap-2">
                      <span className={`text-2xl font-bold leading-none ${meta.color}`}>{meta.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground">{info.label}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{info.desc}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Olay Zinciri                                                  */}
      {/* ============================================================ */}
      {(data.eventSequence?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Olay Zinciri (Event Sequence)</CardTitle>
            <CardDescription>Kronolojik olay akışı</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {(data.eventSequence ?? []).map((step, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border-l-4 border-l-violet-500 bg-violet-500/5 p-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">{i + 1}</span>
                  <span className="flex-1 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Değişim Analizi                                              */}
      {/* ============================================================ */}
      {data.changeAnalysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Değişim Analizi (Change Analysis)</CardTitle>
            <CardDescription>Olay öncesi ile karşılaştırma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { key: "whatChanged", label: "Ne Değişti?", icon: "▶" },
                { key: "whyChanged", label: "Neden Değişti?", icon: "▶" },
                { key: "effectOfChange", label: "Etkisi Ne Oldu?", icon: "▶" },
              ].map((item) => {
                const value = (data.changeAnalysis as Record<string, string | undefined>)?.[item.key];
                return (
                  <div key={item.key} className="rounded-lg border-l-4 border-l-amber-500 bg-amber-50 p-3 dark:bg-amber-900/20">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      {item.icon} {item.label}
                    </div>
                    <div className="text-sm leading-relaxed text-foreground">{value || "—"}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Birincil Kök Neden                                            */}
      {/* ============================================================ */}
      {data.primaryRootCause && (
        <Card className="border-2 border-red-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <ShieldAlert className="size-4" /> ★ Birincil Kök Neden
            </CardTitle>
            <CardDescription>MORT metoduna göre sistemik kök neden tespiti</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border-l-4 border-l-red-500 bg-red-50 p-4 text-sm font-semibold leading-relaxed text-red-900 dark:bg-red-900/20 dark:text-red-200">
              {data.primaryRootCause}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Öneriler                                                      */}
      {/* ============================================================ */}
      {(data.recommendations?.length ?? 0) > 0 && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Lightbulb className="size-4" /> Öneri Eylemler (SMART)
            </CardTitle>
            <CardDescription>Sistemik iyileştirme önerileri</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {(data.recommendations ?? []).map((rec, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg bg-green-50 p-3 text-sm dark:bg-green-900/20">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">{i + 1}</span>
                  <span className="flex-1 leading-relaxed">{rec}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Four Sections */}
      {SECTIONS.map((section) => (
        <Card key={section.key} className={`border-l-4 ${section.borderColor}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${section.iconBg} ${section.iconColor}`}>
                {section.icon}
              </div>
              <div>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {section.type === "textarea" ? (
              <Textarea
                value={data.sections.whatHappened}
                onChange={(e) => updateWhatHappened(e.target.value)}
                placeholder={section.placeholder}
                rows={4}
              />
            ) : (
              <EditableList
                items={
                  data.sections[
                    section.key as "supervisoryControl" | "managementSystem" | "lessonsLearned"
                  ] as string[]
                }
                onUpdate={(items) =>
                  updateList(
                    section.key as "supervisoryControl" | "managementSystem" | "lessonsLearned",
                    items,
                  )
                }
                placeholder={section.placeholder}
                addLabel={section.addLabel}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {/* AI Error */}
      {aiError && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {aiError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="accent"
          size="md"
          onClick={handleAiRequest}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {aiLoading ? "AI dusunuyor..." : "AI ile Analiz Et"}
        </Button>

        <div className="flex-1" />

        {/* Eski "PDF" (DOM screenshot) butonu kaldırıldı — yukarıdaki global PDF Aksiyon Bar kullanılıyor. */}

        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saveLoading || !hasContent}
        >
          {saveLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Kaydet
        </Button>
      </div>
    </div>
  );
}
