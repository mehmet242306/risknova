"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  fetchBankQuestions,
  createBankQuestion,
  updateBankQuestion,
  deleteBankQuestion,
  bulkCreateFromAI,
  type BankQuestion,
  type Difficulty,
  type QuestionType,
  type QuestionOption,
} from "@/lib/supabase/question-bank-api";

const CATEGORIES: Record<string, { label: string; color: string; emoji: string }> = {
  yangin: { label: "Yangın", color: "#EF4444", emoji: "🔥" },
  kkd: { label: "KKD", color: "#3B82F6", emoji: "🦺" },
  yuksekte_calisma: { label: "Yüksekte Çalışma", color: "#F59E0B", emoji: "🪜" },
  elektrik: { label: "Elektrik", color: "#8B5CF6", emoji: "⚡" },
  kimyasal: { label: "Kimyasal", color: "#10B981", emoji: "🧪" },
  ilkyardim: { label: "İlk Yardım", color: "#EC4899", emoji: "⛑️" },
  ergonomi: { label: "Ergonomi", color: "#06B6D4", emoji: "🪑" },
  makine: { label: "Makine", color: "#6366F1", emoji: "⚙️" },
  genel: { label: "Genel", color: "#64748B", emoji: "📘" },
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "#10B981",
  medium: "#F59E0B",
  hard: "#EF4444",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Kolay",
  medium: "Orta",
  hard: "Zor",
};

const EMPTY_FORM = {
  question_text: "",
  question_type: "multiple_choice" as QuestionType,
  options: [
    { label: "A", text: "", is_correct: true },
    { label: "B", text: "", is_correct: false },
    { label: "C", text: "", is_correct: false },
    { label: "D", text: "", is_correct: false },
  ] as QuestionOption[],
  explanation: "",
  category: "genel",
  difficulty: "medium" as Difficulty,
  points: 1,
};

