import { createClient } from "@/lib/supabase/client";

export type LibraryContentRecord = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string;
  content_type: string | null;
  file_url: string | null;
  tags: string[] | null;
  sector: string[] | null;
  created_at: string;
};

export type CompanyLibraryItemRecord = {
  id: string;
  company_id: string;
  content_id: string;
  added_by: string | null;
  added_at: string;
  notes: string | null;
};

function getSupabaseErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "";

  const candidate = error as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  return candidate.message || candidate.details || candidate.hint || candidate.code || "";
}

function isExpectedMissingRelation(error: unknown) {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  return message.includes("does not exist") || message.includes("could not find the table") || message.includes("pgrst205");
}

function logLibraryWarning(label: string, error: unknown) {
  const message = getSupabaseErrorMessage(error);
  if (!message || isExpectedMissingRelation(error)) return;
  console.warn(`${label}: ${message}`);
}

export async function fetchLibraryContents(): Promise<LibraryContentRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("library_contents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logLibraryWarning("[isg-library-api] fetchLibraryContents", error);
    return [];
  }

  return (data ?? []) as LibraryContentRecord[];
}

export async function fetchCompanyLibraryItems(
  companyIds: string[],
): Promise<CompanyLibraryItemRecord[]> {
  const supabase = createClient();
  if (!supabase || companyIds.length === 0) return [];

  const { data, error } = await supabase
    .from("company_library_items")
    .select("id, company_id, content_id, added_by, added_at, notes")
    .in("company_id", companyIds)
    .order("added_at", { ascending: false });

  if (error) {
    logLibraryWarning("[isg-library-api] fetchCompanyLibraryItems", error);
    return [];
  }

  return (data ?? []) as CompanyLibraryItemRecord[];
}

export async function assignLibraryContentToCompany(input: {
  companyId: string;
  contentId: string;
  addedBy?: string | null;
  notes?: string | null;
}): Promise<CompanyLibraryItemRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const payload = {
    company_id: input.companyId,
    content_id: input.contentId,
    added_by: input.addedBy ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("company_library_items")
    .upsert(payload, { onConflict: "company_id,content_id" })
    .select("id, company_id, content_id, added_by, added_at, notes")
    .single();

  if (error) {
    logLibraryWarning("[isg-library-api] assignLibraryContentToCompany", error);
    return null;
  }

  return data as CompanyLibraryItemRecord;
}
