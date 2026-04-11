"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { searchAllMevzuat, extractISGKeywords, formatMevzuatRef, type MevzuatResult } from "@/lib/mevzuat-search";

// ─── Types ─────────────────────────────────────────────────────────────────

type Company = { id: string; display_name: string };
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    isOutOfScope?: boolean;
    hasSolution?: boolean;
    legalRefs?: string[];
    mevzuatResults?: MevzuatResult[];
    suggestedDocs?: DocSuggestion[];
  };
};
type DocSuggestion = {
  type: "procedure" | "training" | "risk_assessment" | "form" | "checklist";
  title: string;
  description: string;
};
type SavedQuery = {
  id: string;
  query_text: string;
  ai_response: string | null;
  is_saved: boolean;
  created_at: string;
};
type Scope = "workplace" | "general" | null;
type SideTab = "history" | "saved";

// ─── Constants ─────────────────────────────────────────────────────────────

const EXAMPLE_TOPICS = [
  { icon: "🔧", title: "Yüksekte Çalışma", desc: "Prosedür, KKD, eğitim gereksinimleri" },
  { icon: "⚗️", title: "Kimyasal Madde Güvenliği", desc: "SDS, depolama, acil müdahale" },
  { icon: "🚨", title: "İş Kazası Yönetimi", desc: "Bildirim, soruşturma, önleme" },
  { icon: "🏗️", title: "İnşaat Güvenliği", desc: "İskele, kazı, vinç güvenliği" },
  { icon: "🔥", title: "Acil Durum Planı", desc: "Tahliye, tatbikat, organizasyon" },
  { icon: "📋", title: "Risk Değerlendirmesi", desc: "Tehlike tanımlama, risk analizi" },
];

const btnPrimary = "inline-flex items-center gap-2 rounded-xl bg-[#0b5fc1] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0a4fa8] transition-colors disabled:opacity-50";
const btnSecondary = "inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors";
const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#0b5fc1]/40 resize-none dark:bg-slate-800 dark:text-white dark:border-slate-600";

// ─── Main Component ────────────────────────────────────────────────────────

