// =============================================================================
// Aktif Firma Profili — paylaşılan fetcher
// =============================================================================
// Global header bar'ı ve Raporlar sayfası banner'ı aynı DTO'yu kullanır.
// company_workspaces → company_identities FK join + personel sayımı.
// =============================================================================

import { createClient } from "./client";

export type CompanyProfile = {
  workspaceId: string;
  workspaceName: string;
  logoUrl: string | null;
  slug: string | null;
  companyCode: string | null;
  officialName: string | null;
  companyType: string | null;
  sector: string | null;
  naceCode: string | null;
  hazardClass: string | null;
  taxNumber: string | null;
  mersisNumber: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string | null;
  personnelActive: number;
  personnelTotal: number;
  departmentCount: number;
  locationCount: number;
};

type LooseRow = Record<string, unknown>;

export async function fetchCompanyProfile(
  workspaceId: string,
): Promise<CompanyProfile | null> {
  const client = createClient();
  if (!client) return null;

  const { data: ws, error: wsErr } = await client
    .from("company_workspaces")
    .select(
      "id, display_name, logo_url, slug, created_at, metadata, company_identity_id, company_identities(company_code, official_name, company_type, sector, nace_code, hazard_class, tax_number, mersis_number, address, city, district, is_active, created_at)",
    )
    .eq("id", workspaceId)
    .maybeSingle();
  if (wsErr || !ws) {
    console.warn("fetchCompanyProfile workspace:", wsErr?.message);
    return null;
  }
  const row = ws as LooseRow;
  const identity = (row.company_identities as LooseRow | LooseRow[] | null) ?? null;
  const ident = Array.isArray(identity) ? identity[0] ?? null : identity;

  const [{ count: personnelTotal }, { count: personnelActive }] = await Promise.all([
    client
      .from("personnel")
      .select("*", { count: "exact", head: true })
      .eq("company_workspace_id", workspaceId),
    client
      .from("personnel")
      .select("*", { count: "exact", head: true })
      .eq("company_workspace_id", workspaceId)
      .eq("is_active", true),
  ]);

  const metadata = (row.metadata as LooseRow | null) ?? {};
  const departmentsMeta = metadata.departments as unknown[] | undefined;
  const locationsMeta = metadata.locations as unknown[] | undefined;

  return {
    workspaceId: row.id as string,
    workspaceName: (row.display_name as string) ?? "(isimsiz)",
    logoUrl: (row.logo_url as string | null) ?? null,
    slug: (row.slug as string | null) ?? null,
    companyCode: (ident?.company_code as string | null) ?? null,
    officialName: (ident?.official_name as string | null) ?? null,
    companyType: (ident?.company_type as string | null) ?? null,
    sector: (ident?.sector as string | null) ?? null,
    naceCode: (ident?.nace_code as string | null) ?? null,
    hazardClass: (ident?.hazard_class as string | null) ?? null,
    taxNumber: (ident?.tax_number as string | null) ?? null,
    mersisNumber: (ident?.mersis_number as string | null) ?? null,
    city: (ident?.city as string | null) ?? null,
    district: (ident?.district as string | null) ?? null,
    address: (ident?.address as string | null) ?? null,
    isActive: (ident?.is_active as boolean | null) ?? true,
    createdAt:
      ((ident?.created_at as string | null) ?? (row.created_at as string | null)) ?? null,
    personnelActive: personnelActive ?? 0,
    personnelTotal: personnelTotal ?? 0,
    departmentCount: Array.isArray(departmentsMeta)
      ? departmentsMeta.filter(Boolean).length
      : 0,
    locationCount: Array.isArray(locationsMeta)
      ? locationsMeta.filter(Boolean).length
      : 0,
  };
}
