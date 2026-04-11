"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Building2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  FileStack,
  FileText,
  FileUp,
  Filter,
  GraduationCap,
  LayoutGrid,
  LibraryBig,
  Scale,
  ScrollText,
  Search,
  ShieldAlert,
  Siren,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumIconBadge, type PremiumIconTone } from "@/components/ui/premium-icon-badge";
import { DOCUMENT_GROUPS, type DocumentGroup } from "@/lib/document-groups";
import { createClient } from "@/lib/supabase/client";
import { fetchDocuments, type DocumentRecord } from "@/lib/supabase/document-api";
import { fetchBankQuestions } from "@/lib/supabase/question-bank-api";
import { fetchMyDecks, fetchOrgDecks, type SlideDeck } from "@/lib/supabase/slide-deck-api";
import { fetchSurveys, type SurveyRecord } from "@/lib/supabase/survey-api";

type BrowseView = "browse" | "history";
type SectionKey =
  | "all"
  | "documentation"
  | "education"
  | "assessment"
  | "forms"
  | "emergency"
  | "instructions"
  | "legal";
type MediaKind = "all" | "form" | "checklist" | "procedure" | "plan" | "visual" | "record";
type UploadDocType = "law" | "regulation" | "communique" | "guide" | "announcement" | "circular";

type CompanyOption = {
  id: string;
  workspace_id: string;
  name: string;
  sector: string;
  hazard_class: string;
  city: string;
};

type HistoryItem = {
  id: string;
  title: string;
  type: string;
  source: string;
  status: string;
  updatedAt: string;
  href: string;
};

type LegalDoc = {
  id: string;
  title: string;
  doc_type: string;
  doc_number?: string | null;
  chunk_count: number;
  source_url?: string | null;
};

const SECTION_META: Array<{
  key: SectionKey;
  label: string;
  icon: React.ElementType;
  tone: PremiumIconTone;
}> = [
  { key: "all", label: "Tum Icerikler", icon: LayoutGrid, tone: "gold" },
  { key: "documentation", label: "Dokumantasyon", icon: FileStack, tone: "cobalt" },
  { key: "education", label: "Egitim", icon: GraduationCap, tone: "emerald" },
  { key: "assessment", label: "Sinav ve Anket", icon: ClipboardCheck, tone: "violet" },
  { key: "forms", label: "Form ve Checklist", icon: FileCheck2, tone: "amber" },
  { key: "emergency", label: "Acil Durum", icon: Siren, tone: "orange" },
  { key: "instructions", label: "Talimatlar", icon: ScrollText, tone: "teal" },
  { key: "legal", label: "Mevzuat ve Rehberler", icon: Scale, tone: "indigo" },
];

const EDUCATION_GROUPS = new Set(["egitim-dosyasi", "is-giris-oryantasyon", "calisan-temsilcisi", "ilkyardim"]);
const FORMS_GROUPS = new Set(["kurul-kayitlari", "denetim-kontrol", "personel-ozluk", "periyodik-kontrol", "diger-kayitlar", "yillik-degerlendirme", "arac-makine"]);
const EMERGENCY_GROUPS = new Set(["acil-durum", "yangin-kimyasal", "kaza-olay"]);
const INSTRUCTION_GROUPS = new Set(["talimatlar", "prosedurler", "iletisim-yazisma"]);

function classifySection(groupKey: string): Exclude<SectionKey, "all" | "assessment" | "legal"> | "documentation" {
  if (EDUCATION_GROUPS.has(groupKey)) return "education";
  if (FORMS_GROUPS.has(groupKey)) return "forms";
  if (EMERGENCY_GROUPS.has(groupKey)) return "emergency";
  if (INSTRUCTION_GROUPS.has(groupKey)) return "instructions";
  return "documentation";
}

function getMediaKind(group: DocumentGroup): MediaKind {
  const text = `${group.title} ${group.items.map((item) => item.title).join(" ")}`.toLowerCase();
  if (text.includes("talimat") || text.includes("prosed")) return "procedure";
  if (text.includes("kontrol") || text.includes("check")) return "checklist";
  if (text.includes("plan")) return "plan";
  if (text.includes("fotograf") || text.includes("gorsel") || text.includes("kroki")) return "visual";
  if (text.includes("tutanak") || text.includes("kayit") || text.includes("rapor")) return "record";
  return "form";
}

