/**
 * Supabase Company API Helper
 *
 * Provides CRUD operations for companies via Supabase.
 * All functions gracefully return null when Supabase is unavailable,
 * allowing the app to fall back to localStorage.
 */
import { createClient } from "@/lib/supabase/client";
import type { CompanyRecord } from "@/lib/company-directory";

/* ------------------------------------------------------------------ */
/* Types for DB rows                                                   */
/* ------------------------------------------------------------------ */
type CompanyIdentityRow = {
  id: string;
  company_code: string;
  official_name: string;
  sector: string | null;
  nace_code: string | null;
  hazard_class: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  is_active: boolean;
  is_archived: boolean;
  archived_at: string | null;
  delete_requested_at: string | null;
  deleted_at: string | null;
};

type CompanyWorkspaceRow = {
  id: string;
  company_identity_id: string;
  display_name: string;
  notes: string | null;
  is_archived: boolean;
  metadata: Record<string, unknown> | null;
  logo_url: string | null;
};

type JoinedRow = CompanyWorkspaceRow & {
  company_identities: CompanyIdentityRow;
};

/* ------------------------------------------------------------------ */
/* Mapping: DB → CompanyRecord                                         */
/* ------------------------------------------------------------------ */
function dbToCompanyRecord(ws: JoinedRow): CompanyRecord {
  const ci = ws.company_identities;
  const m = (ws.metadata ?? {}) as Record<string, unknown>;

  const str = (key: string, fallback = "") => (typeof m[key] === "string" ? (m[key] as string) : fallback);
  const num = (key: string, fallback = 0) => (typeof m[key] === "number" ? (m[key] as number) : fallback);
  const arr = (key: string): string[] => (Array.isArray(m[key]) ? (m[key] as string[]) : [""]);

  return {
    id: ws.id, // workspace ID as the frontend record ID
    name: ci.official_name,
    shortName: ws.display_name || ci.official_name,
    kind: str("kind", "Özel Sektör"),
    companyType: str("companyType", "bagimsiz"),
    address: ci.address || str("address"),
    city: ci.city || str("city"),
    district: ci.district || str("district"),
    sector: ci.sector || str("sector"),
    naceCode: ci.nace_code || str("naceCode"),
    hazardClass: ci.hazard_class || str("hazardClass"),
    taxNumber: ci.tax_number || str("taxNumber"),
    taxOffice: str("taxOffice"),
    sgkWorkplaceNumber: str("sgkWorkplaceNumber"),
    fax: str("fax"),
    employerTitle: str("employerTitle"),
    employeeCount: num("employeeCount"),
    shiftModel: str("shiftModel"),
    phone: str("phone"),
    email: str("email"),
    contactPerson: str("contactPerson"),
    employerName: str("employerName"),
    employerRepresentative: str("employerRepresentative"),
    notes: ws.notes || str("notes"),
    activeProfessionals: num("activeProfessionals"),
    employeeRepresentativeCount: num("employeeRepresentativeCount"),
    supportStaffCount: num("supportStaffCount"),
    openActions: num("openActions"),
    overdueActions: num("overdueActions"),
    openRiskAssessments: num("openRiskAssessments"),
    documentCount: num("documentCount"),
    completionRate: num("completionRate"),
    maturityScore: num("maturityScore"),
    openRiskScore: num("openRiskScore"),
    last30DayImprovement: num("last30DayImprovement"),
    completedTrainingCount: num("completedTrainingCount"),
    expiringTrainingCount: num("expiringTrainingCount"),
    periodicControlCount: num("periodicControlCount"),
    overduePeriodicControlCount: num("overduePeriodicControlCount"),
    lastAnalysisDate: str("lastAnalysisDate"),
    lastInspectionDate: str("lastInspectionDate"),
    lastDrillDate: str("lastDrillDate"),
    locations: arr("locations"),
    departments: arr("departments"),
    logo_url: ws.logo_url ?? undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Mapping: CompanyRecord → metadata JSONB                             */
/* ------------------------------------------------------------------ */
function companyToMetadata(c: CompanyRecord): Record<string, unknown> {
  return {
    kind: c.kind,
    companyType: c.companyType,
    address: c.address,
    city: c.city,
    district: c.district,
    sector: c.sector,
    naceCode: c.naceCode,
    hazardClass: c.hazardClass,
    taxNumber: c.taxNumber,
    taxOffice: c.taxOffice,
    sgkWorkplaceNumber: c.sgkWorkplaceNumber,
    fax: c.fax,
    employerTitle: c.employerTitle,
    employeeCount: c.employeeCount,
    shiftModel: c.shiftModel,
    phone: c.phone,
    email: c.email,
    contactPerson: c.contactPerson,
    employerName: c.employerName,
    employerRepresentative: c.employerRepresentative,
    notes: c.notes,
    activeProfessionals: c.activeProfessionals,
    employeeRepresentativeCount: c.employeeRepresentativeCount,
    supportStaffCount: c.supportStaffCount,
    openActions: c.openActions,
    overdueActions: c.overdueActions,
    openRiskAssessments: c.openRiskAssessments,
    documentCount: c.documentCount,
    completionRate: c.completionRate,
    maturityScore: c.maturityScore,
    openRiskScore: c.openRiskScore,
    last30DayImprovement: c.last30DayImprovement,
    completedTrainingCount: c.completedTrainingCount,
    expiringTrainingCount: c.expiringTrainingCount,
    periodicControlCount: c.periodicControlCount,
    overduePeriodicControlCount: c.overduePeriodicControlCount,
    lastAnalysisDate: c.lastAnalysisDate,
    lastInspectionDate: c.lastInspectionDate,
    lastDrillDate: c.lastDrillDate,
    locations: c.locations,
    departments: c.departments,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch active companies from Supabase.
 * Returns null if Supabase is unavailable.
 */
export async function fetchCompaniesFromSupabase(): Promise<CompanyRecord[] | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("company_workspaces")
      .select(`
        id, company_identity_id, display_name, notes, is_archived, metadata, logo_url,
        company_identities!inner (
          id, company_code, official_name, sector, nace_code, hazard_class,
          address, city, district, is_active, is_archived, archived_at,
          delete_requested_at, deleted_at
        )
      `)
      .eq("is_archived", false)
      .eq("company_identities.is_active", true)
      .eq("company_identities.is_archived", false)
      .is("company_identities.deleted_at", null);

    if (error) {
      console.warn("[company-api] fetchCompanies error:", error.message);
      return null;
    }

    if (!data || !Array.isArray(data)) return null;

    return (data as unknown as JoinedRow[]).map(dbToCompanyRecord);
  } catch (err) {
    console.warn("[company-api] fetchCompanies exception:", err);
    return null;
  }
}

/**
 * Fetch archived companies from Supabase.
 */
export async function fetchArchivedFromSupabase(): Promise<CompanyRecord[] | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("company_workspaces")
      .select(`
        id, company_identity_id, display_name, notes, is_archived, metadata, logo_url,
        company_identities!inner (
          id, company_code, official_name, sector, nace_code, hazard_class,
          address, city, district, is_active, is_archived, archived_at,
          delete_requested_at, deleted_at
        )
      `)
      .eq("company_identities.is_archived", true)
      .is("company_identities.deleted_at", null);

    if (error) {
      console.warn("[company-api] fetchArchived error:", error.message);
      return null;
    }

    if (!data || !Array.isArray(data)) return null;

    return (data as unknown as JoinedRow[]).map(dbToCompanyRecord);
  } catch (err) {
    console.warn("[company-api] fetchArchived exception:", err);
    return null;
  }
}