export default function SolutionCenterClient() {
  // Session
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<Scope>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sessionStarted, setSessionStarted] = useState(false);

  // Voice
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Side panel
  const [history, setHistory] = useState<SavedQuery[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [sideTab, setSideTab] = useState<SideTab>("history");
  const [historyLoading, setHistoryLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Load data ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setHistoryLoading(true);
    const supabase = createClient();
    if (!supabase) { setHistoryLoading(false); return; }

    const [{ data: comps }, { data: hist }, { data: saved }] = await Promise.all([
      supabase.from("company_workspaces").select("id, display_name").eq("is_archived", false).order("display_name"),
      supabase.from("solution_queries").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("solution_queries").select("*").eq("is_saved", true).order("created_at", { ascending: false }).limit(20),
    ]);

    setCompanies(comps ?? []);
    setHistory((hist ?? []) as SavedQuery[]);
    setSavedQueries((saved ?? []) as SavedQuery[]);
    setHistoryLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Start session ───────────────────────────────────────────────────

  function startSession(topic?: string) {
    const welcome: Message = {
      id: "welcome",
      role: "assistant",
      content: topic
        ? `**${topic}** konusunda size yardımcı olacağım.\n\nÖnce durumu daha iyi anlamamız gerekiyor. Lütfen şunu belirtin:\n\n1. Bu konu **hangi işyeri/firma** ile ilgili, yoksa **genel bilgi** mi arıyorsunuz?\n2. Konuyu biraz daha detaylandırabilir misiniz? (Ne tür bir çalışma ortamı, kaç kişi etkileniyor, mevcut durum nedir?)`
        : "Merhaba! İSG Çözüm Merkezi'ne hoş geldiniz.\n\nİş Sağlığı ve Güvenliği ile ilgili sorununuzu veya aklınıza takılan konuyu anlatın. Adım adım birlikte çözüm bulalım.\n\n**Önemli:** Sadece İSG kapsamındaki konularda yardımcı olabilirim. Kapsam dışı konularda yönlendirme yapamam.",
      timestamp: new Date(),
    };
    setMessages([welcome]);
    setSessionStarted(true);
    if (topic) setInput("");
  }

  // ─── Send message ───────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await generateResponse(text, messages);
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: response.content,
        timestamp: new Date(),
        metadata: response.metadata,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Save to DB
      const supabase = createClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from("user_profiles").select("organization_id").eq("auth_user_id", user.id).single();
          await supabase.from("solution_queries").insert({
            user_id: user.id,
            organization_id: prof?.organization_id ?? null,
            query_text: text,
            ai_response: response.content,
            response_metadata: { scope, company_id: selectedCompany },
          });
          void loadData();
        }
      }
    } catch (err) {
      console.error("[SolutionCenter] error:", err);
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`, role: "assistant",
        content: "Bir hata oluştu. Lütfen tekrar deneyin.", timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  // ─── AI Response (placeholder until API route) ────────────────────────

  async function generateResponse(userText: string, history: Message[]): Promise<{ content: string; metadata?: Message["metadata"] }> {
    // Try API route first
    try {
      const res = await fetch("/api/solution-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userText,
          history: history.map((m) => ({ role: m.role, content: m.content })),
          scope,
          companyId: selectedCompany,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return { content: data.response, metadata: data.metadata };
      }
    } catch { /* API not ready */ }

    // Scope check
    const isgKeywords = ["isg", "iş güvenliği", "iş sağlığı", "risk", "kaza", "tehlike", "kkd", "koruyucu", "donanım", "eğitim", "prosedür", "acil durum", "tahliye", "yangın", "kimyasal", "yüksekte", "elektrik", "makine", "ergonomi", "gürültü", "toz", "6331", "mevzuat", "yönetmelik", "denetim", "tatbikat", "meslek hastalığı", "işyeri hekimi", "ramak kala", "osgb", "saha", "bulgu", "önlem", "kontrol", "muayene", "sağlık", "iş kazası", "havalandırma", "aydınlatma", "iskele", "inşaat", "maden"];
    const lower = userText.toLowerCase();
    const isISG = isgKeywords.some((k) => lower.includes(k)) || history.length > 2;

    if (!isISG && history.length <= 2) {
      return {
        content: "Bu konu İSG (İş Sağlığı ve Güvenliği) kapsamı dışında görünüyor.\n\nBen sadece İSG ile ilgili konularda yardımcı olabilirim:\n- Risk değerlendirmesi ve tehlike analizi\n- İş kazası önleme ve soruşturma\n- KKD seçimi ve kullanımı\n- Acil durum planları ve tatbikat\n- Çalışan eğitim ihtiyaçları\n- Mevzuat uyumu (6331, yönetmelikler)\n- Saha denetimleri ve bulgular\n- İşyeri hekimi / İGU görevleri\n\nLütfen İSG ile ilgili bir konu sorun.",
        metadata: { isOutOfScope: true },
      };
    }

    // Search mevzuat for relevant references
    const keywords = extractISGKeywords(userText);
    const allConversationText = [...history.filter((m) => m.role === "user").map((m) => m.content), userText].join(" ");
    const allKeywords = extractISGKeywords(allConversationText);
    const searchQuery = [...new Set([...keywords, ...allKeywords])].slice(0, 8).join(" ");
    const mevzuatResults = searchQuery ? await searchAllMevzuat(searchQuery, 5) : [];

    // Determine conversation stage
    const turnCount = history.filter((m) => m.role === "user").length;

    if (turnCount === 0) {
      // First message — understand + show initial mevzuat refs
      let mevzuatSection = "";
      if (mevzuatResults.length > 0) {
        mevzuatSection = "\n\n### İlgili Mevzuat (Ön Tarama)\n" +
          mevzuatResults.slice(0, 3).map((r) => `- **${formatMevzuatRef(r)}**`).join("\n") +
          "\n\n*Detaylı mevzuat analizi çözüm aşamasında yapılacaktır.*";
      }

      return {
        content: `Konunuzu inceliyorum.${mevzuatSection}\n\n**Daha doğru bir çözüm üretebilmem için birkaç sorum var:**\n\n1. Bu durum hangi **sektörde/çalışma ortamında** geçerli? (inşaat, üretim, ofis, maden vb.)\n2. Kaç **çalışan** etkileniyor?\n3. Daha önce bu konuda bir **önlem** alındı mı?\n4. **Acil** bir durum mu yoksa **planlama** aşamasında mısınız?\n\nBu bilgiler çözümün mevzuata uygunluğunu ve kapsamını belirlememe yardımcı olacak.`,
        metadata: { mevzuatResults: mevzuatResults.slice(0, 3) },
      };
    }

    if (turnCount === 1) {
      // Second turn — deeper analysis with mevzuat
      let mevzuatSection = "";
      if (mevzuatResults.length > 0) {
        mevzuatSection = "\n\n### İlgili Mevzuat\n" +
          mevzuatResults.map((r) => `- **${formatMevzuatRef(r)}**: ${r.content.slice(0, 150)}...`).join("\n");
      }

      return {
        content: `Teşekkürler, durumu daha iyi anlıyorum.\n\n**Ön Değerlendirme:**\n\n### 1. Mevcut Durum Analizi\n- Tehlike kaynakları belirlenmeli\n- Mevcut kontrol önlemleri değerlendirilmeli\n- Eksik noktalar tespit edilmeli\n\n### 2. Mevzuat Gereksinimleri${mevzuatSection || "\n- 6331 sayılı İSG Kanunu ilgili maddeleri\n- İlgili yönetmelik hükümleri"}\n\n**Devam etmeden önce:** Bu konuda bir **doküman** (prosedür, talimat) veya **eğitim materyali** hazırlamamı ister misiniz? Yoksa sadece bilgi ve yönlendirme yeterli mi?`,
        metadata: { mevzuatResults },
      };
    }

    // Third+ turn — full solution with mevzuat
    const companyName = selectedCompany ? companies.find((c) => c.id === selectedCompany)?.display_name : null;
    const scopeText = companyName ? `**${companyName}** firması için` : "genel olarak";

    let mevzuatSection = "\n\n### Mevzuat Dayanağı\n";
    if (mevzuatResults.length > 0) {
      mevzuatSection += mevzuatResults.map((r) =>
        `- **${formatMevzuatRef(r)}**\n  _"${r.content.slice(0, 200)}..."_`
      ).join("\n\n");
    } else {
      mevzuatSection += "- 6331 sayılı İSG Kanunu\n- İlgili yönetmelikler";
    }

    return {
      content: `## Çözüm Önerisi\n\n${scopeText} aşağıdaki adımları öneriyorum:\n\n### Yapılması Gerekenler\n1. **Risk Değerlendirmesi** — Mevcut tehlikelerin sistematik analizi\n2. **Kontrol Önlemleri** — Hiyerarşiye uygun önlem planı (kaynakta mücadele → toplu koruma → KKD)\n3. **Eğitim** — İlgili personele konuya özel İSG eğitimi\n4. **Dokümantasyon** — Prosedür/talimat hazırlanması\n5. **Takip** — Periyodik kontrol ve denetim planı${mevzuatSection}\n\n---\n\n**Aşağıdaki butonları kullanarak bu çözüm için doküman oluşturabilirsiniz.**`,
      metadata: {
        hasSolution: true,
        legalRefs: mevzuatResults.map((r) => formatMevzuatRef(r)),
        mevzuatResults,
        suggestedDocs: [
          { type: "procedure", title: "İSG Prosedürü", description: "Konuya özel çalışma prosedürü" },
          { type: "training", title: "Eğitim Materyali", description: "Personel eğitim sunumu" },
          { type: "risk_assessment", title: "Risk Değerlendirmesi", description: "Tehlike analiz formu" },
          { type: "checklist", title: "Kontrol Listesi", description: "Denetim/kontrol checklist" },
        ],
      },
    };
  }

  // ─── Create document ──────────────────────────────────────────────────

  async function handleCreateDoc(doc: DocSuggestion) {
    if (scope === "workplace" && !selectedCompany) {
      alert("Lütfen önce bir firma seçin.");
      return;
    }

    const supabase = createClient();
    if (!supabase) return;

    // Save document record
    const lastQuery = history[0];
    if (lastQuery) {
      await supabase.from("solution_documents").insert({
        query_id: lastQuery.id,
        doc_type: doc.type === "checklist" ? "form" : doc.type,
        doc_title: doc.title,
      });
    }

    const companyName = selectedCompany ? companies.find((c) => c.id === selectedCompany)?.display_name : "Genel";
    const infoMsg: Message = {
      id: `doc-${Date.now()}`,
      role: "assistant",
      content: `**${doc.title}** oluşturma talebi alındı.\n\n- Tür: ${doc.description}\n- Kapsam: ${scope === "workplace" ? `${companyName} firması` : "Genel bilgi"}\n${scope === "workplace" ? `- Firma dosyalarına eklenecek\n` : ""}\n*Doküman oluşturma özelliği yakında aktif olacaktır. Oluşturulan dokümanlar ${scope === "workplace" ? "ilgili firma sayfasında" : "genel dokümanlarınızda"} görünecektir.*`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, infoMsg]);
  }

  // ─── Voice ────────────────────────────────────────────────────────────

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Tarayıcınız ses tanıma desteklemiyor. Chrome veya Edge kullanın."); return; }

    const recognition = new SR();
    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;
    let final = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + " ";
        else interim = event.results[i][0].transcript;
      }
      setInput((prev) => {
        const base = prev.replace(/\u200B.*$/, "").trimEnd();
        return (base ? base + " " : "") + final + interim;
      });
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => { setIsListening(false); setInput((p) => p.trim()); };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  // ─── Image ────────────────────────────────────────────────────────────

  function handleImageSelect(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  // ─── Toggle save ──────────────────────────────────────────────────────

  async function toggleSave(id: string, saved: boolean) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("solution_queries").update({ is_saved: !saved }).eq("id", id);
    void loadData();
  }

  // ─── New session ──────────────────────────────────────────────────────

  function newSession() {
    setMessages([]);
    setSessionStarted(false);
    setScope(null);
    setSelectedCompany(null);
    setInput("");
    setImageFile(null);
    setImagePreview(null);
  }

  // ─── Format date ──────────────────────────────────────────────────────

  function fmtDate(iso: string) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "Az önce";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* ═══ Main Area ═══ */}
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ISG Çözüm Merkezi</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">İSG profesyonelinin yapay zeka destekli danışmanı</p>
          </div>
          {sessionStarted && (
            <button type="button" onClick={newSession} className={btnSecondary}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Yeni Soru
            </button>
          )}
        </div>

        {/* ── Pre-session: Scope + Topic ── */}
        {!sessionStarted && (
          <div className="space-y-4">
            {/* Scope selection */}
            <div className="rounded-[1.25rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)] space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Bu konu neyle ilgili?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setScope("workplace")}
                  className={["rounded-xl border-2 p-4 text-left transition-all", scope === "workplace" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"].join(" ")}>
                  <div className="text-lg mb-1">🏢</div>
                  <div className="text-sm font-medium text-foreground">Bir İşyeri İle İlgili</div>
                  <div className="text-xs text-muted-foreground mt-1">Belirli bir firmadaki sorun veya ihtiyaç. Oluşturulan dokümanlar firmaya eklenir.</div>
                </button>
                <button type="button" onClick={() => setScope("general")}
                  className={["rounded-xl border-2 p-4 text-left transition-all", scope === "general" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"].join(" ")}>
                  <div className="text-lg mb-1">📚</div>
                  <div className="text-sm font-medium text-foreground">Genel Bilgi</div>
                  <div className="text-xs text-muted-foreground mt-1">Mevzuat sorusu, genel İSG bilgisi veya kişisel öğrenme.</div>
                </button>
              </div>

              {/* Company selector (only for workplace) */}
              {scope === "workplace" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Firma Seçin</label>
                  <select
                    value={selectedCompany ?? ""}
                    onChange={(e) => setSelectedCompany(e.target.value || null)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0b5fc1]/40 dark:bg-slate-800 dark:text-white dark:border-slate-600"
                  >
                    <option value="">Firma seçin...</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                  </select>
                </div>
              )}

              {/* Start button */}
              {(scope === "general" || (scope === "workplace" && selectedCompany)) && (
                <button type="button" onClick={() => startSession()} className={btnPrimary + " w-full justify-center"}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Sorunu Anlatmaya Başla
                </button>
              )}
            </div>

            {/* Quick topics */}
            <div className="rounded-[1.25rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sık Sorulan Konular</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {EXAMPLE_TOPICS.map((t) => (
                  <button key={t.title} type="button"
                    onClick={() => { if (!scope) setScope("general"); startSession(t.title); }}
                    className="rounded-xl border border-border bg-secondary/20 p-3 text-left hover:bg-secondary/50 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{t.icon}</span>
                      <span className="text-xs font-medium text-foreground">{t.title}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Chat session ── */}
        {sessionStarted && (
          <>
            {/* Scope indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {scope === "workplace" && selectedCompany && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-primary font-medium">
                  🏢 {companies.find((c) => c.id === selectedCompany)?.display_name}
                </span>
              )}
              {scope === "general" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-muted-foreground font-medium">
                  📚 Genel Bilgi
                </span>
              )}
              <span>Oluşturulan dokümanlar {scope === "workplace" ? "firmaya eklenecek" : "genel arşivde kalacak"}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 min-h-[300px] max-h-[60vh] overflow-y-auto rounded-[1.25rem] border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={[
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : msg.metadata?.isOutOfScope
                        ? "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800/30 rounded-bl-md"
                        : "bg-secondary/60 text-foreground rounded-bl-md",
                  ].join(" ")}>
                    {/* Out of scope warning */}
                    {msg.metadata?.isOutOfScope && (
                      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        Kapsam Dışı Konu
                      </div>
                    )}

                    {/* Render content */}
                    {msg.content.split("\n").map((line, i) => {
                      if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(3)}</h2>;
                      if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold mt-2 mb-1">{line.slice(4)}</h3>;
                      if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc text-sm">{line.slice(2)}</li>;
                      if (line.match(/^\d+\.\s/)) return <li key={i} className="ml-4 list-decimal text-sm">{line.replace(/^\d+\.\s/, "")}</li>;
                      if (line.startsWith("---")) return <hr key={i} className="my-2 border-border" />;
                      if (line.trim() === "") return <br key={i} />;
                      return <p key={i} className="text-sm">{renderBold(line)}</p>;
                    })}

                    {/* Mevzuat references */}
                    {msg.metadata?.mevzuatResults && msg.metadata.mevzuatResults.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Mevzuat Referansları:</p>
                        <div className="space-y-1.5">
                          {msg.metadata.mevzuatResults.map((r, i) => (
                            <details key={i} className="group rounded-lg border border-border/50 bg-card/50">
                              <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs font-medium text-primary hover:bg-secondary/40 rounded-lg transition-colors">
                                <span className="text-[10px] text-muted-foreground">⚖️</span>
                                {formatMevzuatRef(r)}
                                <svg className="h-3 w-3 ml-auto text-muted-foreground group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </summary>
                              <div className="px-3 pb-2 text-[11px] text-muted-foreground leading-5 border-t border-border/30">
                                {r.content.slice(0, 300)}{r.content.length > 300 ? "..." : ""}
                              </div>
                            </details>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Doc suggestions */}
                    {msg.metadata?.hasSolution && msg.metadata.suggestedDocs && (
                      <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Doküman Oluştur:</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.metadata.suggestedDocs.map((doc) => (
                            <button key={doc.type} type="button" onClick={() => handleCreateDoc(doc)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary hover:border-primary/30 transition-colors shadow-sm">
                              {doc.type === "procedure" && "📄"}
                              {doc.type === "training" && "📊"}
                              {doc.type === "risk_assessment" && "📋"}
                              {doc.type === "checklist" && "✅"}
                              {doc.type === "form" && "📝"}
                              {doc.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-secondary/60 px-4 py-3 rounded-bl-md">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      Analiz ediliyor...
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div className="rounded-[1.25rem] border border-border bg-card p-4 shadow-[var(--shadow-soft)] space-y-3">
              {/* Image preview */}
              {imagePreview && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Ek görsel" className="h-16 w-16 rounded-lg object-cover border border-border" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs shadow">x</button>
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  rows={2}
                  className={inputCls + " flex-1"}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                <div className="flex flex-col gap-1.5">
                  <button type="button" onClick={handleSend} disabled={!input.trim() || loading}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b5fc1] text-white hover:bg-[#0a4fa8] disabled:opacity-50 transition-colors shadow-sm">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                  <button type="button" onClick={toggleVoice}
                    className={["flex h-10 w-10 items-center justify-center rounded-xl border border-border transition-colors shadow-sm",
                      isListening ? "bg-red-50 border-red-300 text-red-600 animate-pulse dark:bg-red-900/20 dark:text-red-400" : "bg-card text-muted-foreground hover:bg-secondary"
                    ].join(" ")}>
                    <svg className="h-4 w-4" fill={isListening ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  Görsel ekle
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); e.target.value = ""; }} />
                <span className="text-[10px] text-muted-foreground">Enter ile gönder · Shift+Enter yeni satır</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ Side Panel ═══ */}
      <div className="space-y-4">
        <div className="flex rounded-xl border border-border bg-secondary/50 p-0.5">
          {([["history", "Geçmiş"], ["saved", "Kaydedilenler"]] as [SideTab, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSideTab(k)}
              className={["flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all", sideTab === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"].join(" ")}>
              {l}
            </button>
          ))}
        </div>

        <div className="rounded-[1.25rem] border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
          {historyLoading ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-3 border-border border-t-[#0b5fc1]" /></div>
          ) : (
            <>
              {(sideTab === "history" ? history : savedQueries).length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center px-4">
                  <div className="text-2xl">{sideTab === "history" ? "📚" : "🔖"}</div>
                  <p className="text-xs text-muted-foreground">{sideTab === "history" ? "Henüz soru sormadınız" : "Kaydedilen çözüm yok"}</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                  {(sideTab === "history" ? history : savedQueries).map((q) => (
                    <div key={q.id} className="px-4 py-3 hover:bg-secondary/30 transition-colors">
                      <p className="text-xs font-medium text-foreground line-clamp-2">{q.query_text}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{fmtDate(q.created_at)}</span>
                        <button type="button" onClick={() => toggleSave(q.id, q.is_saved)}
                          className="text-[10px] text-muted-foreground hover:text-amber-500 transition-colors">
                          {q.is_saved ? "★" : "☆"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inline bold helper ──────────────────────────────────────────────────

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