function parseView(value: string | null): BrowseView {
  return value === "history" ? "history" : "browse";
}

function parseSection(value: string | null): SectionKey {
  return SECTION_META.some((item) => item.key === value) ? (value as SectionKey) : "all";
}

function parseMedia(value: string | null): MediaKind {
  return value === "form" || value === "checklist" || value === "procedure" || value === "plan" || value === "visual" || value === "record"
    ? value
    : "all";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function IsgLibraryClient() {
  const searchParams = useSearchParams();
  const initialCompanyId = searchParams.get("companyId") ?? "";
  const [view, setView] = useState<BrowseView>(() => parseView(searchParams.get("view")));
  const [section, setSection] = useState<SectionKey>(() => parseSection(searchParams.get("section")));
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [mediaKind, setMediaKind] = useState<MediaKind>(() => parseMedia(searchParams.get("media")));
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialCompanyId);
  const [userName, setUserName] = useState("Kullanici");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [decks, setDecks] = useState<SlideDeck[]>([]);
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<UploadDocType>("guide");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNumber, setUploadNumber] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLibrary() {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, organization_id, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        setLoading(false);
        return;
      }

      setProfileId(profile.id);
      setUserName(profile.full_name || user.email || "Kullanici");

      const { data: workspaces } = await supabase
        .from("company_workspaces")
        .select("id, company_identity_id, display_name")
        .eq("organization_id", profile.organization_id);

      if (workspaces && workspaces.length > 0) {
        const identityIds = workspaces.map((workspace) => workspace.company_identity_id);
        const { data: identities } = await supabase
          .from("company_identities")
          .select("id, official_name, sector, hazard_class, city")
          .in("id", identityIds);

        if (identities) {
          const nextCompanies = identities.map((identity) => {
            const workspace = workspaces.find((item) => item.company_identity_id === identity.id);
            return {
              id: identity.id,
              workspace_id: workspace?.id || "",
              name: identity.official_name || workspace?.display_name || "",
              sector: identity.sector || "",
              hazard_class: identity.hazard_class || "",
              city: identity.city || "",
            };
          });
          setCompanies(nextCompanies);
          if (!initialCompanyId && nextCompanies.length === 1) {
            setSelectedCompanyId(nextCompanies[0].id);
          }
        }
      }

      const [allDocuments, allSurveys, allQuestions, myDecks, orgDecks, mevzuatResponse] = await Promise.all([
        fetchDocuments(profile.organization_id),
        fetchSurveys(profile.organization_id),
        fetchBankQuestions(),
        fetchMyDecks(),
        fetchOrgDecks(),
        supabase.functions.invoke("sync-mevzuat", { body: { action: "list" } }),
      ]);

      const deckMap = new Map([...myDecks, ...orgDecks].map((deck) => [deck.id, deck]));

      setDocuments(allDocuments);
      setSurveys(allSurveys);
      setQuestionCount(allQuestions.length);
      setDecks([...deckMap.values()]);
      setLegalDocs(Array.isArray(mevzuatResponse.data) ? (mevzuatResponse.data as LegalDoc[]) : []);
      setLoading(false);
    }

    void loadLibrary();
  }, [initialCompanyId]);

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) || null;
  const selectedDocuments = useMemo(
    () =>
      !selectedCompany
        ? []
        : documents.filter((doc) => {
            if (doc.company_workspace_id === selectedCompany.workspace_id) {
              return true;
            }

            const scopedCompanyId = doc.variables_data?.__company_identity_id;
            return (
              doc.company_workspace_id === null &&
              doc.prepared_by === profileId &&
              typeof scopedCompanyId === "string" &&
              scopedCompanyId === selectedCompany.id
            );
          }),
    [documents, profileId, selectedCompany],
  );
  const selectedSurveys = useMemo(
    () => (!selectedCompanyId ? [] : surveys.filter((survey) => survey.companyId === selectedCompanyId)),
    [selectedCompanyId, surveys],
  );
  const visibleGroups = useMemo(() => {
    let groups = DOCUMENT_GROUPS.filter((group) => {
      if (section === "all") return true;
      if (section === "assessment" || section === "legal") return false;
      return classifySection(group.key) === section;
    });

    if (mediaKind !== "all") {
      groups = groups.filter((group) => getMediaKind(group) === mediaKind);
    }

    if (!query) return groups;
    const normalized = query.toLowerCase();
    return groups.filter((group) => group.title.toLowerCase().includes(normalized) || group.items.some((item) => item.title.toLowerCase().includes(normalized)));
  }, [mediaKind, query, section]);
  const legalItems = useMemo(() => {
    const filtered = !query ? legalDocs : legalDocs.filter((doc) => doc.title.toLowerCase().includes(query.toLowerCase()));
    return {
      legislation: filtered.filter((doc) => doc.doc_type !== "guide"),
      guides: filtered.filter((doc) => doc.doc_type === "guide"),
    };
  }, [legalDocs, query]);
  const historyItems = useMemo<HistoryItem[]>(() => {
    if (!selectedCompany) return [];
    return [
      ...selectedDocuments.slice(0, 8).map((doc) => ({
        id: doc.id,
        title: doc.title,
        type: "Dokuman",
        source: selectedCompany.name,
        status: doc.status,
        updatedAt: doc.updated_at,
        href: `/documents/${doc.id}`,
      })),
      ...selectedSurveys.slice(0, 6).map((survey) => ({
        id: survey.id,
        title: survey.title,
        type: survey.type === "exam" ? "Sinav" : "Anket",
        source: selectedCompany.name,
        status: survey.status,
        updatedAt: survey.updatedAt,
        href: `/training/${survey.id}`,
      })),
      ...decks.slice(0, 4).map((deck) => ({
        id: deck.id,
        title: deck.title,
        type: "Slayt",
        source: "Egitim",
        status: deck.source === "ai_generated" ? "AI" : "Hazir",
        updatedAt: deck.updated_at,
        href: `/training/slides/${deck.id}`,
      })),
    ]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 12);
  }, [decks, selectedCompany, selectedDocuments, selectedSurveys]);

  async function handleUploadSubmit() {
    if (!uploadTitle.trim() || !uploadFile) {
      setUploadMessage("Baslik ve dosya zorunlu.");
      return;
    }

    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append("title", uploadTitle.trim());
      formData.append("docType", uploadType);
      formData.append("docNumber", uploadNumber.trim());
      formData.append("file", uploadFile);

      const response = await fetch("/api/legal-library-upload", { method: "POST", body: formData });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Yukleme basarisiz.");
      }

      setLegalDocs((current) => [
        { id: payload.id, title: payload.title, doc_type: payload.docType, source_url: payload.sourceUrl, chunk_count: 1 },
        ...current,
      ]);
      setShowUploadModal(false);
      setUploadTitle("");
      setUploadNumber("");
      setUploadFile(null);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Yukleme sirasinda hata olustu.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-48 animate-pulse rounded-[2rem] bg-black/5 dark:bg-white/5" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-[1.75rem] bg-black/5 dark:bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ISG Kutuphanesi"
        title={SECTION_META.find((item) => item.key === section)?.label || "ISG Kutuphanesi"}
        description="Firma bazli dokumantasyon, AI destekli egitim ve sinav akislari, rehberler ve mevzuat kayitlari tek merkezde."
        className="overflow-hidden border-white/60 bg-[linear-gradient(120deg,rgba(255,249,240,0.96),rgba(237,245,255,0.96),rgba(250,246,226,0.94))] shadow-[var(--shadow-elevated)] dark:border-white/8 dark:bg-[linear-gradient(120deg,rgba(16,24,39,0.98),rgba(12,23,41,0.97),rgba(28,24,17,0.96))]"
        meta={
          <>
            <span className="inline-flex items-center rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)]">{userName}</span>
            <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">{selectedCompany ? `${selectedCompany.name} secili` : "Firma secimi bekleniyor"}</span>
          </>
        }
      />
      <section className="rounded-[2rem] border border-border/80 bg-card/95 p-4 shadow-[var(--shadow-card)] sm:p-6">
        <div className="grid gap-3 2xl:grid-cols-[minmax(320px,0.95fr)_180px_220px_220px_minmax(0,1fr)_auto]">
          <label className="relative">
            <Building2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)} className="h-14 w-full rounded-[1.2rem] border border-border bg-background pl-11 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-[var(--gold)]/40">
              <option value="">Firma secin</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 rounded-[1.2rem] border border-border bg-background p-1">
            {(["browse", "history"] as BrowseView[]).map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={`flex-1 rounded-[0.95rem] px-4 py-2 text-sm font-semibold transition-colors ${view === item ? "bg-[var(--primary)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {item === "browse" ? "Browse" : "History"}
              </button>
            ))}
          </div>

          <label className="relative">
            <Filter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select value={section} onChange={(event) => setSection(event.target.value as SectionKey)} className="h-14 w-full rounded-[1.2rem] border border-border bg-background pl-11 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-[var(--gold)]/40">
              {SECTION_META.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="relative">
            <Filter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select value={mediaKind} onChange={(event) => setMediaKind(event.target.value as MediaKind)} className="h-14 w-full rounded-[1.2rem] border border-border bg-background pl-11 pr-4 text-sm font-medium text-foreground outline-none transition focus:border-[var(--gold)]/40">
              <option value="all">Tum tipler</option>
              <option value="form">Form</option>
              <option value="checklist">Checklist</option>
              <option value="procedure">Talimat / Prosedur</option>
              <option value="plan">Plan</option>
              <option value="visual">Gorsel</option>
              <option value="record">Kayit / Rapor</option>
            </select>
          </label>

          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Belge sinifi, egitim, anket, rehber ara..." className="h-14 w-full rounded-[1.2rem] border border-border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-[var(--gold)]/40" />
          </label>

          <button
            type="button"
            onClick={() => {
              setSelectedCompanyId("");
              setView("browse");
              setSection("all");
              setMediaKind("all");
              setQuery("");
            }}
            className="inline-flex h-14 items-center justify-center rounded-[1.2rem] bg-[var(--primary)] px-6 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Temizle
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {selectedCompany ? (
            <>
              <span className="rounded-full border border-border bg-background px-3 py-1.5 font-medium">{selectedCompany.sector || "Sektor belirtilmedi"}</span>
              <span className="rounded-full border border-border bg-background px-3 py-1.5 font-medium">{selectedCompany.hazard_class || "Tehlike sinifi belirtilmedi"}</span>
              {selectedCompany.city ? <span className="rounded-full border border-border bg-background px-3 py-1.5 font-medium">{selectedCompany.city}</span> : null}
              <span className="rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-3 py-1.5 font-semibold text-[var(--primary)]">
                {selectedDocuments.length} dokuman · {selectedDocuments.filter((doc) => doc.status === "hazir").length} hazir
              </span>
            </>
          ) : (
            <span className="rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-3 py-1.5 font-semibold text-[var(--primary)]">
              Kutuphane icerigini acmak ve firma bazli kaydi izlemek icin once firma secin.
            </span>
          )}
        </div>
      </section>
      {!selectedCompany ? (
        <section className="rounded-[2rem] border border-dashed border-[var(--gold)]/30 bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <PremiumIconBadge icon={Building2} tone="gold" size="lg" className="mx-auto" />
          <h2 className="mt-5 text-2xl font-semibold text-foreground">Firma secimi gerekli</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Hangi firmaya hangi dokumanlarin, sinavlarin ve iceriklerin hazirlandigini kayit altina almak icin kutuphane firma secimiyle baslar.
          </p>
        </section>
      ) : view === "history" ? (
        <section className="rounded-[2rem] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Gecmis</h2>
              <p className="text-sm text-muted-foreground">{selectedCompany.name} icin son erisilen dokuman, sinav ve egitim icerikleri.</p>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">{historyItems.length} kayit</span>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-border">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_160px_160px_160px_130px] gap-4 bg-background px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
              <span>Icerik</span>
              <span>Tip</span>
              <span>Kaynak</span>
              <span>Tarih</span>
              <span>Durum</span>
            </div>
            {historyItems.map((item) => (
              <Link key={`${item.type}-${item.id}`} href={item.href} className="grid gap-2 border-t border-border/70 px-5 py-4 transition hover:bg-background/70 md:grid-cols-[minmax(0,1.4fr)_160px_160px_160px_130px] md:items-center md:gap-4 first:border-t-0">
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground md:hidden">{item.type} · {item.source}</p>
                </div>
                <span className="hidden text-sm text-muted-foreground md:block">{item.type}</span>
                <span className="hidden text-sm text-muted-foreground md:block">{item.source}</span>
                <span className="hidden text-sm text-muted-foreground md:block">{formatDate(item.updatedAt)}</span>
                <span className="inline-flex w-fit rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <>
          {section === "all" ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <FeatureCard icon={GraduationCap} tone="emerald" title="Egitim Merkezi" description="AI destekli egitim akislari, slayt kutuphanesi ve sertifikalar." href={`/training?companyId=${selectedCompanyId}&library=1&librarySection=education`} badge="AI" />
              <FeatureCard icon={ClipboardCheck} tone="violet" title="Sinav ve Anket" description="Firma baglaminda sinavlar, anketler ve soru bankasi." href={`/training?companyId=${selectedCompanyId}&tab=all&library=1&librarySection=assessment`} badge="Olcum" />
              <FeatureCard icon={Scale} tone="indigo" title="Mevzuat ve Rehberler" description="Resmi mevzuat kayitlari ve bakanlik rehberleri tek kart akisinda." href="/isg-library?section=legal" badge="RAG" />
              <UploadTriggerCard icon={FileUp} tone="gold" title="Rehber veya mevzuat yukle" description="Kullanici yuklemeleriyle kutuphaneyi zenginlestirin." badge="Yukleme" onClick={() => { setUploadType("guide"); setUploadMessage(null); setShowUploadModal(true); }} />
              {visibleGroups.map((group) => (
                <DocClassCard key={group.key} group={group} companyId={selectedCompanyId} documents={selectedDocuments} />
              ))}
            </section>
          ) : null}

          {section === "assessment" ? (
            <section className="grid gap-4 xl:grid-cols-3">
              <FeatureCard icon={ClipboardCheck} tone="violet" title="Anket Merkezi" description="Katilim odakli AI destekli anketler, sonuc takibi ve dagitim." href={`/training?companyId=${selectedCompanyId}&tab=survey&library=1&librarySection=assessment`} badge="Anket" />
              <FeatureCard icon={ShieldAlert} tone="cobalt" title="Sinav Merkezi" description="AI ile soru seti, basari puani ve sinav dagitimi." href={`/training?companyId=${selectedCompanyId}&tab=exam&library=1&librarySection=assessment`} badge="Sinav" />
              <FeatureCard icon={Sparkles} tone="gold" title="Soru Bankasi" description={`${questionCount} aktif soru ile tekrar kullanilabilir AI havuzu.`} href={`/training/question-bank?companyId=${selectedCompanyId}&library=1&librarySection=assessment`} badge="AI" />
            </section>
          ) : null}

          {section === "education" ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <FeatureCard icon={LibraryBig} tone="teal" title="Slayt Kutuphanesi" description="AI destekli slayt desteleri, kurum ici veya ozel egitim akislari." href={`/training/slides?companyId=${selectedCompanyId}&library=1&librarySection=education`} badge="Slayt" />
              <FeatureCard icon={FileCheck2} tone="gold" title="Sertifika ve Kayitlar" description={`${decks.length} egitim varligi ve sertifika akislarini yonetin.`} href={`/training/certificates?companyId=${selectedCompanyId}&library=1&librarySection=education`} badge="Kayit" />
              {visibleGroups.map((group) => (
                <DocClassCard key={group.key} group={group} companyId={selectedCompanyId} documents={selectedDocuments} />
              ))}
            </section>
          ) : null}

          {section === "legal" ? (
            <section className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FeatureCard icon={Scale} tone="indigo" title="Mevzuat Senkronizasyonu" description="Resmi mevzuat kayitlari, chunk sayisi ve RAG baglantilari." href="/settings?tab=mevzuat" badge="RAG" />
                <UploadTriggerCard icon={FileUp} tone="indigo" title="Mevzuat Yukle" description="Kanun, yonetmelik, teblig veya genelge yukleyin." badge="Yukleme" onClick={() => { setUploadType("regulation"); setUploadMessage(null); setShowUploadModal(true); }} />
                <UploadTriggerCard icon={BookOpen} tone="gold" title="Rehber Yukle" description="Bakanlik veya kurumsal rehberleri kutuphaneye ekleyin." badge="Rehber" onClick={() => { setUploadType("guide"); setUploadMessage(null); setShowUploadModal(true); }} />
                <FeatureCard icon={FileText} tone="cobalt" title="Dokuman Yukleme Akisi" description="Firma bazli dokuman yukleme ve AI ile duzenleme icin dokumantasyona gecin." href={`/documents?companyId=${selectedCompanyId}&library=1&librarySection=documentation`} badge="Dokuman" />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">Resmi Mevzuat</h2>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{legalItems.legislation.length} kayit</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {legalItems.legislation.map((doc) => (
                    <LegalDocCard key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">Rehberler</h2>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{legalItems.guides.length} kayit</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {legalItems.guides.map((doc) => (
                    <LegalDocCard key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {section !== "all" && section !== "assessment" && section !== "education" && section !== "legal" ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleGroups.map((group) => (
                <DocClassCard key={group.key} group={group} companyId={selectedCompanyId} documents={selectedDocuments} />
              ))}
            </section>
          ) : null}
        </>
      )}
      {showUploadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Rehber veya mevzuat yukle</h2>
                <p className="mt-1 text-sm text-muted-foreground">Yuklenen dosya kutuphaneye eklenir. Metin okunabiliyorsa ilk arama chunk&apos;i de otomatik olusturulur.</p>
              </div>
              <button type="button" onClick={() => setShowUploadModal(false)} className="rounded-full border border-border bg-background px-3 py-1 text-sm text-muted-foreground hover:text-foreground">Kapat</button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Belge tipi</span>
                <select value={uploadType} onChange={(event) => setUploadType(event.target.value as UploadDocType)} className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-[var(--gold)]/40">
                  <option value="law">Kanun</option>
                  <option value="regulation">Yonetmelik</option>
                  <option value="communique">Teblig</option>
                  <option value="guide">Rehber</option>
                  <option value="announcement">Duyuru</option>
                  <option value="circular">Genelge</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Belge / resmi sayi</span>
                <input value={uploadNumber} onChange={(event) => setUploadNumber(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-[var(--gold)]/40" placeholder="Opsiyonel" />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-foreground">Baslik</span>
                <input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none focus:border-[var(--gold)]/40" placeholder="Orn. Kimyasal maddelerle calismalarda rehber" />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-foreground">Dosya</span>
                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} className="block w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--gold)]/10 file:px-3 file:py-2 file:font-medium file:text-[var(--primary)]" />
              </label>
            </div>

            {uploadMessage ? <p className="mt-4 text-sm text-[var(--primary)]">{uploadMessage}</p> : null}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowUploadModal(false)} className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground">Iptal</button>
              <button type="button" onClick={() => void handleUploadSubmit()} disabled={uploading} className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {uploading ? "Yukleniyor..." : "Kutuphane kaydi olustur"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LibraryCardVisual({
  icon: Icon,
  tone,
  title,
  badge,
}: {
  icon: React.ElementType;
  tone: PremiumIconTone;
  title: string;
  badge: string;
}) {
  const surfaceTone =
    tone === "gold" ? "from-[var(--gold)]/22 via-yellow-100/35 to-transparent dark:from-[var(--gold)]/24 dark:via-slate-900/20 dark:to-slate-950/15" :
    tone === "emerald" ? "from-emerald-500/18 via-teal-100/25 to-transparent dark:from-emerald-500/26 dark:via-slate-900/20 dark:to-slate-950/15" :
    tone === "violet" ? "from-violet-500/18 via-fuchsia-100/25 to-transparent dark:from-violet-500/26 dark:via-slate-900/20 dark:to-slate-950/15" :
    tone === "indigo" ? "from-indigo-500/18 via-indigo-100/25 to-transparent dark:from-indigo-500/26 dark:via-slate-900/20 dark:to-slate-950/15" :
    tone === "teal" ? "from-teal-500/18 via-cyan-100/25 to-transparent dark:from-teal-500/26 dark:via-slate-900/20 dark:to-slate-950/15" :
    tone === "amber" ? "from-amber-500/18 via-yellow-100/25 to-transparent dark:from-amber-500/26 dark:via-slate-900/20 dark:to-slate-950/15" :
    tone === "orange" ? "from-orange-500/18 via-amber-100/25 to-transparent dark:from-orange-500/26 dark:via-slate-900/20 dark:to-slate-950/15" :
    "from-blue-500/18 via-sky-100/25 to-transparent dark:from-blue-500/26 dark:via-slate-900/20 dark:to-slate-950/15";

  return (
    <div className={`relative overflow-hidden rounded-[1.35rem] border border-white/45 bg-gradient-to-br ${surfaceTone} p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
      <div className="absolute -right-6 -top-10 h-24 w-24 rounded-full bg-white/45 blur-2xl dark:bg-white/10" />
      <div className="absolute bottom-0 left-6 h-16 w-16 rounded-full bg-white/35 blur-2xl dark:bg-white/5" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{badge}</p>
          <p className="mt-2 line-clamp-2 max-w-[180px] text-base font-semibold text-foreground">{title}</p>
        </div>
        <PremiumIconBadge icon={Icon} tone={tone} size="md" />
      </div>
      <div className="relative mt-4 h-px bg-white/65 dark:bg-white/10" />
    </div>
  );
}

