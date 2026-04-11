"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchMyDecks,
  fetchOrgDecks,
  fetchSystemTemplates,
  createDeck,
  deleteDeck,
  cloneDeckFromTemplate,
  type SlideDeck,
} from "@/lib/supabase/slide-deck-api";

type TabKey = "my" | "organization" | "templates" | "ai_create";

const CATEGORIES: Record<string, { label: string; color: string; emoji: string }> = {
  yangin: { label: "Yangın Güvenliği", color: "#EF4444", emoji: "🔥" },
  kkd: { label: "Kişisel Koruyucu", color: "#3B82F6", emoji: "🦺" },
  yuksekte_calisma: { label: "Yüksekte Çalışma", color: "#F59E0B", emoji: "🪜" },
  elektrik: { label: "Elektrik Güvenliği", color: "#8B5CF6", emoji: "⚡" },
  kimyasal: { label: "Kimyasal Güvenlik", color: "#10B981", emoji: "🧪" },
  ilkyardim: { label: "İlk Yardım", color: "#EC4899", emoji: "⛑️" },
  ergonomi: { label: "Ergonomi", color: "#06B6D4", emoji: "🪑" },
  makine: { label: "Makine Güvenliği", color: "#6366F1", emoji: "⚙️" },
  genel: { label: "Genel İSG", color: "#64748B", emoji: "📘" },
};

