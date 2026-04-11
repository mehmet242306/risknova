"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSurvey, saveQuestions, type QuestionOption } from "@/lib/supabase/survey-api";

type QuestionType = "multiple_choice" | "open_ended" | "scale" | "yes_no" | "multi_select";

interface QuestionDraft {
  id: string;
  questionText: string;
  questionType: QuestionType;
  options: QuestionOption[];
  required: boolean;
  points: number;
}

const questionTypeLabels: Record<QuestionType, string> = {
  multiple_choice: "Çoktan Seçmeli",
  open_ended: "Açık Uçlu",
  scale: "Ölçek (1-5)",
  yes_no: "Evet / Hayır",
  multi_select: "Çoklu Seçim",
};

function genId() {
  return Math.random().toString(36).substring(2, 10);
}

export function TrainingNewClient() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Step 1: General info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"survey" | "exam">("survey");
  const [passScore, setPassScore] = useState(70);
  const [timeLimit, setTimeLimit] = useState(30);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [autoIssueCertificate, setAutoIssueCertificate] = useState(true);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set());
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");

  // Step 2: AI config
  const [aiTopic, setAiTopic] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [optionCount, setOptionCount] = useState(4);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Step 3: Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  // User/org info
  const [orgId, setOrgId] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase.from("user_profiles").select("organization_id").eq("auth_user_id", user.id).single();
    if (!profile?.organization_id) return;
    setOrgId(profile.organization_id);

    const { data: ws } = await supabase
      .from("company_workspaces")
      .select("id, display_name")
      .eq("is_archived", false)
      .order("display_name");

    if (ws && ws.length > 0) {
      const list = (ws as Record<string, unknown>[]).map(w => ({
        id: w.id as string,
        name: (w.display_name || "Firma") as string,
      }));
      setCompanies(list);
    }
  }

  async function generateWithAI() {
    if (!aiTopic.trim()) return;
    setAiGenerating(true);

    try {
      const res = await fetch("/api/training-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          description: description.trim(),
          questionCount,
          optionCount,
          type,
        }),
      });

      if (!res.ok) throw new Error("AI error");
      const data = await res.json();

      if (data.questions && Array.isArray(data.questions)) {
        const drafts: QuestionDraft[] = data.questions.map((q: Record<string, unknown>) => ({
          id: genId(),
          questionText: (q.questionText || "") as string,
          questionType: (q.questionType === "mixed" ? "multiple_choice" : q.questionType || "multiple_choice") as QuestionType,
          options: (q.options || []) as QuestionOption[],
          required: true,
          points: (q.points || 1) as number,
        }));
        setQuestions(drafts);
        setStep(3);
      }
    } catch (err) {
      console.error("AI generation error:", err);
    }

    setAiGenerating(false);
  }

  function addQuestion() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    setQuestions(prev => [
      ...prev,
      {
        id: genId(),
        questionText: "",
        questionType: type === "exam" ? "multiple_choice" : "open_ended",
        options: Array.from({ length: optionCount }, (_, i) => ({
          label: "",
          value: letters[i],
        })),
        required: true,
        points: 1,
      },
    ]);
  }

  function updateQuestion(id: string, updates: Partial<QuestionDraft>) {
    setQuestions(prev => prev.map(q => (q.id === id ? { ...q, ...updates } : q)));
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  function moveQuestion(idx: number, direction: "up" | "down") {
    setQuestions(prev => {
      const arr = [...prev];
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= arr.length) return arr;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  function addOption(qId: string) {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== qId) return q;
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return { ...q, options: [...q.options, { label: "", value: letters[q.options.length] || String(q.options.length) }] };
      })
    );
  }

  function updateOption(qId: string, idx: number, updates: Partial<QuestionOption>) {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== qId) return q;
        const opts = [...q.options];
        opts[idx] = { ...opts[idx], ...updates };
        return { ...q, options: opts };
      })
    );
  }

  function removeOption(qId: string, idx: number) {
    setQuestions(prev =>
      prev.map(q => (q.id !== qId ? q : { ...q, options: q.options.filter((_, i) => i !== idx) }))
    );
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    const companyIds = Array.from(selectedCompanyIds);
    const survey = await createSurvey({
      organizationId: orgId,
      companyId: companyIds[0] || "",
      createdBy: userId,
      title: title.trim(),
      description: description.trim(),
      type,
      status: "draft",
      passScore: type === "exam" ? passScore : null,
      timeLimitMinutes: type === "exam" ? timeLimit : null,
      shuffleQuestions: type === "exam" ? shuffleQuestions : false,
      settings: type === "exam" ? { auto_issue_certificate: autoIssueCertificate } : {},
    });

    if (!survey) { setSaving(false); return; }

    if (questions.length > 0) {
      await saveQuestions(
        survey.id,
        questions.map((q, i) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.questionType === "open_ended" ? null : q.options,
          required: q.required,
          sortOrder: i,
          points: q.points,
        }))
      );
    }

    router.push(`/training/${survey.id}`);
  }

  const canGoStep2 = title.trim() && selectedCompanyIds.size > 0;
  const filteredCompanies = companies.filter(c => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/training")}
            className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Geri
          </button>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Yeni {type === "exam" ? "Sınav" : "Anket"} Oluştur
          </h1>
        </div>

        {/* Steps indicator */}
        <div className="mb-8 flex items-center gap-2">
          {[
            { n: 1, label: "Genel Bilgiler" },
            { n: 2, label: "AI Soru Ayarları" },
            { n: 3, label: "Sorular" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-[var(--border)]" />}
              <button
                onClick={() => {
                  if (s.n === 1) setStep(1);
                  else if (s.n === 2 && canGoStep2) setStep(2);
                  else if (s.n === 3 && questions.length > 0) setStep(3);
                }}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  step === s.n
                    ? "bg-[var(--gold)] text-white shadow"
                    : step > s.n
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)]"
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  step > s.n ? "bg-emerald-500 text-white" : "bg-white/20"
                }`}>
                  {step > s.n ? "✓" : s.n}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          ))}
        </div>

        {/* ============ STEP 1: General info ============ */}
        {step === 1 && (
          <div className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            {/* Type selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Tür</label>
              <div className="flex gap-3">
                {(["survey", "exam"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-xl border-2 p-4 text-center transition-colors ${
                      type === t
                        ? t === "exam"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-[var(--border)] hover:border-[var(--gold)]/30"
                    }`}
                  >
                    <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${
                      t === "exam"
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                        : "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400"
                    }`}>
                      {t === "exam" ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                      )}
                    </div>
                    <div className="font-medium text-[var(--foreground)]">{t === "exam" ? "Sınav" : "Anket"}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{t === "exam" ? "Bilgi ve yetkinlik ölçümü" : "Görüş ve geri bildirim toplama"}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Başlık *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={type === "exam" ? "ör: İSG Temel Eğitim Sınavı" : "ör: Çalışan Memnuniyet Anketi"}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Açıklama</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Konu ve içerik hakkında kısa açıklama..."
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 resize-none"
              />
            </div>

            {/* Company — multi-select dropdown */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Firma * {selectedCompanyIds.size > 0 && <span className="text-xs text-[var(--gold)]">({selectedCompanyIds.size} seçili)</span>}
              </label>
              {companies.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">Yükleniyor...</p>
              ) : (
                <div className="relative">
                  {/* Selected chips + trigger */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setCompanyDropdownOpen(!companyDropdownOpen); }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-left text-sm transition-colors hover:border-[var(--gold)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                  >
                    <div className="flex flex-1 flex-wrap gap-1.5 min-h-[24px]">
                      {selectedCompanyIds.size === 0 ? (
                        <span className="text-[var(--muted-foreground)]">Firma seçin...</span>
                      ) : (
                        Array.from(selectedCompanyIds).map(id => {
                          const c = companies.find(x => x.id === id);
                          return c ? (
                            <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-[var(--gold)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--gold)]">
                              {c.name}
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={e => { e.stopPropagation(); const next = new Set(selectedCompanyIds); next.delete(id); setSelectedCompanyIds(next); }}
                                onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); const next = new Set(selectedCompanyIds); next.delete(id); setSelectedCompanyIds(next); } }}
                                className="ml-0.5 cursor-pointer hover:text-red-500"
                              >×</span>
                            </span>
                          ) : null;
                        })
                      )}
                    </div>
                    <svg className={`shrink-0 transition-transform ${companyDropdownOpen ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  {/* Dropdown */}
                  {companyDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
                      {/* Search */}
                      <div className="border-b border-[var(--border)] p-2">
                        <div className="relative">
                          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          <input
                            type="text"
                            value={companySearch}
                            onChange={e => setCompanySearch(e.target.value)}
                            placeholder="Firma ara..."
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30"
                            autoFocus
                          />
                        </div>
                      </div>
                      {/* Options */}
                      <div className="max-h-48 overflow-y-auto p-1">
                        {filteredCompanies.length === 0 ? (
                          <p className="py-3 text-center text-xs text-[var(--muted-foreground)]">Sonuç yok</p>
                        ) : (
                          filteredCompanies.map(c => (
                            <label
                              key={c.id}
                              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-[var(--accent)]"
                            >
                              <input
                                type="checkbox"
                                checked={selectedCompanyIds.has(c.id)}
                                onChange={e => {
                                  const next = new Set(selectedCompanyIds);
                                  e.target.checked ? next.add(c.id) : next.delete(c.id);
                                  setSelectedCompanyIds(next);
                                }}
                                className="rounded border-[var(--border)]"
                              />
                              <span className="text-[var(--foreground)]">{c.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                      {/* Footer */}
                      <div className="border-t border-[var(--border)] p-2 flex justify-between">
                        <button
                          type="button"
                          onClick={() => setSelectedCompanyIds(new Set(companies.map(c => c.id)))}
                          className="text-xs text-[var(--gold)] hover:underline"
                        >Tümünü Seç</button>
                        <button
                          type="button"
                          onClick={() => setCompanyDropdownOpen(false)}
                          className="rounded-lg bg-[var(--gold)] px-3 py-1 text-xs font-medium text-white"
                        >Tamam</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Exam-specific settings */}
            {type === "exam" && (
              <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Sınav Ayarları</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Geçme Puanı (%)</label>
                    <input type="number" value={passScore} onChange={e => setPassScore(Number(e.target.value))} min={0} max={100} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--muted-foreground)]">Süre Sınırı (dk)</label>
                    <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} min={1} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                  <input type="checkbox" checked={shuffleQuestions} onChange={e => setShuffleQuestions(e.target.checked)} className="rounded border-[var(--border)]" />
                  Soruları karıştır
                </label>
                <label className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={autoIssueCertificate}
                    onChange={(e) => setAutoIssueCertificate(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--border)]"
                  />
                  <span>
                    <span className="font-semibold">🏆 Otomatik Sertifika</span>
                    <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                      (geçme puanını aşan her katılımcıya otomatik sertifika verilir)
                    </span>
                  </span>
                </label>
              </div>
            )}

            <button
              onClick={() => canGoStep2 ? setStep(2) : undefined}
              disabled={!canGoStep2}
              className="w-full rounded-xl bg-[var(--gold)] py-3 text-sm font-semibold text-white shadow transition-colors hover:brightness-110 disabled:opacity-50"
            >
              Devam — Soru Ayarları
            </button>
          </div>
        )}

        {/* ============ STEP 2: AI Question Config ============ */}
        {step === 2 && (
          <div className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 p-4 dark:from-purple-900/20 dark:to-blue-900/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">AI ile Soru Oluşturma</h3>
                <p className="text-xs text-[var(--muted-foreground)]">Yapay zeka konuya uygun sorular oluşturacak, sonra düzenleyebilirsiniz</p>
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Soru Konusu / İçerik *</label>
              <textarea
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                placeholder={type === "exam"
                  ? "ör: 6331 sayılı İSG Kanunu, temel İSG kavramları, risk değerlendirmesi, kişisel koruyucu donanım (KKD), acil durum prosedürleri"
                  : "ör: Çalışan memnuniyeti, iş güvenliği kültürü, eğitim ihtiyaçları"}
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 resize-none"
              />
            </div>

            {/* Question count & option count */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Soru Sayısı</label>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 20, 30].map(n => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
                        questionCount === n
                          ? "bg-[var(--gold)] text-white shadow"
                          : "border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/30"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {type === "exam" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Şık Sayısı</label>
                  <div className="flex items-center gap-2">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        onClick={() => setOptionCount(n)}
                        className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
                          optionCount === n
                            ? "bg-[var(--gold)] text-white shadow"
                            : "border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--gold)]/30"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-[var(--background)] p-4">
              <h4 className="text-sm font-medium text-[var(--foreground)]">Özet</h4>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
                <span className="rounded-full bg-[var(--card)] px-3 py-1 border border-[var(--border)]">
                  {type === "exam" ? "Sınav" : "Anket"}
                </span>
                <span className="rounded-full bg-[var(--card)] px-3 py-1 border border-[var(--border)]">
                  {questionCount} soru
                </span>
                {type === "exam" && (
                  <span className="rounded-full bg-[var(--card)] px-3 py-1 border border-[var(--border)]">
                    {optionCount} şık
                  </span>
                )}
                {Array.from(selectedCompanyIds).map(id => {
                  const c = companies.find(x => x.id === id);
                  return c ? (
                    <span key={id} className="rounded-full bg-[var(--card)] px-3 py-1 border border-[var(--border)]">{c.name}</span>
                  ) : null;
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
              >
                Geri
              </button>
              <button
                onClick={generateWithAI}
                disabled={aiGenerating || !aiTopic.trim()}
                className="flex-[2] rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 text-sm font-semibold text-white shadow transition-all hover:brightness-110 disabled:opacity-50"
              >
                {aiGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    AI Soruları Oluşturuyor...
                  </span>
                ) : (
                  "AI ile Soruları Oluştur"
                )}
              </button>
            </div>

            {/* Manual option */}
            <div className="text-center">
              <button
                onClick={() => { setStep(3); }}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
              >
                veya soruları kendiniz ekleyin
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 3: Questions ============ */}
        {step === 3 && (
          <div className="space-y-4">
            {/* AI generated badge */}
            {questions.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span className="font-medium">{questions.length} soru oluşturuldu</span>
                  <span className="text-xs opacity-75">— düzenleyebilir, ekleyebilir veya silebilirsiniz</span>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Tekrar Oluştur
                </button>
              </div>
            )}

            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold)] text-xs font-bold text-white">{idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveQuestion(idx, "up")} disabled={idx === 0} className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-30">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button onClick={() => moveQuestion(idx, "down")} disabled={idx === questions.length - 1} className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-30">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <button onClick={() => removeQuestion(q.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={q.questionText}
                  onChange={e => updateQuestion(q.id, { questionText: e.target.value })}
                  placeholder="Soruyu yazın..."
                  className="mb-3 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                />

                <div className="mb-3 flex flex-wrap gap-2">
                  <select
                    value={q.questionType}
                    onChange={e => updateQuestion(q.id, { questionType: e.target.value as QuestionType })}
                    className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--foreground)]"
                  >
                    {Object.entries(questionTypeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {type === "exam" && (
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-[var(--muted-foreground)]">Puan:</label>
                      <input type="number" value={q.points} onChange={e => updateQuestion(q.id, { points: Number(e.target.value) })} min={1} className="w-16 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs" />
                    </div>
                  )}
                </div>

                {/* Options */}
                {(q.questionType === "multiple_choice" || q.questionType === "multi_select") && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">{opt.value}</span>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={e => updateOption(q.id, oi, { label: e.target.value })}
                          placeholder={`Seçenek ${opt.value}`}
                          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--gold)]/30"
                        />
                        {type === "exam" && (
                          <button
                            onClick={() => {
                              const newOptions = q.options.map((o, i) => ({
                                ...o,
                                isCorrect: q.questionType === "multiple_choice" ? i === oi : (i === oi ? !o.isCorrect : o.isCorrect),
                              }));
                              updateQuestion(q.id, { options: newOptions });
                            }}
                            className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                              opt.isCorrect
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {opt.isCorrect ? "Doğru" : "Yanlış"}
                          </button>
                        )}
                        {q.options.length > 2 && (
                          <button onClick={() => removeOption(q.id, oi)} className="rounded p-1 text-red-400 hover:text-red-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addOption(q.id)} className="text-xs text-[var(--gold)] hover:underline">+ Seçenek Ekle</button>
                  </div>
                )}

                {q.questionType === "yes_no" && (
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-center text-sm text-[var(--muted-foreground)]">Evet</div>
                    <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-center text-sm text-[var(--muted-foreground)]">Hayır</div>
                  </div>
                )}

                {q.questionType === "scale" && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-center text-sm text-[var(--muted-foreground)]">{n}</div>
                    ))}
                  </div>
                )}

                {q.questionType === "open_ended" && (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">
                    Açık uçlu metin alanı
                  </div>
                )}
              </div>
            ))}

            {/* Add question button */}
            <button
              onClick={addQuestion}
              className="w-full rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] py-6 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--gold)]/30 hover:text-[var(--gold)]"
            >
              <svg className="mx-auto mb-1" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Manuel Soru Ekle
            </button>

            {/* Save */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] py-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
              >
                Geri
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || questions.length === 0}
                className="flex-[2] rounded-xl bg-[var(--gold)] py-3 text-sm font-semibold text-white shadow hover:brightness-110 disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : `Kaydet (${questions.length} soru)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