function FeatureCard({
  icon,
  tone,
  title,
  description,
  href,
  badge,
}: {
  icon: React.ElementType;
  tone: PremiumIconTone;
  title: string;
  description: string;
  href: string;
  badge: string;
}) {
  return (
    <Link href={href} className="rounded-[1.7rem] border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--gold)]/30">
      <LibraryCardVisual icon={icon} tone={tone} title={title} badge={badge} />
      <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">Ac <ChevronRight size={16} /></span>
    </Link>
  );
}

function UploadTriggerCard({
  icon,
  tone,
  title,
  description,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  tone: PremiumIconTone;
  title: string;
  description: string;
  badge: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="rounded-[1.7rem] border border-border bg-card p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--gold)]/30">
      <LibraryCardVisual icon={icon} tone={tone} title={title} badge={badge} />
      <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">Yukleme baslat <ChevronRight size={16} /></span>
    </button>
  );
}

function DocClassCard({
  group,
  companyId,
  documents,
}: {
  group: DocumentGroup;
  companyId: string;
  documents: DocumentRecord[];
}) {
  const section = classifySection(group.key);
  const href = `/documents?group=${group.key}&companyId=${companyId}&library=1&librarySection=${section}`;
  const preparedCount = documents.filter((doc) => doc.group_key === group.key).length;
  const readyCount = documents.filter((doc) => doc.group_key === group.key && doc.status === "hazir").length;
  const tone: PremiumIconTone =
    section === "documentation" ? "cobalt" :
    section === "forms" ? "amber" :
    section === "emergency" ? "orange" :
    section === "education" ? "emerald" :
    "teal";

  return (
    <Link href={href} className="rounded-[1.7rem] border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--gold)]/30">
      <LibraryCardVisual icon={FileText} tone={tone} title={group.title} badge={getMediaKind(group)} />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{group.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{group.items.length} hazir baslik. Bu firmada {preparedCount} kayit, {readyCount} hazir dokuman var.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {group.items.slice(0, 3).map((item) => (
          <span key={item.id} className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">{item.title}</span>
        ))}
      </div>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">Kartlari ac <ChevronRight size={16} /></span>
    </Link>
  );
}

function LegalDocCard({ doc }: { doc: LegalDoc }) {
  const tone: PremiumIconTone = doc.doc_type === "guide" ? "gold" : doc.doc_type === "law" ? "indigo" : "cobalt";
  const kindLabel = doc.doc_type === "guide" ? "Rehber" : doc.doc_type === "law" ? "Kanun" : doc.doc_type === "regulation" ? "Yonetmelik" : "Mevzuat";

  return (
    <div className="rounded-[1.7rem] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <LibraryCardVisual icon={doc.doc_type === "guide" ? BookOpen : Scale} tone={tone} title={doc.title} badge={`${doc.chunk_count} chunk`} />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{doc.title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{kindLabel}{doc.doc_number ? ` · ${doc.doc_number}` : ""}. RAG ve arama akislarinda kullanilabilir.</p>
      {doc.source_url ? (
        <a href={doc.source_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">Kaynagi ac <ChevronRight size={16} /></a>
      ) : (
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)]">Kayit hazir</span>
      )}
    </div>
  );
}