/**
 * Fetch deleted companies from Supabase.
 */
export async function fetchDeletedFromSupabase(): Promise<CompanyRecord[] | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("company_workspaces")
      .select(`
        id, company_identity_id, display_name, notes, is_archived, metadata, logo_url,
        company_identities!inner (
          id, company_code, official_name, sector, nace_code, hazard_class,
          address, city, district, is_active, is_archived, archived_at,
          delete_requested_at, deleted_at
        )
      `)
      .not("company_identities.deleted_at", "is", null);

    if (error) {
      console.warn("[company-api] fetchDeleted error:", error.message);
      return null;
    }

    if (!data || !Array.isArray(data)) return null;

    return (data as unknown as JoinedRow[]).map(dbToCompanyRecord);
  } catch (err) {
    console.warn("[company-api] fetchDeleted exception:", err);
    return null;
  }
}

/**
 * Save/update a company's workspace metadata in Supabase.
 * The workspaceId is the CompanyRecord.id.
 * Returns true on success, null if Supabase unavailable, false on error.
 */
export async function saveCompanyToSupabase(company: CompanyRecord): Promise<boolean | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    // Update workspace metadata + display_name + notes
    const { error: wsError } = await supabase
      .from("company_workspaces")
      .update({
        display_name: company.shortName || company.name,
        notes: company.notes || null,
        metadata: companyToMetadata(company),
        updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      .eq("id", company.id);

    if (wsError) {
      console.warn("[company-api] saveCompany workspace error:", wsError.message);
      return false;
    }

    // Also update the identity fields that have dedicated columns
    // First get the company_identity_id from the workspace
    const { data: wsRow, error: lookupError } = await supabase
      .from("company_workspaces")
      .select("company_identity_id")
      .eq("id", company.id)
      .single();

    if (lookupError || !wsRow) {
      console.warn("[company-api] saveCompany identity lookup error:", lookupError?.message);
      return false;
    }

    const { error: ciError } = await supabase
      .from("company_identities")
      .update({
        official_name: company.name,
        sector: company.sector || null,
        nace_code: company.naceCode || null,
        hazard_class: company.hazardClass || null,
        address: company.address || null,
        updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      })
      .eq("id", wsRow.company_identity_id);

    if (ciError) {
      console.warn("[company-api] saveCompany identity error:", ciError.message);
      // Workspace was updated, identity failed — partial success
      return true;
    }

    return true;
  } catch (err) {
    console.warn("[company-api] saveCompany exception:", err);
    return false;
  }
}

