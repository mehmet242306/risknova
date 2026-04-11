"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { fetchSurveys, type SurveyRecord } from "@/lib/supabase/survey-api";

type TabType = "all" | "survey" | "exam";
type StatusFilter = "all" | "draft" | "active" | "closed";

export function TrainingClient() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCompanyId = searchParams.get("companyId") ?? undefined;
  const fromLibrary = searchParams.get("library") === "1";
  const librarySection = searchParams.get("librarySection") ?? "education";
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>(() => {
    const requested = searchParams.get("tab");
    return requested === "survey" || requested === "exam" ? requested : "all";
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");

  useEffect(() => {
    async function loadSurveys() {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) { setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase.from("user_profiles").select("organization_id").eq("auth_user_id", user.id).single();
      if (!profile?.organization_id) { setLoading(false); return; }
      const data = await fetchSurveys(profile.organization_id, initialCompanyId);
      setSurveys(data);
      setLoading(false);
    }

    void loadSurveys();
  }, [initialCompanyId]);

  const filtered = surveys.filter(s => {
    if (tab !== "all" && s.type !== tab) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all: surveys.length,
    survey: surveys.filter(s => s.type === "survey").length,
    exam: surveys.filter(s => s.type === "exam").length,
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    closed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    archived: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };

  const statusLabels: Record<string, string> = {
    draft: "Taslak",
    active: "Aktif",
    closed: "Kapalı",
    archived: "Arşiv",
  };

  const buildTrainingHref = (pathname: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams(extra);
    if (initialCompanyId) {
      params.set("companyId", initialCompanyId);
    }
    if (fromLibrary) {
      params.set("library", "1");
      params.set("librarySection", librarySection);
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const libraryBackHref = buildTrainingHref("/isg-library", { view: "browse", section: librarySection });

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {fromLibrary ? (
              <button
                onClick={() => router.push(libraryBackHref)}
                className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                ISG Kutuphanesi
              </button>
            ) : null}
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {t("nav.training")}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Anket ve sınav oluşturun, kişiye özel link gönderin, sonuçları analiz edin
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildTrainingHref("/training/slides")}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/5 px-4 py-2.5 text-sm font-semibold text-[var(--gold)] shadow-sm transition-colors hover:bg-[var(--gold)]/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Slayt Kütüphanem
            </Link>
            <Link
              href={buildTrainingHref("/training/question-bank")}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--accent)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Soru Bankası
            </Link>
            <Link
              href={buildTrainingHref("/training/certificates")}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--accent)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Sertifikalar
            </Link>
            <Link
              href={buildTrainingHref("/training/new")}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Oluştur
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 rounded-xl bg-[var(--card)] p-1 shadow-sm border border-[var(--border)]">
          {(["all", "survey", "exam"] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-[var(--gold)] text-white shadow"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {t === "all" ? "Tümü" : t === "survey" ? "Anketler" : "Sınavlar"}
              <span className="ml-1.5 text-xs opacity-75">({counts[t]})</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Anket veya sınav ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "draft", "active", "closed"] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-[var(--gold)]/10 text-[var(--gold)] ring-1 ring-[var(--gold)]/30"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                }`}
              >
                {s === "all" ? "Tümü" : statusLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--card)] border border-[var(--border)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
            <div className="mb-4 rounded-full bg-[var(--gold)]/10 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Henüz anket veya sınav yok</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              İlk anket veya sınavınızı oluşturmak için &quot;Yeni Oluştur&quot; butonuna tıklayın
            </p>
            <Link
              href="/training/new"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:brightness-110"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Oluştur
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => (
              <Link
                key={s.id}
                href={`/training/${s.id}`}
                className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all hover:shadow-md hover:border-[var(--gold)]/30"
              >
                {/* Icon */}
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  s.type === "exam"
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                }`}>
                  {s.type === "exam" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--foreground)] truncate group-hover:text-[var(--gold)] transition-colors">
                      {s.title}
                    </h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[s.status]}`}>
                      {statusLabels[s.status]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.type === "exam"
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        : "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                    }`}>
                      {s.type === "exam" ? "Sınav" : "Anket"}
                    </span>
                  </div>
                  {s.description && (
                    <p className="mt-0.5 text-sm text-[var(--muted-foreground)] truncate">{s.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                    <span>{new Date(s.createdAt).toLocaleDateString("tr-TR")}</span>
                    {s.type === "exam" && s.passScore && (
                      <span>Geçme puanı: {s.passScore}%</span>
                    )}
                    {s.type === "exam" && s.timeLimitMinutes && (
                      <span>Süre: {s.timeLimitMinutes} dk</span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <svg className="h-5 w-5 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
