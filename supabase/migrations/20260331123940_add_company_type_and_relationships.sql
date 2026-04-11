
-- 1. Add company_type to company_identities
ALTER TABLE company_identities
  ADD COLUMN IF NOT EXISTS company_type text NOT NULL DEFAULT 'bagimsiz'
  CHECK (company_type IN ('asil_isveren', 'alt_isveren', 'alt_yuklenici', 'osgb', 'bagimsiz'));

CREATE INDEX IF NOT EXISTS idx_company_identities_company_type ON company_identities (company_type);

-- 2. Create company_relationships table
CREATE TABLE IF NOT EXISTS company_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_company_id uuid NOT NULL REFERENCES company_identities(id) ON DELETE CASCADE,
  child_company_id uuid NOT NULL REFERENCES company_identities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('asil_alt_isveren', 'asil_alt_yuklenici', 'osgb_hizmet')),
  worksite text,
  contract_start_date date,
  contract_end_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_reference CHECK (parent_company_id <> child_company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_rel_parent ON company_relationships (parent_company_id);
CREATE INDEX IF NOT EXISTS idx_company_rel_child ON company_relationships (child_company_id);
CREATE INDEX IF NOT EXISTS idx_company_rel_active ON company_relationships (is_active) WHERE is_active = true;

-- Reuse existing updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON company_relationships
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 3. RLS policies
ALTER TABLE company_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members of parent or child can view relationships"
  ON company_relationships FOR SELECT
  USING (is_company_member(parent_company_id) OR is_company_member(child_company_id));

CREATE POLICY "Approvers of parent can insert relationships"
  ON company_relationships FOR INSERT
  WITH CHECK (is_company_approver(parent_company_id));

CREATE POLICY "Approvers of either side can update relationships"
  ON company_relationships FOR UPDATE
  USING (is_company_approver(parent_company_id) OR is_company_approver(child_company_id));

CREATE POLICY "Approvers of parent can delete relationships"
  ON company_relationships FOR DELETE
  USING (is_company_approver(parent_company_id));

-- 4. Update create_company_identity_with_workspace RPC to accept company_type
CREATE OR REPLACE FUNCTION create_company_identity_with_workspace(
  p_org_id uuid,
  p_official_name text,
  p_display_name text DEFAULT NULL,
  p_tax_number text DEFAULT NULL,
  p_sector text DEFAULT NULL,
  p_nace_code text DEFAULT NULL,
  p_hazard_class text DEFAULT NULL,
  p_company_type text DEFAULT 'bagimsiz'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_ci_id uuid;
  v_ws_id uuid;
  v_code  text;
  v_display text;
BEGIN
  -- Validate company_type
  IF p_company_type NOT IN ('asil_isveren', 'alt_isveren', 'alt_yuklenici', 'osgb', 'bagimsiz') THEN
    RAISE EXCEPTION 'Invalid company_type: %', p_company_type;
  END IF;

  v_display := coalesce(p_display_name, p_official_name);
  v_code    := generate_company_code();

  INSERT INTO company_identities (
    official_name, company_code, tax_number, sector, nace_code, hazard_class,
    owner_organization_id, company_type, created_by
  ) VALUES (
    p_official_name, v_code, p_tax_number, p_sector, p_nace_code, p_hazard_class,
    p_org_id, p_company_type, auth.uid()
  ) RETURNING id INTO v_ci_id;

  INSERT INTO company_workspaces (
    organization_id, company_identity_id, display_name,
    is_primary_workspace, created_by
  ) VALUES (
    p_org_id, v_ci_id, v_display, true, auth.uid()
  ) RETURNING id INTO v_ws_id;

  INSERT INTO company_memberships (
    company_identity_id, company_workspace_id, organization_id,
    user_id, membership_role, employment_type, status
  ) VALUES (
    v_ci_id, v_ws_id, p_org_id,
    auth.uid(), 'owner', 'direct', 'active'
  );

  RETURN jsonb_build_object(
    'company_identity_id', v_ci_id,
    'company_workspace_id', v_ws_id,
    'company_code', v_code
  );
END;
$$;
;