/**
 * Create a new company in Supabase using the RPC.
 * Returns the workspace ID on success, null if unavailable.
 */
export async function createCompanyInSupabase(company: CompanyRecord): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data: workspaceId, error } = await supabase.rpc(
      "create_company_identity_with_workspace",
      {
        p_official_name: company.name,
        p_sector: company.sector || null,
        p_nace_code: company.naceCode || null,
        p_hazard_class: company.hazardClass || null,
        p_address: company.address || null,
        p_display_name: company.shortName || company.name,
        p_notes: company.notes || null,
      },
    );

    if (error) {
      console.warn("[company-api] createCompany error:", error.message);
      return null;
    }

    if (!workspaceId) return null;

    // Now save the full metadata
    const { error: metaError } = await supabase
      .from("company_workspaces")
      .update({ metadata: companyToMetadata(company) })
      .eq("id", workspaceId);

    if (metaError) {
      console.warn("[company-api] createCompany metadata error:", metaError.message);
    }

    return workspaceId as string;
  } catch (err) {
    console.warn("[company-api] createCompany exception:", err);
    return null;
  }
}

/**
 * Archive a company in Supabase.
 * Requires the company_identity_id (not workspace id).
 * Returns true on success, null if unavailable.
 */
export async function archiveCompanyInSupabase(workspaceId: string): Promise<boolean | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    // Look up the identity ID from the workspace
    const { data: wsRow, error: lookupError } = await supabase
      .from("company_workspaces")
      .select("company_identity_id")
      .eq("id", workspaceId)
      .single();

    if (lookupError || !wsRow) {
      console.warn("[company-api] archiveCompany lookup error:", lookupError?.message);
      return null;
    }

    const { error } = await supabase.rpc("archive_company_identity", {
      p_company_identity_id: wsRow.company_identity_id,
    });

    if (error) {
      console.warn("[company-api] archiveCompany error:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[company-api] archiveCompany exception:", err);
    return false;
  }
}

