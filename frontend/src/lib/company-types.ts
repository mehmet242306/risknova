export const COMPANY_TYPE_VALUES = [
  "asil_isveren",
  "alt_isveren",
  "alt_yuklenici",
  "osgb",
  "bagimsiz",
] as const;

export type CompanyType = (typeof COMPANY_TYPE_VALUES)[number];

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  asil_isveren: "Asil Isveren",
  alt_isveren: "Alt Isveren (Taseron)",
  alt_yuklenici: "Alt Yuklenici",
  osgb: "OSGB",
  bagimsiz: "Bagimsiz",
};

export const RELATIONSHIP_TYPE_VALUES = [
  "asil_alt_isveren",
  "asil_alt_yuklenici",
  "osgb_hizmet",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPE_VALUES)[number];

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  asil_alt_isveren: "Asil Isveren - Alt Isveren",
  asil_alt_yuklenici: "Asil Isveren - Alt Yuklenici",
  osgb_hizmet: "OSGB Hizmet Iliskisi",
};

export type CompanyRelationship = {
  id: string;
  parent_company_id: string;
  child_company_id: string;
  parent_name?: string;
  child_name?: string;
  relationship_type: RelationshipType;
  worksite: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};
