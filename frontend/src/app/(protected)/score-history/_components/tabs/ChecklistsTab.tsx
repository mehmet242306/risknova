"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Play, PackageOpen, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SubcategorySidebar, type SidebarItem } from "../SubcategorySidebar";
import type { SessionState, SessionActions } from "../../_hooks/useInspectionSession";
import { SOURCE_LABELS } from "../../_lib/constants";
import { seedStarterTemplates } from "@/lib/supabase/checklist-api";

type Props = {
  state: SessionState;
  actions: SessionActions;
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onStartOfficial: () => void;
  onStartPreview: () => void;
  onOpenStudio: () => void;
};

export function ChecklistsTab({
  state,
  actions,
  selectedTemplateId,
  onSelectTemplate,
  onStartOfficial,
  onStartPreview,
  onOpenStudio,
}: Props) {
  const { templates, activeTemplate, loadingTemplates, loadingActive } = state;
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const handleSeedStarter = async () => {
    setSeeding(true);
    setSeedMsg(null);
    const result = await seedStarterTemplates();
    setSeeding(false);
    if (result.skipped) {
      setSeedMsg(
        result.reason === "already_seeded"
          ? "Başlangıç paketi zaten yüklü."
          : "Başlangıç paketi yüklenemedi.",
      );
      return;
    }
    setSeedMsg(`${result.created} şablon yüklendi.`);
    await actions.refreshTemplates();
  };

  const sidebarItems = useMemo<SidebarItem[]>(
    () =>
      templates.map((t) => ({
        id: t.id,
        title: t.title,
        description: `${t.questionCount ?? 0} soru · ${SOURCE_LABELS[t.source] ?? t.source}`,
        badge:
          t.status === "draft"
            ? "Taslak"
            : t.status === "archived"
              ? "Arşiv"
              : "Yayında",
      })),
    [templates],
  );

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <SubcategorySidebar
        title="Checklistler"
        items={sidebarItems}
        activeItemId={selectedTemplateId}
        onSelect={onSelectTemplate}
        emptyLabel={
          loadingTemplates
            ? "Yükleniyor..."
            : "Henüz checklist yok. Nova ile oluşturabilir veya kütüphaneden kopyalayabilirsiniz."
        }
        footer={
          <Button variant="outline" size="sm" className="w-full" onClick={onOpenStudio}>
            <Sparkles className="mr-2 h-4 w-4" />
            Nova ile yeni checklist
          </Button>
        }
      />

      <div className="rounded-[1.5rem] border border-border bg-card p-5">
        {!activeTemplate ? (
          <EmptyState
            loading={loadingActive || loadingTemplates}
            hasTemplates={templates.length > 0}
            seeding={seeding}
            seedMessage={seedMsg}
            onSeedStarter={handleSeedStarter}
            onOpenStudio={onOpenStudio}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ClipboardCheck size={18} className="text-[var(--gold)]" />
                  <h3 className="text-lg font-semibold text-foreground">
                    {activeTemplate.title}
                  </h3>
                  <Badge variant={activeTemplate.status === "draft" ? "warning" : "success"}>
                    {activeTemplate.status === "draft" ? "Taslak" : "Yayında"}
                  </Badge>
                </div>
                {activeTemplate.description ? (
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {activeTemplate.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground">
                  <span>{activeTemplate.questions.length} soru</span>
                  <span>·</span>
                  <span>Sürüm {activeTemplate.version}</span>
                  <span>·</span>
                  <span>{SOURCE_LABELS[activeTemplate.source] ?? activeTemplate.source}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={onStartOfficial}>
                  <Play className="mr-1.5 h-4 w-4" />
                  Denetimi başlat
                </Button>
                <Button variant="outline" onClick={onStartPreview}>
                  Sanal prova
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              {activeTemplate.questions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                  Bu şablonda henüz soru yok. Nova stüdyosundan soru üretebilirsiniz.
                </p>
              ) : (
                activeTemplate.questions.slice(0, 8).map((q, index) => (
                  <div
                    key={q.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-sm",
                    )}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 text-[11px] font-semibold text-[var(--gold)]">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-foreground">{q.text}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {q.section} · {q.category}
                      </p>
                    </div>
                  </div>
                ))
              )}
              {activeTemplate.questions.length > 8 ? (
                <p className="text-center text-xs text-muted-foreground">
                  +{activeTemplate.questions.length - 8} soru daha. Tam listeyi "Aktif İnceleme" sekmesinde görün.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type EmptyStateProps = {
  loading: boolean;
  hasTemplates: boolean;
  seeding: boolean;
  seedMessage: string | null;
  onSeedStarter: () => void;
  onOpenStudio: () => void;
};

function EmptyState({
  loading,
  hasTemplates,
  seeding,
  seedMessage,
  onSeedStarter,
  onOpenStudio,
}: EmptyStateProps) {
  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
        <div className="rounded-full bg-[var(--gold)]/10 p-4">
          <ClipboardCheck size={32} className="text-[var(--gold)]" />
        </div>
        <p className="text-sm text-muted-foreground">Şablon yükleniyor...</p>
      </div>
    );
  }

  if (!hasTemplates) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
        <div className="rounded-full bg-[var(--gold)]/10 p-4">
          <PackageOpen size={32} className="text-[var(--gold)]" />
        </div>
        <p className="text-base font-semibold text-foreground">
          Organizasyonunuzda henüz checklist yok
        </p>
        <p className="max-w-lg text-sm text-muted-foreground">
          Başlangıç paketini yükleyerek 6 hazır şablonla (Ortam gözetimi, Yangın, Elektrik, KKD, Makine, Kimyasal) hemen kullanıma başlayabilir veya Nova AI ile kendi özel checklist'inizi üretebilirsiniz.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button onClick={onSeedStarter} disabled={seeding}>
            <PackageOpen className="mr-2 h-4 w-4" />
            {seeding ? "Yükleniyor..." : "Başlangıç paketini yükle"}
          </Button>
          <Button variant="outline" onClick={onOpenStudio}>
            <Sparkles className="mr-2 h-4 w-4" />
            Nova ile oluştur
          </Button>
        </div>
        {seedMessage ? (
          <p className="mt-2 text-xs text-muted-foreground">{seedMessage}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
      <div className="rounded-full bg-[var(--gold)]/10 p-4">
        <ClipboardCheck size={32} className="text-[var(--gold)]" />
      </div>
      <p className="text-base font-semibold text-foreground">
        Bir checklist seçin veya yenisini oluşturun
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Sol listeden bir şablon seçerek ayrıntılarını görebilir, denetimi başlatabilir veya Nova ile kendi checklist'inizi üretebilirsiniz.
      </p>
      <Button variant="outline" size="sm" className="mt-2" onClick={onOpenStudio}>
        <Sparkles className="mr-2 h-4 w-4" />
        Nova stüdyosunu aç
      </Button>
    </div>
  );
}
