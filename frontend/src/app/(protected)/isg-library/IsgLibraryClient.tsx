"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import {
  Building2,
  Check,
  ChevronDown,
  ClipboardCheck,
  Download,
  Eye,
  FileBadge,
  FileCheck2,
  FilePenLine,
  FileText,
  Filter,
  GraduationCap,
  LayoutGrid,
  Link2,
  ScrollText,
  Search,
  Siren,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCUMENT_GROUPS } from "@/lib/document-groups";
import { getTemplate } from "@/lib/document-templates-p1";
import { createClient } from "@/lib/supabase/client";
import { fetchDocuments } from "@/lib/supabase/document-api";
import { fetchBankQuestions } from "@/lib/supabase/question-bank-api";
import { fetchOrgDecks, fetchMyDecks } from "@/lib/supabase/slide-deck-api";
import { fetchSurveys } from "@/lib/supabase/survey-api";
import {
  assignLibraryContentToCompany,
  fetchCompanyLibraryItems,
  fetchLibraryContents,
  type CompanyLibraryItemRecord,
  type LibraryContentRecord,
} from "@/lib/supabase/isg-library-api";
import type { DocumentRecord } from "@/lib/supabase/document-api";
import { cn } from "@/lib/utils";

type CategoryKey =
  | "all"
  | "documentation"
  | "education"
  | "assessment"
  | "forms"
  | "emergency"
  | "instructions"
  | "legal";

type SortKey = "newest" | "oldest" | "az" | "za";

type CompanyOption = {
  id: string;
  name: string;
  sector: string;
  hazardClass: string;
  city: string;
};

type UserContext = {
  profileId: string | null;
  fullName: string;
  canManageCatalog: boolean;
};

type UnifiedLibraryItem = {
  id: string;
  title: string;
  description: string;
  category: Exclude<CategoryKey, "all">;
  subcategory: string;
  contentType: string;
  tags: string[];
  sector: string[];
  createdAt: string;
  viewHref: string | null;
  downloadHref: string | null;
  libraryContentId: string | null;
  sourceKind: "catalog" | "template" | "survey" | "deck" | "question-bank";
  templateId?: string | null;
  usageCount?: number;
};

type PreviewState = {
  title: string;
  description: string;
  content: JSONContent | null;
} | null;

type CategoryDefinition = {
  key: CategoryKey;
  label: string;
  icon: LucideIcon;
  subcategories: string[];
};

type CustomSubcategoryMap = Partial<Record<Exclude<CategoryKey, "all">, string[]>>;

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  { key: "all", label: "Tümü", icon: LayoutGrid, subcategories: [] },
  {
    key: "documentation",
    label: "Dokümantasyon",
    icon: FileText,
    subcategories: DOCUMENT_GROUPS.map((group) => group.title),
  },
  {
    key: "education",
    label: "Eğitim",
    icon: GraduationCap,
    subcategories: ["Temel İSG Eğitimi", "Mesleki Eğitim", "Acil Durum Eğitimi", "Yenileme Eğitimleri"],
  },
  {
    key: "assessment",
    label: "Sınav ve Anket",
    icon: ClipboardCheck,
    subcategories: ["Sınavlar", "Anketler", "Değerlendirme Formları", "Ölçme ve İzleme"],
  },
  {
    key: "forms",
    label: "Form ve Checklist",
    icon: FileCheck2,
    subcategories: ["Günlük Kontroller", "Periyodik Kontroller", "Denetim Formları"],
  },
  {
    key: "emergency",
    label: "Acil Durum",
    icon: Siren,
    subcategories: ["Acil Durum Planları", "Tahliye", "Yangın", "Tatbikat", "Toplanma Alanları"],
  },
  {
    key: "instructions",
    label: "Talimatlar",
    icon: ScrollText,
    subcategories: ["Makine Talimatları", "İş Akışı Talimatları", "KKD Talimatları", "Saha Uygulamaları"],
  },
];

const MANAGE_ROLE_CODES = new Set([
  "super_admin",
  "platform_admin",
  "organization_admin",
  "osgb_manager",
  "ohs_specialist",
]);