/**
 * Restore an archived company in Supabase.
 */
export async function restoreCompanyInSupabase(workspaceId: string): Promise<boolean | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data: wsRow, error: lookupError } = await supabase
      .from("company_workspaces")
      .select("company_identity_id")
      .eq("id", workspaceId)
      .single();

    if (lookupError || !wsRow) {
      console.warn("[company-api] restoreCompany lookup error:", lookupError?.message);
      return null;
    }

    const { error } = await supabase.rpc("restore_archived_company_identity", {
      p_company_identity_id: wsRow.company_identity_id,
    });

    if (error) {
      console.warn("[company-api] restoreCompany error:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[company-api] restoreCompany exception:", err);
    return false;
  }
}

/**
 * Request deletion of a company in Supabase.
 */
export async function deleteCompanyInSupabase(workspaceId: string): Promise<boolean | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data: wsRow, error: lookupError } = await supabase
      .from("company_workspaces")
      .select("company_identity_id")
      .eq("id", workspaceId)
      .single();

    if (lookupError || !wsRow) {
      console.warn("[company-api] deleteCompany lookup error:", lookupError?.message);
      return null;
    }

    const { error } = await supabase.rpc("request_company_delete", {
      p_company_identity_id: wsRow.company_identity_id,
    });

    if (error) {
      console.warn("[company-api] deleteCompany error:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[company-api] deleteCompany exception:", err);
    return false;
  }
}

/**
 * Permanently delete a company from Supabase (hard delete).
 * This removes the workspace and identity entirely.
 */
export async function permanentDeleteFromSupabase(workspaceId: string): Promise<boolean | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const { data: wsRow, error: lookupError } = await supabase
      .from("company_workspaces")
      .select("company_identity_id")
      .eq("id", workspaceId)
      .single();

    if (lookupError || !wsRow) {
      console.warn("[company-api] permanentDelete lookup error:", lookupError?.message);
      return null;
    }

    // Delete workspace first (cascade will handle personnel)
    const { error: wsDelError } = await supabase
      .from("company_workspaces")
      .delete()
      .eq("id", workspaceId);

    if (wsDelError) {
      console.warn("[company-api] permanentDelete workspace error:", wsDelError.message);
      return false;
    }

    // Then delete identity (cascade handles memberships, join requests, invitations)
    const { error: ciDelError } = await supabase
      .from("company_identities")
      .delete()
      .eq("id", wsRow.company_identity_id);

    if (ciDelError) {
      console.warn("[company-api] permanentDelete identity error:", ciDelError.message);
      // Workspace already deleted
      return true;
    }

    return true;
  } catch (err) {
    console.warn("[company-api] permanentDelete exception:", err);
    return false;
  }
}

/**
 * Upload a logo file to Supabase Storage and update company_workspaces.logo_url.
 * Returns the public URL on success, null on failure.
 */
export async function uploadCompanyLogo(
  workspaceId: string,
  file: File,
): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;

  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${workspaceId}/logo.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("company-logos")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      console.warn("[company-api] uploadLogo storage error:", uploadErr.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("company-logos")
      .getPublicUrl(path);

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateErr } = await supabase
      .from("company_workspaces")
      .update({ logo_url: publicUrl })
      .eq("id", workspaceId);

    if (updateErr) {
      console.warn("[company-api] uploadLogo update error:", updateErr.message);
      return null;
    }

    return publicUrl;
  } catch (err) {
    console.warn("[company-api] uploadLogo exception:", err);
    return null;
  }
}
