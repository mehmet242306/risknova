"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Download, FileArchive, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusAlert } from "@/components/ui/status-alert";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getActiveWorkspace, type WorkspaceRow } from "@/lib/supabase/workspace-api";
import {
  collectCompanyFile,
  type CompanyFileCategory,
  type CompanyFileCategoryId,
} from "./_lib/company-file-collector";
import { downloadCompanyFileZip } from "./_lib/company-file-generator";
import { fetchCompanyProfile, type CompanyProfile } from "@/lib/supabase/company-profile";
import { CompanyOverview } from "./_components/CompanyOverview";
import { CompanyInfoBanner } from "./_components/CompanyInfoBanner";

type Feedback =
  | { tone: "success" | "warning" | "danger" | "info"; message: string }
  | null;

export function ReportsClient() {
  const [workspace, setWorkspace] = useState<WorkspaceRow | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [categories, setCategories] = useState<CompanyFileCategory[]>([]);
  const [selected, setSelected] = useState<Set<CompanyFileCategoryId>>(new Set());
  const [includeItemPdfs, setIncludeItemPdfs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const loadContext = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [ws, userRes] = await Promise.all([
      getActiveWorkspace(),
      supabase.auth.getUser(),
    ]);
    setWorkspace(ws);

    let resolvedOrg: string | null = null;
    const user = userRes.data.user;
    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("organization_id, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      resolvedOrg = (profile?.organization_id as string | null) ?? null;
      setUserName((profile?.full_name as string | null) ?? user.email ?? null);
    }
    setOrgId(resolvedOrg);

    if (!resolvedOrg) {
      setCategories([]);
      setProfile(null);
      setLoading(false);
      return;
    }

    const [data, companyProfile] = await Promise.all([
      collectCompanyFile(resolvedOrg, ws?.id ?? null),
      ws?.id ? fetchCompanyProfile(ws.id) : Promise.resolve(null),
    ]);
    setCategories(data);
    setProfile(companyProfile);
    // Varsayılan: dolu kategorilerin hepsi seçili
    setSelected(new Set(data.filter((c) => c.count > 0).map((c) => c.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const totalSelected = useMemo(
    () =>
      categories
        .filter((c) => selected.has(c.id))
        .reduce((sum, c) => sum + c.count, 0),
    [categories, selected],
  );

  const toggle = (id: CompanyFileCategoryId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === categories.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(categories.map((c) => c.id)));
    }
  };

  const handleDownload = async () => {
    if (!workspace) {
      setFeedback({
        tone: "warning",
        message: "Firma dosyası indirmek için aktif bir çalışma alanı seçin.",
      });
      return;
    }
    if (selected.size === 0 || totalSelected === 0) {
      setFeedback({
        tone: "warning",
        message: "En az bir kategori seçmelisin (içinde kayıt olan).",
      });
      return;
    }

    setGenerating(true);
    setFeedback(null);
    try {
      await downloadCompanyFileZip({
        categories,
        selectedIds: selected as Set<string>,
        includePerItemPdf: includeItemPdfs,
        context: {
          companyName: workspace.name,
          organizationName: "RiskNova",
          generatedBy: userName,
          generatedAt: new Date(),
        },
      });
      setFeedback({
        tone: "success",
        message: `Firma dosyası hazırlandı ve tarayıcına indirildi. Toplam ${totalSelected} kayıt arşivlendi.`,
      });
    } catch (err) {
      setFeedback({
        tone: "danger",
        message: `Firma dosyası oluşturulamadı: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Raporlama"
        title="Firma Dosyası ve Raporlar"
        description="Aktif çalışma alanına ait tüm kayıtları tek tıkla ZIP olarak indir, ihtiyaç duyduğun evrak setini hazırla."
        meta={
          <>
            {workspace ? (
              <span className="inline-flex items-center rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                Aktif: {workspace.name}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-200">
                Çalışma alanı seçilmedi
              </span>
            )}
            {!loading ? (
              <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                {totalSelected} kayıt seçili
              </span>
            ) : null}
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => void loadContext()} disabled={loading}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
            Yenile
          </Button>
        }
      />

      {feedback ? (
        <StatusAlert tone={feedback.tone}>{feedback.message}</StatusAlert>
      ) : null}

      <CompanyInfoBanner profile={profile} loading={loading} />

      <CompanyOverview categories={categories} loading={loading} />

      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gold)]/15">
              <FileArchive className="h-6 w-6 text-[var(--gold)]" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Firma Dosyası</h2>
              <p className="text-sm text-muted-foreground">
                Seçtiğin kategoriler için özet PDF'ler ve ZIP paketi hazırlanır.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={includeItemPdfs}
                onChange={(e) => setIncludeItemPdfs(e.target.checked)}
              />
              <span>Her kayıt için ayrı PDF üret</span>
            </label>
            <Button variant="outline" size="sm" onClick={toggleAll} disabled={loading}>
              {selected.size === categories.length ? "Hiçbirini seçme" : "Hepsini seç"}
            </Button>
            <Button onClick={handleDownload} disabled={generating || loading || totalSelected === 0}>
              {generating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              {generating ? "Hazırlanıyor..." : "ZIP olarak indir"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Kayıtlar toplanıyor...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
              Aktif bir organizasyon bulunamadı. Lütfen önce bir çalışma alanı seç.
            </div>
          ) : (
            categories.map((cat) => {
              const isSelected = selected.has(cat.id);
              const isEmpty = cat.count === 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggle(cat.id)}
                  disabled={isEmpty}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition",
                    isSelected
                      ? "border-[var(--gold)]/60 bg-[var(--gold)]/10 shadow-[0_8px_18px_rgba(217,162,27,0.12)]"
                      : "border-border bg-muted/20 hover:border-[var(--gold)]/30",
                    isEmpty && "opacity-50 cursor-not-allowed hover:border-border",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="text-lg">{cat.icon}</span>
                      {cat.label}
                    </span>
                    <Badge variant={isEmpty ? "neutral" : isSelected ? "success" : "neutral"}>
                      {cat.count}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isEmpty
                      ? "Kayıt yok"
                      : isSelected
                        ? "ZIP'e dahil edilecek"
                        : "Seçmek için tıkla"}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-dashed border-border bg-muted/10 p-5 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <Archive className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">İleride gelecek</p>
            <p>
              Trend analizi grafikleri, yönetici özet raporları ve çoklu firma karşılaştırmaları bu ekranda yer alacak. Şu an aktif çalışma alanının tüm evraklarını ZIP olarak dışa aktarabilirsin.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