function createTemplateDescription(groupTitle: string, itemTitle: string) {
  return `${groupTitle} altında yer alan "${itemTitle}" şablonunu doküman akışı içinde açabilirsiniz.`;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCategory(value: string | null): CategoryKey {
  if (!value) return "all";
  const normalized = slugify(value);
  const match = CATEGORY_DEFINITIONS.find(
    (item) => item.key === normalized || slugify(item.label) === normalized,
  );
  return match?.key ?? "all";
}

function normalizeCategory(value: string | null | undefined): Exclude<CategoryKey, "all"> | null {
  if (!value) return null;
  const normalized = slugify(value);

  switch (normalized) {
    case "documentation":
    case "dokumantasyon":
      return "documentation";
    case "education":
    case "egitim":
      return "education";
    case "assessment":
    case "sinav-ve-anket":
    case "sinav-anket":
      return "assessment";
    case "forms":
    case "form-ve-checklist":
    case "formlar":
      return "forms";
    case "emergency":
    case "acil-durum":
      return "emergency";
    case "instructions":
    case "talimatlar":
      return "instructions";
    case "legal":
    case "mevzuat-ve-rehberler":
    case "mevzuat-rehberler":
      return "legal";
    default:
      return null;
  }
}

function parseSort(value: string | null): SortKey {
  if (value === "oldest" || value === "az" || value === "za") return value;
  return "newest";
}

function getSubcategoryOptions(category: CategoryKey) {
  return CATEGORY_DEFINITIONS.find((item) => item.key === category)?.subcategories ?? [];
}

function parseSubcategory(value: string | null, category: CategoryKey) {
  if (!value || category === "all") return "";
  const options = getSubcategoryOptions(category);
  const normalized = slugify(value);
  const match = options.find((item) => slugify(item) === normalized);
  return match ?? "";
}

function getContentTypeMeta(type: string | null) {
  const normalized = (type ?? "").toLowerCase();

  if (normalized.includes("video")) return { label: "Video", icon: Video };
  if (normalized.includes("link")) return { label: "Link", icon: Link2 };
  if (normalized.includes("doc")) return { label: "DOCX", icon: FileBadge };
  return { label: (type ?? "PDF").toUpperCase(), icon: FileText };
}

function buildAddContentHref(category: CategoryKey) {
  switch (category) {
    case "education":
      return "/training/new";
    case "assessment":
      return "/training/question-bank";
    case "legal":
      return "/settings?tab=mevzuat";
    default:
      return "/documents/new";
  }
}

function buildDocumentEditorHref(
  category: CategoryKey,
  subcategory: string,
  options?: {
    mode?: "new" | "custom";
    companyId?: string;
    templateId?: string;
    title?: string;
  },
) {
  const params = new URLSearchParams();
  const matchingGroup = DOCUMENT_GROUPS.find((group) => group.title === subcategory);
  const mode = options?.mode ?? "new";

  if (matchingGroup) {
    params.set("group", matchingGroup.key);
  }

  if (options?.companyId) {
    params.set("companyId", options.companyId);
  }

  if (options?.templateId) {
    params.set("templateId", options.templateId);
  }

  params.set("mode", mode);
  params.set("library", "1");
  params.set("librarySection", category === "all" ? "documentation" : category);

  const title =
    options?.title || subcategory || CATEGORY_DEFINITIONS.find((item) => item.key === category)?.label || "Yeni Doküman";
  params.set("title", mode === "custom" ? `${title} Taslağı` : title);

  return `/documents/new?${params.toString()}`;
}

function getSubcategoryBadgeMeta(category: CategoryKey) {
  switch (category) {
    case "documentation":
      return {
        label: "Dosya",
        className: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "education":
      return {
        label: "Eğitim",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "assessment":
      return {
        label: "Akış",
        className: "border-violet-200 bg-violet-50 text-violet-700",
      };
    case "forms":
      return {
        label: "Form",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "emergency":
      return {
        label: "Plan",
        className: "border-red-200 bg-red-50 text-red-700",
      };
    case "instructions":
      return {
        label: "Talimat",
        className: "border-teal-200 bg-teal-50 text-teal-700",
      };
    case "legal":
      return {
        label: "Mevzuat",
        className: "border-indigo-200 bg-indigo-50 text-indigo-700",
      };
    default:
      return {
        label: "Kategori",
        className: "border-slate-200 bg-slate-50 text-slate-700",
      };
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function LibraryGridSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-52 rounded-[2rem]" />
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-11 min-w-32 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="overflow-hidden border-border/70 bg-card/90">
            <CardHeader className="space-y-4">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-11 w-full rounded-2xl" />
              <Skeleton className="h-11 w-full rounded-2xl" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState(props: {
  title: string;
  description: string;
  canManageCatalog: boolean;
  addHref: string;
}) {
  return (
    <section className="rounded-[2rem] border border-dashed border-[var(--gold)]/30 bg-card/95 px-6 py-12 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-[var(--gold)]/25 bg-[var(--gold)]/10 text-[var(--gold)]">
        <LayoutGrid size={28} />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-foreground">{props.title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        {props.description}
      </p>
      {props.canManageCatalog ? (
        <div className="mt-6">
          <Link
            href={props.addHref}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            İçerik Ekle
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function IsgLibraryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialCategory = parseCategory(searchParams.get("category") ?? searchParams.get("section"));

  const [category, setCategory] = useState<CategoryKey>(initialCategory);
  const [subcategory, setSubcategory] = useState(() => parseSubcategory(searchParams.get("subcategory"), initialCategory));
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get("type") ?? "all");
  const [sectorFilter, setSectorFilter] = useState(() => searchParams.get("sector") ?? "all");
  const [sortBy, setSortBy] = useState<SortKey>(() => parseSort(searchParams.get("sort")));
  const [savedOnly, setSavedOnly] = useState(() => searchParams.get("saved") === "1");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [userContext, setUserContext] = useState<UserContext>({
    profileId: null,
    fullName: "RiskNova Kullanıcısı",
    canManageCatalog: false,
  });
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [contents, setContents] = useState<LibraryContentRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [legacyItems, setLegacyItems] = useState<UnifiedLibraryItem[]>([]);
  const [savedItems, setSavedItems] = useState<CompanyLibraryItemRecord[]>([]);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignContent, setAssignContent] = useState<LibraryContentRecord | null>(null);
  const [assignCompanyId, setAssignCompanyId] = useState("");
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [importingDocument, setImportingDocument] = useState(false);
  const [creationCompanyId, setCreationCompanyId] = useState("");
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [customSubcategories, setCustomSubcategories] = useState<CustomSubcategoryMap>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const companyMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();

    if (category !== "all") params.set("category", category);
    if (subcategory) params.set("subcategory", slugify(subcategory));
    if (query.trim()) params.set("q", query.trim());
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (sectorFilter !== "all") params.set("sector", sectorFilter);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (savedOnly) params.set("saved", "1");

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl);
  }, [category, pathname, query, router, savedOnly, sectorFilter, sortBy, subcategory, typeFilter]);

  useEffect(() => {
    if (!companies.length) return;
    setCreationCompanyId((current) =>
      current && companies.some((company) => company.id === current) ? current : companies[0]?.id ?? "",
    );
  }, [companies]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!companyMenuRef.current?.contains(event.target as Node)) {
        setCompanyMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("risknova:isg-library-custom-subcategories");
      if (!raw) return;
      const parsed = JSON.parse(raw) as CustomSubcategoryMap;
      setCustomSubcategories(parsed);
    } catch {
      // Ignore malformed local storage entries.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "risknova:isg-library-custom-subcategories",
      JSON.stringify(customSubcategories),
    );
  }, [customSubcategories]);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setErrorMessage(null);

      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) {
          setErrorMessage("Supabase bağlantısı kurulamadı.");
          setLoading(false);
        }
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setErrorMessage("Oturum bulunamadı.");
          setLoading(false);
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, organization_id, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (profileError || !profile?.organization_id) {
        if (!cancelled) {
          setErrorMessage("Kullanıcı profili yüklenemedi.");
          setLoading(false);
        }
        return;
      }

      const [rolesResponse, workspaceResponse, libraryResponse, documentsResponse, surveysResponse, questionBankResponse, myDecksResponse, orgDecksResponse] = await Promise.all([
        supabase.from("user_roles").select("roles(code)").eq("user_profile_id", profile.id),
        supabase
          .from("company_workspaces")
          .select(`
            display_name,
            company_identity_id,
            company_identities!inner(
              id,
              official_name,
              sector,
              hazard_class,
              city
            )
          `)
          .eq("organization_id", profile.organization_id)
          .order("display_name", { ascending: true }),
        fetchLibraryContents(),
        fetchDocuments(profile.organization_id),
        fetchSurveys(profile.organization_id),
        fetchBankQuestions(),
        fetchMyDecks(),
        fetchOrgDecks(),
      ]);

      const roleCodes = (rolesResponse.data ?? []).flatMap((item) => {
        const rolesValue = (item as { roles?: { code?: string } | Array<{ code?: string }> }).roles;
        if (Array.isArray(rolesValue)) {
          return rolesValue.map((role) => role.code ?? "").filter(Boolean);
        }
        return rolesValue?.code ? [rolesValue.code] : [];
      });

      const accessibleCompanies = ((workspaceResponse.data ?? []) as Array<{
        display_name: string | null;
        company_identity_id: string;
        company_identities:
          | {
              id: string;
              official_name: string | null;
              sector: string | null;
              hazard_class: string | null;
              city: string | null;
            }
          | Array<{
              id: string;
              official_name: string | null;
              sector: string | null;
              hazard_class: string | null;
              city: string | null;
            }>;
      }>).flatMap((row) => {
        const identity = Array.isArray(row.company_identities)
          ? row.company_identities[0]
          : row.company_identities;

        if (!identity) return [];

        return [{
          id: identity.id ?? row.company_identity_id,
          name: identity.official_name || row.display_name || "İsimsiz Firma",
          sector: identity.sector || "",
          hazardClass: identity.hazard_class || "",
          city: identity.city || "",
        }];
      });

      const companyIds = accessibleCompanies.map((item) => item.id);
      const savedRows = await fetchCompanyLibraryItems(companyIds);
      const legacyCatalogItems: UnifiedLibraryItem[] = [
        ...DOCUMENT_GROUPS.flatMap((group) => {
          const matchingDocs = documentsResponse.filter((doc) => doc.group_key === group.key);

          return group.items.map((groupItem, index) => ({
            id: `template-${group.key}-${groupItem.id}`,
            title: groupItem.title,
            description: createTemplateDescription(group.title, groupItem.title),
            category: "documentation" as const,
            subcategory: group.title,
            contentType: "Şablon",
            tags: [
              `Dosya ${DOCUMENT_GROUPS.findIndex((entry) => entry.key === group.key) + 1}`,
              groupItem.isP1 ? "P1" : "Hazır",
              groupItem.isP2 ? "P2" : "Şablon",
            ],
            sector: [],
            createdAt: matchingDocs[index]?.updated_at ?? new Date().toISOString(),
            viewHref: `/documents?group=${group.key}`,
            downloadHref: null,
            libraryContentId: null,
            sourceKind: "template" as const,
            templateId: groupItem.id,
          }));
        }),
        ...surveysResponse.map((survey) => ({
          id: `survey-${survey.id}`,
          title: survey.title,
          description: survey.description || `${survey.type === "exam" ? "Sınav" : "Anket"} akışını görüntüleyin ve yönetin.`,
          category: "assessment" as const,
          subcategory: survey.type === "exam" ? "Sınavlar" : "Anketler",
          contentType: survey.type === "exam" ? "Sınav" : "Anket",
          tags: [survey.status, survey.type === "exam" ? "ölçme" : "geri bildirim"],
          sector: [],
          createdAt: survey.updatedAt,
          viewHref: `/training/${survey.id}`,
          downloadHref: null,
          libraryContentId: null,
          sourceKind: "survey" as const,
          templateId: null,
        })),
        ...[...myDecksResponse, ...orgDecksResponse].map((deck) => ({
          id: `deck-${deck.id}`,
          title: deck.title,
          description: deck.description || "Hazır eğitim içeriğini açın ve sunum akışını yönetin.",
          category: "education" as const,
          subcategory: "Mesleki Eğitim",
          contentType: "Sunum",
          tags: [...(deck.tags ?? [])].slice(0, 3),
          sector: [],
          createdAt: deck.updated_at,
          viewHref: `/training/slides/${deck.id}`,
          downloadHref: null,
          libraryContentId: null,
          sourceKind: "deck" as const,
          templateId: null,
        })),
        {
          id: "question-bank-overview",
          title: "Soru Bankası",
          description: `${questionBankResponse.length} aktif soru ile değerlendirme ve ölçme akışlarını yönetin.`,
          category: "assessment",
          subcategory: "Ölçme ve İzleme",
          contentType: "Soru Bankası",
          tags: ["AI", "ölçme", "takip"],
          sector: [],
          createdAt: new Date().toISOString(),
          viewHref: "/training/question-bank",
          downloadHref: null,
          libraryContentId: null,
          sourceKind: "question-bank",
          templateId: null,
        },
      ];

      if (!cancelled) {
        setUserContext({
          profileId: profile.id,
          fullName: profile.full_name || user.email || "RiskNova Kullanıcısı",
          canManageCatalog: roleCodes.some((code) => MANAGE_ROLE_CODES.has(code)),
        });
        setCompanies(accessibleCompanies);
        setContents(libraryResponse);
        setDocuments(documentsResponse);
        setLegacyItems(legacyCatalogItems);
        setSavedItems(savedRows);
        setLoading(false);
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeout = window.setTimeout(() => setStatusMessage(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const savedContentIds = useMemo(
    () => new Set(savedItems.map((item) => item.content_id)),
    [savedItems],
  );

  const allItems = useMemo<UnifiedLibraryItem[]>(() => {
    const catalogItems = contents.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || "Bu içerik için kısa açıklama henüz eklenmedi.",
      category: normalizeCategory(item.category) ?? "documentation",
      subcategory: item.subcategory,
      contentType: item.content_type || "PDF",
      tags: item.tags ?? [],
      sector: item.sector ?? [],
      createdAt: item.created_at,
      viewHref: item.file_url,
      downloadHref: item.file_url,
      libraryContentId: item.id,
      sourceKind: "catalog" as const,
      templateId: null,
    }));

    return [...catalogItems, ...legacyItems];
  }, [contents, legacyItems]);

  const savedCompaniesByContent = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const item of savedItems) {
      const current = map.get(item.content_id) ?? [];
      current.push(item.company_id);
      map.set(item.content_id, current);
    }

    return map;
  }, [savedItems]);

  const templateUsageCounts = useMemo(() => {
    const map = new Map<string, number>();

    for (const doc of documents) {
      const key = doc.template_id || `${doc.group_key}::${doc.title}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return map;
  }, [documents]);

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(
        allItems
          .map((item) => item.contentType?.trim())
          .filter((item): item is string => Boolean(item)),
      ),
    ).sort((left, right) => left.localeCompare(right, "tr"));
  }, [allItems]);

  const sectorOptions = useMemo(() => {
    return Array.from(
      new Set(allItems.flatMap((item) => item.sector ?? []).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right, "tr"));
  }, [allItems]);

  const filteredContents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    const nextItems = allItems.filter((item) => {
      const itemSubcategorySlug = slugify(item.subcategory);
      const matchesCategory = category === "all" ? true : item.category === category;
      const matchesSubcategory = subcategory ? itemSubcategorySlug === slugify(subcategory) : true;
      const matchesSaved = savedOnly ? Boolean(item.libraryContentId && savedContentIds.has(item.libraryContentId)) : true;
      const matchesType =
        typeFilter === "all"
          ? true
          : item.contentType.toLocaleLowerCase("tr-TR") === typeFilter.toLocaleLowerCase("tr-TR");
      const matchesSector = sectorFilter === "all" ? true : item.sector.includes(sectorFilter);
      const haystack = [
        item.title,
        item.category,
        item.subcategory,
        item.description,
        ...item.tags,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      const matchesQuery = normalizedQuery ? haystack.includes(normalizedQuery) : true;

      return matchesCategory && matchesSubcategory && matchesSaved && matchesType && matchesSector && matchesQuery;
    });

    return [...nextItems].sort((left, right) => {
      switch (sortBy) {
        case "oldest":
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        case "az":
          return left.title.localeCompare(right.title, "tr");
        case "za":
          return right.title.localeCompare(left.title, "tr");
        case "newest":
        default:
          return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
    });
  }, [allItems, category, query, savedContentIds, savedOnly, sectorFilter, sortBy, subcategory, typeFilter]);

  const hydratedContents = useMemo(
    () =>
      filteredContents.map((item) => {
        if (item.sourceKind !== "template") return item;

        const usageCount =
          templateUsageCounts.get(item.templateId ?? "") ??
          templateUsageCounts.get(`${DOCUMENT_GROUPS.find((group) => group.title === item.subcategory)?.key ?? ""}::${item.title}`) ??
          0;

        return {
          ...item,
          usageCount,
        };
      }),
    [filteredContents, templateUsageCounts],
  );

  const activeCategoryMeta = CATEGORY_DEFINITIONS.find((item) => item.key === category) ?? CATEGORY_DEFINITIONS[0];
  const selectedCreationCompany = companies.find((company) => company.id === creationCompanyId) ?? null;
  const subcategoryOptions = useMemo(() => {
    if (category === "all") return [];
    const baseOptions = getSubcategoryOptions(category);
    const customOptions = customSubcategories[category] ?? [];
    return [...baseOptions, ...customOptions];
  }, [category, customSubcategories]);

  function handleCategoryChange(nextCategory: CategoryKey) {
    setCategory(nextCategory);

    if (nextCategory === "all") {
      setSubcategory("");
      return;
    }

    const nextOptions =
      nextCategory === "all"
        ? []
        : [...getSubcategoryOptions(nextCategory), ...(customSubcategories[nextCategory] ?? [])];
    setSubcategory((current) => (current && nextOptions.includes(current) ? current : ""));
  }

  function handleCreateSubcategory() {
    if (category === "all") {
      setErrorMessage("Önce bir ana kategori seçin.");
      return;
    }

    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setErrorMessage("Kategori adı boş bırakılamaz.");
      return;
    }

    const exists = subcategoryOptions.some((item) => slugify(item) === slugify(trimmedName));
    if (exists) {
      setErrorMessage("Bu alt kategori zaten mevcut.");
      return;
    }

    setCustomSubcategories((current) => ({
      ...current,
      [category]: [...(current[category] ?? []), trimmedName],
    }));
    setSubcategory(trimmedName);
    setNewCategoryName("");
    setCategoryModalOpen(false);
    setErrorMessage(null);
    setStatusMessage(`“${trimmedName}” alt kategorisi oluşturuldu.`);
  }

  function openAssignModal(content: LibraryContentRecord) {
    const alreadyAssigned = new Set(savedCompaniesByContent.get(content.id) ?? []);
    const firstAvailable = companies.find((company) => !alreadyAssigned.has(company.id))?.id ?? companies[0]?.id ?? "";

    setAssignContent(content);
    setAssignCompanyId(firstAvailable);
    setAssignMessage(null);
    setAssignModalOpen(true);
  }

  async function handlePreview(item: UnifiedLibraryItem) {
    if (item.sourceKind !== "template" || !item.templateId) {
      if (item.viewHref) {
        window.open(item.viewHref, item.viewHref.startsWith("/") ? "_self" : "_blank", "noreferrer");
      }
      return;
    }

    setPreviewLoading(true);
    setPreviewState({
      title: item.title,
      description: item.description,
      content: null,
    });

    try {
      const template = await getTemplate(item.templateId);
      setPreviewState({
        title: template?.title ?? item.title,
        description: template?.description ?? item.description,
        content:
          template?.content ??
          ({
            type: "doc",
            content: [
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: item.title }] },
              { type: "paragraph", content: [{ type: "text", text: item.description }] },
            ],
          } as JSONContent),
      });
    } catch {
      setErrorMessage("Şablon önizlemesi yüklenemedi. Lütfen tekrar deneyin.");
      setPreviewState(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload(item: UnifiedLibraryItem) {
    if (item.sourceKind !== "template" || !item.templateId) {
      if (item.downloadHref) {
        window.open(item.downloadHref, item.downloadHref.startsWith("/") ? "_self" : "_blank", "noreferrer");
      }
      return;
    }

    try {
      const template = await getTemplate(item.templateId);
      const content =
        template?.content ??
        ({
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: item.title }] },
            { type: "paragraph", content: [{ type: "text", text: item.description }] },
          ],
        } as JSONContent);

      const html = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(template?.title ?? item.title)}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 40px; color: #0f172a; line-height: 1.6; }
      h1,h2,h3 { color: #102033; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }
      ul, ol { padding-left: 24px; }
      hr { border: none; border-top: 1px solid #cbd5e1; margin: 20px 0; }
    </style>
  </head>
  <body>
    ${renderJsonNodeToHtml(content)}
  </body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(template?.title ?? item.title) || "dokuman"}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("İndirme dosyası oluşturulamadı. Lütfen tekrar deneyin.");
    }
  }

  function handleEdit(item: UnifiedLibraryItem) {
    if (!creationCompanyId) {
      setErrorMessage("Lütfen önce üst alandan firma seçin.");
      return;
    }

    if (item.sourceKind !== "template") {
      setErrorMessage("Düzenleme şu an yalnızca şablon kartlarında destekleniyor.");
      return;
    }

    router.push(
      buildDocumentEditorHref(item.category, item.subcategory, {
        companyId: creationCompanyId,
        templateId: item.templateId ?? undefined,
        title: item.title,
      }),
    );
  }

  async function processImportedFile(file: File) {
    if (!selectedCreationCompany) {
      setErrorMessage("Lütfen önce içerik oluşturulacak firmayı seçin.");
      return;
    }

    setImportingDocument(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentTitle", subcategory || activeCategoryMeta.label || "Yeni Doküman");

      const matchingGroup = DOCUMENT_GROUPS.find((group) => group.title === subcategory);
      if (matchingGroup) {
        formData.append("groupKey", matchingGroup.key);
      }
      formData.append("companyName", selectedCreationCompany.name);
      formData.append("sector", selectedCreationCompany.sector);
      formData.append("hazardClass", selectedCreationCompany.hazardClass);

      const res = await fetch("/api/document-import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setErrorMessage("Dosya yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
        return;
      }

      const data = await res.json();
      sessionStorage.setItem("importedContent", data.content);

      const params = new URLSearchParams();
      if (matchingGroup) {
        params.set("group", matchingGroup.key);
      }
      params.set("companyId", selectedCreationCompany.id);
      params.set("title", subcategory || activeCategoryMeta.label || "Yeni Doküman");
      params.set("mode", "import");
      params.set("library", "1");
      params.set("librarySection", category === "all" ? "documentation" : category);

      router.push(`/documents/new?${params.toString()}`);
    } catch {
      setErrorMessage("Bağlantı hatası nedeniyle dosya yüklenemedi.");
    } finally {
      setImportingDocument(false);
    }
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void processImportedFile(file);
    }
    event.target.value = "";
  }

  async function handleAssignSubmit() {
    if (!assignContent || !assignCompanyId) {
      setAssignMessage("Lütfen bir firma seçin.");
      return;
    }

    setAssigning(true);
    setAssignMessage(null);

    const savedRow = await assignLibraryContentToCompany({
      companyId: assignCompanyId,
      contentId: assignContent.id,
      addedBy: userContext.profileId,
    });

    if (!savedRow) {
      setAssigning(false);
      setAssignMessage("Kayıt oluşturulamadı. Lütfen tekrar deneyin.");
      return;
    }

    setSavedItems((current) => {
      const withoutDuplicate = current.filter(
        (item) => !(item.company_id === savedRow.company_id && item.content_id === savedRow.content_id),
      );
      return [savedRow, ...withoutDuplicate];
    });
    setStatusMessage(`“${assignContent.title}” seçilen firmaya kaydedildi.`);
    setAssigning(false);
    setAssignModalOpen(false);
  }

  if (loading) {
    return <LibraryGridSkeleton />;
  }

  const emptyTitle =
    category === "all"
      ? "Henüz içerik bulunmuyor"
      : `${activeCategoryMeta.label} kategorisinde henüz içerik bulunmuyor`;

  const emptyDescription =
    savedOnly
      ? "Firmalarınıza kaydedilmiş içerik bulunamadı. Bir içeriği kart üzerinden firmaya atayarak bu görünümde listeleyebilirsiniz."
      : "Bu kategoride henüz içerik bulunmuyor. İçerikler eklendiğinde burada kart görünümüyle listelenecek.";

  const contentCards = hydratedContents.map((item) => {
    const typeMeta = getContentTypeMeta(item.contentType);
    const TypeIcon = typeMeta.icon;
    const assignedCompanyIds = item.libraryContentId
      ? (savedCompaniesByContent.get(item.libraryContentId) ?? [])
      : [];
    const availableCompanies = companies.filter((company) => !assignedCompanyIds.includes(company.id));
    const isFullyAssigned = companies.length > 0 && availableCompanies.length === 0;
    const canAssign = Boolean(item.libraryContentId);
    const sourceBadge =
      item.sourceKind === "template"
        ? "Şablon"
        : item.sourceKind === "survey"
          ? "Akış"
          : item.sourceKind === "deck"
            ? "Sunum"
            : item.sourceKind === "question-bank"
              ? "Banka"
              : "Katalog";

    return (
      <Card
        key={item.id}
        className="overflow-hidden border-border bg-card dark:border-white/10"
      >
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/85 px-3 py-1 text-xs font-semibold text-foreground">
              <TypeIcon size={14} />
              {typeMeta.label}
            </span>
            {item.sourceKind === "template" ? (
              <span className="inline-flex items-center rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]">
                {item.usageCount ?? 0} kullanım
              </span>
            ) : assignedCompanyIds.length > 0 ? (
              <span className="inline-flex items-center rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]">
                {assignedCompanyIds.length} firmada
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                {sourceBadge}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <CardTitle className="text-xl leading-snug">{item.title}</CardTitle>
            <p className="line-clamp-2 min-h-11 text-sm leading-6 text-muted-foreground">
              {item.description || "Bu içerik için kısa açıklama henüz eklenmedi."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">
              {CATEGORY_DEFINITIONS.find((entry) => entry.key === item.category)?.label ?? item.category}
            </Badge>
            <Badge variant="neutral">{item.subcategory}</Badge>
            {item.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="accent">
                {tag}
              </Badge>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handlePreview(item)}
              className={cn(
                "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition",
                item.viewHref || item.sourceKind === "template"
                  ? "border-border bg-background text-foreground hover:border-[var(--gold)]/35"
                  : "pointer-events-none border-border/60 bg-muted/40 text-muted-foreground",
              )}
              disabled={!item.viewHref && item.sourceKind !== "template"}
            >
              <Eye size={16} />
              Görüntüle
            </button>
            <button
              type="button"
              onClick={() => void handleDownload(item)}
              className={cn(
                "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition",
                item.downloadHref || item.sourceKind === "template"
                  ? "border-border bg-background text-foreground hover:border-[var(--gold)]/35"
                  : "pointer-events-none border-border/60 bg-muted/40 text-muted-foreground",
              )}
              disabled={!item.downloadHref && item.sourceKind !== "template"}
            >
              <Download size={16} />
              İndir
            </button>
            <button
              type="button"
              onClick={() => handleEdit(item)}
              className={cn(
                "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition",
                item.sourceKind === "template" && creationCompanyId
                  ? "border-border bg-background text-foreground hover:border-[var(--gold)]/35"
                  : "pointer-events-none border-border/60 bg-muted/40 text-muted-foreground",
              )}
              disabled={item.sourceKind !== "template" || !creationCompanyId}
            >
              <FilePenLine size={16} />
              Düzenle
            </button>
          </div>

          <button
            type="button"
            onClick={() => canAssign ? openAssignModal({
              id: item.libraryContentId!,
              title: item.title,
              description: item.description,
              category: item.category,
              subcategory: item.subcategory,
              content_type: item.contentType,
              file_url: item.viewHref,
              tags: item.tags,
              sector: item.sector,
              created_at: item.createdAt,
            }) : undefined}
            disabled={companies.length === 0 || isFullyAssigned || !canAssign}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition",
              companies.length === 0 || isFullyAssigned || !canAssign
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-[var(--primary)] text-white hover:brightness-110",
            )}
          >
            {isFullyAssigned ? <Check size={16} /> : <Building2 size={16} />}
            {isFullyAssigned ? "Tüm firmalara kaydedildi" : canAssign ? "Firmaya Ata" : "Katalog kaydı bekleniyor"}
          </button>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.sourceKind === "template" ? `${item.usageCount ?? 0} kez dokümana dönüştürüldü` : item.sector.slice(0, 2).join(", ") || "Genel kullanım"}</span>
            <span>{formatDate(item.createdAt)}</span>
          </div>
        </CardContent>
      </Card>
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="İSG Kütüphanesi"
        title="İSG Kütüphanesi"
        description="Global katalog yapısıyla doküman, eğitim, sınav, form, acil durum ve mevzuat içeriklerini firma seçmeden inceleyin; ihtiyaç duyduğunuz içeriği sonradan firmanıza kaydedin."
        className="relative overflow-visible border-border bg-card dark:text-slate-100"
        meta={
          <>
            <span className="inline-flex items-center rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)] dark:text-[#f3c978]">
              {userContext.fullName}
            </span>
            <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              {allItems.length} içerik
            </span>
            <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
              {savedContentIds.size} içerik firmalara kaydedildi
            </span>
          </>
        }
        actions={
          <>
            <div className="min-w-[260px]" ref={companyMenuRef}>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/90">
                Çalışılan Firma
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCompanyMenuOpen((current) => !current)}
                  className="flex h-12 w-full items-center justify-between rounded-2xl border border-[var(--gold)]/25 bg-background/85 px-4 text-sm text-foreground outline-none transition focus:border-[var(--gold)]/45 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Building2 size={16} className="shrink-0 text-[var(--gold)]/90" />
                    <span className="truncate text-left">
                      {selectedCreationCompany?.name || "Firma seçin"}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "shrink-0 text-[var(--gold)]/90 transition-transform",
                      companyMenuOpen ? "rotate-180" : "",
                    )}
                  />
                </button>

                {companyMenuOpen ? (
                  <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900">
                    <div className="max-h-72 overflow-y-auto p-2">
                      {companies.map((company) => {
                        const isSelected = company.id === creationCompanyId;

                        return (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => {
                              setCreationCompanyId(company.id);
                              setCompanyMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition",
                              isSelected
                                ? "bg-[var(--primary)] text-white"
                                : "text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10",
                            )}
                          >
                            <span className="pr-3 leading-6">{company.name}</span>
                            {isSelected ? <Check size={15} className="shrink-0" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSavedOnly((current) => !current)}
              className={cn(
                "inline-flex h-11 items-center rounded-2xl border px-4 text-sm font-semibold transition",
                savedOnly
                  ? "border-[var(--gold)]/35 bg-[var(--gold)]/12 text-[var(--primary)]"
                  : "border-border bg-background/85 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              Firmama Kaydedilenler
            </button>
          </>
        }
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/95 p-4 shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-[rgba(15,23,42,0.82)] sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-14 h-40 w-40 rounded-[2rem] border border-[var(--gold)]/10 bg-[radial-gradient(circle,rgba(184,134,11,0.08),transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 translate-x-[-20%] translate-y-[35%] rotate-12 rounded-[1.5rem] border border-slate-200/60 bg-white/30 dark:border-white/10 dark:bg-white/5" />

        <div className="grid grid-cols-2 gap-3 pb-2 md:grid-cols-3 xl:grid-cols-7">
          {CATEGORY_DEFINITIONS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === category;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleCategoryChange(item.key)}
                className={cn(
                  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[1rem] border px-4 py-3 text-[14px] font-semibold transition-all duration-200 sm:px-5",
                  isActive
                    ? "border-[var(--gold)] bg-[var(--gold)] text-primary-foreground shadow-[var(--shadow-card)]"
                    : "border-border bg-card text-muted-foreground hover:border-[var(--gold)]/40 hover:text-foreground",
                )}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_180px_180px_160px]">
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Başlık, açıklama veya etiket ara..."
              className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-[var(--gold)]/40"
            />
          </label>

          <label className="relative">
            <Filter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-[var(--gold)]/40"
            >
              <option value="all">Tip</option>
              {typeOptions.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="relative">
            <Building2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sectorFilter}
              onChange={(event) => setSectorFilter(event.target.value)}
              className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-[var(--gold)]/40"
            >
              <option value="all">Sektör</option>
              {sectorOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="relative">
            <Filter size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(parseSort(event.target.value))}
              className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-[var(--gold)]/40"
            >
              <option value="newest">Sırala</option>
              <option value="newest">En yeni</option>
              <option value="oldest">En eski</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
            </select>
          </label>
        </div>

        {category !== "all" ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-[1.5rem] border border-border bg-muted/30 p-3">
              <div className="mb-3 flex items-center gap-2 px-2">
                <Filter size={16} className="text-[var(--gold)]" />
                <span className="text-sm font-semibold text-foreground">Alt Kategoriler</span>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSubcategory("")}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-left text-sm transition",
                    !subcategory
                      ? "bg-[var(--primary)] text-white shadow-[0_18px_35px_rgba(15,23,42,0.18)]"
                      : "bg-white/70 text-[#6f4e12] hover:border-[#e3c58f] hover:bg-white dark:border-white/5 dark:bg-white/5 dark:text-[#f8ddb0] dark:hover:border-[#6f5320] dark:hover:bg-white/10",
                  )}
                >
                  <span className="font-medium">Tüm alt kategoriler</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      !subcategory
                        ? "border-white/20 bg-white/15 text-white"
                        : "border-[#e3c58f] bg-white text-[#9b6f1b] dark:border-[#6f5320] dark:bg-white/10 dark:text-[#f0c36b]",
                    )}
                  >
                    Tümü
                  </span>
                </button>

                {subcategoryOptions.map((item) => {
                  const badgeMeta = getSubcategoryBadgeMeta(category);

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSubcategory(item)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl border border-transparent px-4 py-3 text-left text-sm transition",
                        subcategory === item
                          ? "bg-[var(--primary)] text-white shadow-[0_18px_35px_rgba(15,23,42,0.18)]"
                          : "bg-white/70 text-[#6f4e12] hover:border-[#e3c58f] hover:bg-white dark:border-white/5 dark:bg-white/5 dark:text-[#f8ddb0] dark:hover:border-[#6f5320] dark:hover:bg-white/10",
                      )}
                    >
                      <span className="pr-3 font-medium leading-6">{item}</span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          subcategory === item
                            ? "border-white/20 bg-white/15 text-white"
                            : badgeMeta.className,
                        )}
                      >
                        {badgeMeta.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-[#e3c58f] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryName("");
                    setCategoryModalOpen(true);
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/12 px-4 text-sm font-semibold text-[var(--primary)] transition hover:border-[var(--gold)]/45 hover:bg-[var(--gold)]/18"
                >
                  Kategori Ekle
                </button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
                    {activeCategoryMeta.label}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-foreground">
                    {subcategory || "Tüm alt kategoriler"}
                  </h2>
                </div>
                <span className="inline-flex items-center rounded-full border border-[#e3c58f] bg-white/75 px-3 py-1 text-xs font-semibold text-[#8b6513] dark:border-[#6f5320] dark:bg-white/10 dark:text-[#f0c36b]">
                  {filteredContents.length} sonuç
                </span>
              </div>

              {filteredContents.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-[#e3c58f] bg-white/45 px-6 py-10 text-center dark:border-[#6f5320] dark:bg-white/5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-[#e3c58f] bg-white/80 text-[#b8860b] dark:border-[#6f5320] dark:bg-white/10 dark:text-[#f0c36b]">
                    <LayoutGrid size={24} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#1f2f46] dark:text-white">
                    Bu alt kategoride henüz içerik yok
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    Soldaki listeden farklı bir alt kategori seçebilir veya yeni içerik ekleyebilirsiniz.
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Doküman oluşturma ve yükleme işlemleri, üst alandaki firma seçimine göre ilgili çalışma alanına bağlanır.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href={creationCompanyId ? buildDocumentEditorHref(category, subcategory, { companyId: creationCompanyId }) : "#"}
                      onClick={(event) => {
                        if (!creationCompanyId) {
                          event.preventDefault();
                          setErrorMessage("Lütfen önce içerik oluşturulacak firmayı seçin.");
                        }
                      }}
                      className={cn(
                        "inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold transition",
                        creationCompanyId
                          ? "bg-[var(--primary)] text-white hover:brightness-110"
                          : "cursor-not-allowed bg-slate-300 text-white dark:bg-slate-700 dark:text-slate-300",
                      )}
                    >
                      Doküman Editöründe Oluştur
                    </Link>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importingDocument || !creationCompanyId}
                      className={cn(
                        "inline-flex h-11 items-center justify-center rounded-2xl border border-[var(--gold)]/30 bg-white/80 px-5 text-sm font-semibold text-[var(--primary)] transition hover:border-[var(--gold)]/45 hover:bg-[var(--gold)]/10 dark:bg-white/10 dark:text-[#f0c36b] dark:hover:bg-white/15",
                        importingDocument || !creationCompanyId ? "cursor-not-allowed opacity-60" : "",
                      )}
                    >
                      {importingDocument ? "Dosya Yükleniyor..." : "Cihazdan Doküman Yükle"}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Yüklediğiniz dosya editörde açılır; isterseniz düzenleyip kaydedebilir, daha sonra tekrar düzenleyebilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {contentCards}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {statusMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {statusMessage}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFileSelected}
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {category === "all" ? (
        filteredContents.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            canManageCatalog={userContext.canManageCatalog}
            addHref={buildAddContentHref(category)}
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {contentCards}
          </section>
        )
      ) : null}

      {assignModalOpen && assignContent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Firmaya Ata</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  “{assignContent.title}” içeriğini seçtiğiniz firmaya kaydederek firma kütüphanesine ekleyin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Firma</span>
                <select
                  value={assignCompanyId}
                  onChange={(event) => setAssignCompanyId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-[var(--gold)]/40"
                >
                  <option value="">Firma seçin</option>
                  {companies.map((company) => {
                    const alreadyAssigned = (savedCompaniesByContent.get(assignContent.id) ?? []).includes(company.id);
                    return (
                      <option key={company.id} value={company.id} disabled={alreadyAssigned}>
                        {company.name}
                        {alreadyAssigned ? " (zaten kayıtlı)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              {assignMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {assignMessage}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition hover:border-[var(--gold)]/35"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => void handleAssignSubmit()}
                  disabled={assigning || !assignCompanyId}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition",
                    assigning || !assignCompanyId
                      ? "cursor-not-allowed bg-slate-300"
                      : "bg-[var(--primary)] hover:brightness-110",
                  )}
                >
                  {assigning ? "Kaydediliyor..." : "Firmaya Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <TemplatePreview
        open={Boolean(previewState)}
        title={previewState?.title ?? ""}
        description={previewState?.description ?? ""}
        content={previewState?.content ?? null}
        loading={previewLoading}
        onClose={() => {
          setPreviewLoading(false);
          setPreviewState(null);
        }}
      />

      {categoryModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Yeni Alt Kategori</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {activeCategoryMeta.label} altında görünecek yeni kategori adını yazın.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Kategori Adı</span>
                <input
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Örn. Acil Toplanma Noktaları"
                  className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-[var(--gold)]/40"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition hover:border-[var(--gold)]/35"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleCreateSubcategory}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--primary)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineContent(content?: JSONContent["content"]): string {
  if (!content?.length) return "";

  return content
    .map((node) => {
      if (node.type !== "text") return "";

      let html = escapeHtml(node.text ?? "");
      const marks = node.marks ?? [];

      for (const mark of marks) {
        if (mark.type === "bold") html = `<strong>${html}</strong>`;
        if (mark.type === "italic") html = `<em>${html}</em>`;
        if (mark.type === "underline") html = `<u>${html}</u>`;
      }

      return html;
    })
    .join("");
}

function renderJsonNodeToHtml(node: JSONContent): string {
  const children = (node.content ?? []).map((child) => renderJsonNodeToHtml(child)).join("");
  const inline = renderInlineContent(node.content);

  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return `<p>${inline || children || "&nbsp;"}</p>`;
    case "heading":
      return `<h${node.attrs?.level ?? 2}>${inline || children}</h${node.attrs?.level ?? 2}>`;
    case "bulletList":
      return `<ul>${children}</ul>`;
    case "orderedList":
      return `<ol>${children}</ol>`;
    case "listItem":
      return `<li>${children}</li>`;
    case "table":
      return `<table><tbody>${children}</tbody></table>`;
    case "tableRow":
      return `<tr>${children}</tr>`;
    case "tableHeader":
      return `<th>${children || inline}</th>`;
    case "tableCell":
      return `<td>${children || inline}</td>`;
    case "horizontalRule":
      return "<hr />";
    case "text":
      return renderInlineContent([node]);
    default:
      return children || inline;
  }
}

function TemplatePreview(props: {
  open: boolean;
  title: string;
  description: string;
  content: JSONContent | null;
  loading: boolean;
  onClose: () => void;
}) {
  const hasRenderableContent = Boolean(props.content?.content?.length);
  const previewHtml = useMemo(
    () => (props.content ? renderJsonNodeToHtml(props.content) : ""),
    [props.content],
  );

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-[var(--shadow-elevated)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/90">
              Şablon Önizleme
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{props.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{props.description}</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,251,235,0.9))] px-6 py-6 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(17,24,39,0.94))]">
          {props.loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/3 rounded-xl" />
              <Skeleton className="h-5 w-full rounded-xl" />
              <Skeleton className="h-5 w-5/6 rounded-xl" />
              <Skeleton className="h-80 w-full rounded-[1.5rem]" />
            </div>
          ) : (
            <div className="a4-page mx-auto min-h-0 max-w-4xl rounded-[1.5rem] border border-border bg-white px-8 py-8 text-slate-900 shadow-sm dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100">
              {hasRenderableContent ? (
                <div
                  className="tiptap min-h-[720px]"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="flex min-h-[240px] items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 px-6 text-center text-sm text-muted-foreground">
                  Önizleme içeriği şu anda yüklenemedi. Bu şablonu yine de indirip düzenleyebilirsiniz.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
