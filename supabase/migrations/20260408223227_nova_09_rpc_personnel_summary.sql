
CREATE OR REPLACE FUNCTION public.get_personnel_summary(
  p_organization_id uuid,
  p_position_filter text DEFAULT NULL,
  p_department_filter text DEFAULT NULL,
  p_company_identity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_active integer := 0;
  v_inactive integer := 0;
  v_by_department jsonb := '{}'::jsonb;
  v_by_position jsonb := '{}'::jsonb;
  v_special_policies jsonb := '{}'::jsonb;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.personnel
  WHERE organization_id = p_organization_id
    AND (p_company_identity_id IS NULL OR company_identity_id = p_company_identity_id)
    AND (p_position_filter IS NULL OR position_title ILIKE '%' || p_position_filter || '%')
    AND (p_department_filter IS NULL OR department ILIKE '%' || p_department_filter || '%');

  SELECT COUNT(*) INTO v_active
  FROM public.personnel
  WHERE organization_id = p_organization_id
    AND is_active = true
    AND employment_status = 'active'
    AND (p_company_identity_id IS NULL OR company_identity_id = p_company_identity_id)
    AND (p_position_filter IS NULL OR position_title ILIKE '%' || p_position_filter || '%')
    AND (p_department_filter IS NULL OR department ILIKE '%' || p_department_filter || '%');

  v_inactive := v_total - v_active;

  SELECT jsonb_object_agg(department, count) INTO v_by_department
  FROM (
    SELECT COALESCE(department, 'Belirtilmemis') AS department, COUNT(*) AS count
    FROM public.personnel
    WHERE organization_id = p_organization_id AND is_active = true
      AND (p_company_identity_id IS NULL OR company_identity_id = p_company_identity_id)
      AND (p_position_filter IS NULL OR position_title ILIKE '%' || p_position_filter || '%')
    GROUP BY department
  ) t;

  SELECT jsonb_object_agg(position_title, count) INTO v_by_position
  FROM (
    SELECT COALESCE(position_title, 'Belirtilmemis') AS position_title, COUNT(*) AS count
    FROM public.personnel
    WHERE organization_id = p_organization_id AND is_active = true
      AND (p_company_identity_id IS NULL OR company_identity_id = p_company_identity_id)
      AND (p_department_filter IS NULL OR department ILIKE '%' || p_department_filter || '%')
    GROUP BY position_title
    ORDER BY count DESC LIMIT 20
  ) t;

  SELECT jsonb_object_agg(policy_type, count) INTO v_special_policies
  FROM (
    SELECT psp.policy_type, COUNT(*) AS count
    FROM public.personnel_special_policies psp
    JOIN public.personnel p ON p.id = psp.personnel_id
    WHERE psp.organization_id = p_organization_id
      AND psp.is_active = true AND p.is_active = true
      AND (p_company_identity_id IS NULL OR p.company_identity_id = p_company_identity_id)
    GROUP BY psp.policy_type
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'inactive', v_inactive,
    'by_department', COALESCE(v_by_department, '{}'::jsonb),
    'by_position', COALESCE(v_by_position, '{}'::jsonb),
    'special_policies', COALESCE(v_special_policies, '{}'::jsonb)
  );
END;
$$;
;