export function QuestionBankClient() {
  const searchParams = useSearchParams();
  const companyIdParam = searchParams.get("companyId") ?? "";
  const fromLibrary = searchParams.get("library") === "1";
  const librarySection = searchParams.get("librarySection") ?? "assessment";
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "">("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // AI generator modal
  const [showAI, setShowAI] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(10);
  const [aiCategory, setAiCategory] = useState("genel");
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchBankQuestions();
    setQuestions(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = questions.filter((q) => {
    if (search && !q.question_text.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && q.category !== categoryFilter) return false;
    if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (q: BankQuestion) => {
    setEditId(q.id);
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      options: (q.options as QuestionOption[]) || EMPTY_FORM.options,
      explanation: q.explanation || "",
      category: q.category || "genel",
      difficulty: q.difficulty || "medium",
      points: q.points,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.question_text.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await updateBankQuestion(editId, {
          question_text: form.question_text,
          question_type: form.question_type,
          options: form.options,
          explanation: form.explanation || null,
          category: form.category,
          difficulty: form.difficulty,
          points: form.points,
        });
      } else {
        await createBankQuestion({
          question_text: form.question_text,
          question_type: form.question_type,
          options: form.options,
          explanation: form.explanation || undefined,
          category: form.category,
          difficulty: form.difficulty,
          points: form.points,
        });
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditId(null);
      load();
    } catch (e: any) {
      alert("Hata: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Bu soruyu silmek istediğinize emin misiniz?")) return;
    await deleteBankQuestion(id);
    load();
  };

  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const res = await fetch("/api/training-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic,
          questionCount: aiCount,
          optionCount: 4,
          type: "exam",
        }),
      });
      if (!res.ok) throw new Error("AI hata");
      const { questions: aiQuestions } = await res.json();
      if (!Array.isArray(aiQuestions)) throw new Error("Geçersiz yanıt");

      // AI'dan gelen formatı bank formatına çevir
      const mapped = aiQuestions.map((q: any) => ({
        question_text: q.questionText,
        question_type: "multiple_choice" as QuestionType,
        options: (q.options || []).map((o: any) => ({
          label: o.value,
          text: o.label,
          is_correct: !!o.isCorrect,
        })),
        explanation: q.explanation,
      }));

      const count = await bulkCreateFromAI(mapped, aiCategory, aiDifficulty);
      if (count > 0) {
        setShowAI(false);
        setAiTopic("");
        load();
      } else {
        throw new Error("Sorular kaydedilemedi");
      }
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const addOption = () => {
    const labels = ["A", "B", "C", "D", "E", "F"];
    if (form.options.length >= 6) return;
    setForm({
      ...form,
      options: [
        ...form.options,
        { label: labels[form.options.length], text: "", is_correct: false },
      ],
    });
  };

  const removeOption = (idx: number) => {
    if (form.options.length <= 2) return;
    setForm({ ...form, options: form.options.filter((_, i) => i !== idx) });
  };

  const setOption = (idx: number, patch: Partial<QuestionOption>) => {
    setForm({
      ...form,
      options: form.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    });
  };

  const setCorrect = (idx: number) => {
    setForm({
      ...form,
      options: form.options.map((o, i) => ({ ...o, is_correct: i === idx })),
    });
  };

  const backHref = fromLibrary
    ? `/isg-library?view=browse&section=${librarySection}${companyIdParam ? `&companyId=${companyIdParam}` : ""}`
    : `/training${companyIdParam ? `?companyId=${companyIdParam}` : ""}`;

  return (
    <div className="min-h-screen bg-[var(--background)]">
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
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Soru Bankası</h1>
            </div>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Tekrar kullanılabilir sorularınızı oluşturun, kategorize edin ve sınavlarda kullanın
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowAI(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-400/40 bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-4 py-2.5 text-sm font-semibold text-purple-600 dark:text-purple-400 shadow-sm hover:bg-purple-500/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
              AI ile Oluştur
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Yeni Soru
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Toplam" value={questions.length} color="#F97316" />
          <StatBox label="Kolay" value={questions.filter((q) => q.difficulty === "easy").length} color="#10B981" />
          <StatBox label="Orta" value={questions.filter((q) => q.difficulty === "medium").length} color="#F59E0B" />
          <StatBox label="Zor" value={questions.filter((q) => q.difficulty === "hard").length} color="#EF4444" />
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Soru ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)]"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)]"
          >
            <option value="">Tüm Kategoriler</option>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as any)}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)]"
          >
            <option value="">Tüm Zorluklar</option>
            <option value="easy">Kolay</option>
            <option value="medium">Orta</option>
            <option value="hard">Zor</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--card)] border border-[var(--border)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
            <div className="mb-4 rounded-full bg-[var(--gold)]/10 p-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Henüz soru eklenmemiş</h3>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowAI(true)} className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-5 py-2.5 text-sm font-semibold text-purple-600 dark:text-purple-400">✨ AI ile Oluştur</button>
              <button onClick={openCreate} className="rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-white">+ Yeni Soru</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => {
              const cat = q.category ? CATEGORIES[q.category] : undefined;
              return (
                <div
                  key={q.id}
                  className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all hover:border-[var(--gold)]/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {cat && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                            style={{ background: `${cat.color}22`, color: cat.color }}
                          >
                            {cat.emoji} {cat.label}
                          </span>
                        )}
                        {q.difficulty && (
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: `${DIFFICULTY_COLORS[q.difficulty]}22`,
                              color: DIFFICULTY_COLORS[q.difficulty],
                            }}
                          >
                            {DIFFICULTY_LABELS[q.difficulty]}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full bg-[var(--muted)]/30 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--muted-foreground)]">
                          {q.points} puan
                        </span>
                        {q.times_used > 0 && (
                          <span className="text-[10px] text-[var(--muted-foreground)]">
                            {q.times_used} kez kullanıldı
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{q.question_text}</p>
                      {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="mt-3 grid gap-1 grid-cols-1 sm:grid-cols-2">
                          {q.options.map((o, i) => (
                            <div
                              key={i}
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                                o.is_correct
                                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                                  : "border-[var(--border)] text-[var(--muted-foreground)]"
                              }`}
                            >
                              <span className="font-bold">{o.label}.</span>
                              <span className="truncate">{o.text}</span>
                              {o.is_correct && <span className="ml-auto">✓</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.explanation && (
                        <div className="mt-2 rounded-lg bg-[var(--muted)]/20 p-2 text-[11px] text-[var(--muted-foreground)]">
                          💡 {q.explanation}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(q)}
                        className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button
                        onClick={() => remove(q.id)}
                        className="rounded-lg border border-red-500/30 p-1.5 text-red-500 hover:bg-red-500/10"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--card)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-xl font-bold text-[var(--foreground)]">
              {editId ? "Soruyu Düzenle" : "Yeni Soru"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Soru Metni *</label>
                <textarea
                  value={form.question_text}
                  onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  placeholder="Soruyu yazın..."
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Zorluk</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  >
                    <option value="easy">Kolay</option>
                    <option value="medium">Orta</option>
                    <option value="hard">Zor</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Puan</label>
                  <input
                    type="number"
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: Math.max(1, Number(e.target.value) || 1) })}
                    min={1}
                    max={100}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Şıklar (doğru olanı işaretle)</label>
                <div className="space-y-2">
                  {form.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        onClick={() => setCorrect(i)}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 font-bold text-xs ${
                          o.is_correct
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        {o.label}
                      </button>
                      <input
                        type="text"
                        value={o.text}
                        onChange={(e) => setOption(i, { text: e.target.value })}
                        placeholder="Şık metni..."
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                      />
                      {form.options.length > 2 && (
                        <button
                          onClick={() => removeOption(i)}
                          className="rounded-lg border border-red-500/30 p-2 text-red-500 hover:bg-red-500/10"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.options.length < 6 && (
                  <button
                    onClick={addOption}
                    className="mt-2 text-xs font-semibold text-[var(--gold)] hover:underline"
                  >
                    + Şık Ekle
                  </button>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Açıklama (opsiyonel)</label>
                <textarea
                  value={form.explanation}
                  onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                  rows={2}
                  placeholder="Doğru cevabın açıklaması..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                İptal
              </button>
              <button
                onClick={save}
                disabled={saving || !form.question_text.trim()}
                className="flex-1 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI MODAL */}
      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAI(false)}>
          <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-xl font-bold text-[var(--foreground)]">✨ AI ile Soru Oluştur</h2>
            <p className="mb-4 text-xs text-[var(--muted-foreground)]">
              Konu gir, AI seçili kategori için İSG soruları üretsin
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Konu *</label>
                <textarea
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)]"
                  placeholder="Örn: Yangın söndürücü kullanımı, yanma sınıfları"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Kategori</label>
                  <select
                    value={aiCategory}
                    onChange={(e) => setAiCategory(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground)]"
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Zorluk</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value as Difficulty)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground)]"
                  >
                    <option value="easy">Kolay</option>
                    <option value="medium">Orta</option>
                    <option value="hard">Zor</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--muted-foreground)]">Adet</label>
                  <input
                    type="number"
                    value={aiCount}
                    onChange={(e) => setAiCount(Math.max(1, Math.min(30, Number(e.target.value) || 10)))}
                    min={1}
                    max={30}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-xs text-[var(--foreground)]"
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

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
    </div>
  );
}