export function SlideLibraryClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyIdParam = searchParams.get("companyId") ?? "";
  const fromLibrary = searchParams.get("library") === "1";
  const librarySection = searchParams.get("librarySection") ?? "education";
  const [tab, setTab] = useState<TabKey>("my");
  const [myDecks, setMyDecks] = useState<SlideDeck[]>([]);
  const [orgDecks, setOrgDecks] = useState<SlideDeck[]>([]);
  const [templates, setTemplates] = useState<SlideDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "genel", theme: "modern" });

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // AI modal
  const [showAI, setShowAI] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiSlideCount, setAiSlideCount] = useState(10);
  const [aiCategory, setAiCategory] = useState("genel");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [mine, org, tpl] = await Promise.all([
      fetchMyDecks(),
      fetchOrgDecks(),
      fetchSystemTemplates(),
    ]);
    setMyDecks(mine);
    setOrgDecks(org);
    setTemplates(tpl);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const deck = await createDeck({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        theme: form.theme,
        visibility: "private",
      });
      if (deck) {
        router.push(`/training/slides/${deck.id}/edit`);
      }
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setCreating(false);
      setShowCreate(false);
    }
  }

  async function handleAIGenerate() {
    if (!aiTopic.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const res = await fetch("/api/training-slides-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic,
          slideCount: aiSlideCount,
          category: aiCategory,
          language: "tr",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "AI üretim hatası");
      }
      const { deckId } = await res.json();
      if (deckId) {
        setShowAI(false);
        router.push(`/training/slides/${deckId}/edit`);
      }
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu deck'i silmek istediğinize emin misiniz?")) return;
    const ok = await deleteDeck(id);
    if (ok) loadAll();
  }

  async function handleImportPPTX(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "genel");
      const res = await fetch("/api/slide-deck-import", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Import hatası");
      }
      const { deckId } = await res.json();
      if (deckId) {
        router.push(`/training/slides/${deckId}/edit`);
      }
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCloneTemplate(template: SlideDeck) {
    const newId = await cloneDeckFromTemplate(template.id, template.title);
    if (newId) {
      router.push(`/training/slides/${newId}/edit`);
    }
  }

  const currentList = tab === "my" ? myDecks : tab === "organization" ? orgDecks : tab === "templates" ? templates : [];

  const filtered = currentList.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && d.category !== categoryFilter) return false;
    return true;
  });

  const backHref = fromLibrary
    ? `/isg-library?view=browse&section=${librarySection}${companyIdParam ? `&companyId=${companyIdParam}` : ""}`
    : `/training${companyIdParam ? `?companyId=${companyIdParam}` : ""}`;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {importError && (
        <div className="fixed top-4 right-4 z-50 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 shadow-lg">
          ⚠️ {importError}
          <button onClick={() => setImportError(null)} className="ml-3 text-xs opacity-70 hover:opacity-100">×</button>
        </div>
      )}
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href={backHref}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </Link>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Slayt Kütüphanesi</h1>
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Profesyonel eğitim slaytları oluştur, düzenle ve paylaş
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx"
              onChange={handleImportPPTX}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {importing ? "Yükleniyor..." : "PPTX Yükle"}
            </button>
            <button
              onClick={() => setShowAI(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-400/40 bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-4 py-2.5 text-sm font-semibold text-purple-600 dark:text-purple-400 shadow-sm transition-colors hover:bg-purple-500/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              AI ile Oluştur
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Deck
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex items-center gap-1 rounded-xl bg-[var(--card)] p-1 shadow-sm border border-[var(--border)]">
          {[
            { k: "my" as TabKey, l: "Benim Deck'lerim", c: myDecks.length, icon: "👤" },
            { k: "organization" as TabKey, l: "Organizasyon", c: orgDecks.length, icon: "🏢" },
            { k: "templates" as TabKey, l: "Hazır Şablonlar", c: templates.length, icon: "📚" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.k
                  ? "bg-[var(--gold)] text-white shadow"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.l}
              <span className="ml-1.5 text-xs opacity-75">({t.c})</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Deck ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)]"
          >
            <option value="">Tüm Kategoriler</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.emoji} {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl bg-[var(--card)] border border-[var(--border)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
            <div className="mb-4 rounded-full bg-[var(--gold)]/10 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {tab === "my" ? "Henüz deck oluşturmadın" : tab === "organization" ? "Organizasyon paylaşımı yok" : "Şablon bulunamadı"}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {tab === "my" && "İlk eğitim slayt deck'ini oluştur"}
            </p>
            {tab === "my" && (
              <div className="mt-4 flex gap-2">
                <button onClick={() => setShowAI(true)} className="inline-flex items-center gap-2 rounded-xl border border-purple-400/40 bg-purple-500/10 px-5 py-2.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20">
                  ✨ AI ile Oluştur
                </button>
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110">
                  + Boş Deck
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => {
              const cat = d.category ? CATEGORIES[d.category] : undefined;
              return (
                <div
                  key={d.id}
                  className="group relative rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-[var(--gold)]/30"
                >
                  {/* Cover */}
                  <div
                    className="relative h-32 flex items-center justify-center"
                    style={{
                      background: cat
                        ? `linear-gradient(135deg, ${cat.color}22 0%, ${cat.color}44 100%)`
                        : "linear-gradient(135deg, #F9731622 0%, #F9731644 100%)",
                    }}
                  >
                    {d.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.cover_image_url} alt={d.title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-5xl">{cat?.emoji || "📊"}</span>
                    )}
                    {d.is_system_template && (
                      <span className="absolute top-2 left-2 rounded-md bg-[var(--gold)]/90 px-2 py-0.5 text-[10px] font-bold text-white">
                        HAZIR ŞABLON
                      </span>
                    )}
                    {d.source === "ai_generated" && (
                      <span className="absolute top-2 right-2 rounded-md bg-purple-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                        ✨ AI
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <h3 className="font-semibold text-[var(--foreground)] line-clamp-1 group-hover:text-[var(--gold)] transition-colors">
                      {d.title}
                    </h3>
                    {d.description && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2">{d.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-[var(--muted-foreground)]">
                      <span className="inline-flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                        {d.slide_count} slayt
                      </span>
                      <span>{new Date(d.updated_at).toLocaleDateString("tr-TR")}</span>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex gap-1.5">
                      {tab === "templates" ? (
                        <button
                          onClick={() => handleCloneTemplate(d)}
                          className="flex-1 rounded-lg bg-[var(--gold)] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                        >
                          Kullan
                        </button>
                      ) : (
                        <>
                          <Link
                            href={`/training/slides/${d.id}/edit`}
                            className="flex-1 rounded-lg bg-[var(--gold)] px-3 py-1.5 text-xs font-semibold text-white text-center hover:brightness-110"
                          >
                            Düzenle
                          </Link>
                          <Link
                            href={`/training/slides/${d.id}/present`}
                            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--accent)]"
                          >
                            Sun
                          </Link>
                          {tab === "my" && (
                            <button
                              onClick={() => handleDelete(d.id)}
                              className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/10"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-xl font-bold text-[var(--foreground)]">Yeni Slayt Deck</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Başlık *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  placeholder="Yangın Güvenliği Eğitimi"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Açıklama</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  placeholder="Kısa açıklama..."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Kategori</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                >
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.emoji} {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Tema</label>
                <div className="grid grid-cols-4 gap-2">
                  {["modern", "classic", "dark", "corporate"].map((th) => (
                    <button
                      key={th}
                      onClick={() => setForm({ ...form, theme: th })}
                      className={`rounded-lg border px-2 py-2 text-xs capitalize ${
                        form.theme === th
                          ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                          : "border-[var(--border)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      {th}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                İptal
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.title.trim()}
                className="flex-1 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI MODAL */}
      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAI(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-xl font-bold text-[var(--foreground)]">✨ AI ile Slayt Oluştur</h2>
            <p className="mb-4 text-xs text-[var(--muted-foreground)]">
              Konuyu ve slayt sayısını belirt, Nova AI profesyonel İSG eğitim slaytları oluştursun
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Konu / Detay *</label>
                <textarea
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  placeholder="Örn: İnşaat sektöründe yüksekte çalışma güvenliği, emniyet kemeri kullanımı, iskele kurulumu"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Kategori</label>
                  <select
                    value={aiCategory}
                    onChange={(e) => setAiCategory(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Slayt Sayısı</label>
                  <input
                    type="number"
                    value={aiSlideCount}
                    onChange={(e) => setAiSlideCount(Math.max(5, Math.min(30, Number(e.target.value) || 10)))}
                    min={5}
                    max={30}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </div>
              </div>
              {aiError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-500">{aiError}</div>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setShowAI(false)} disabled={aiGenerating} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                İptal
              </button>
              <button
                onClick={handleAIGenerate}
                disabled={aiGenerating || !aiTopic.trim()}
                className="flex-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {aiGenerating ? "Üretiliyor..." : "✨ Oluştur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
