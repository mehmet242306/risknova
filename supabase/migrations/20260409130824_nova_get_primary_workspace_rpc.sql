
CREATE OR REPLACE FUNCTION public.get_primary_workspace(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace record;
  v_count integer;
BEGIN
  -- Toplam aktif workspace sayisi
  SELECT COUNT(*) INTO v_count
  FROM public.company_workspaces
  WHERE organization_id = p_organization_id
    AND is_archived = false;

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'found', false,
      'reason', 'no_workspace',
      'message', 'Henuz firma workspace olusturulmamis'
    );
  END IF;

  -- Once primary workspace'i al
  SELECT id, display_name, is_primary_workspace
  INTO v_workspace
  FROM public.company_workspaces
  WHERE organization_id = p_organization_id
    AND is_archived = false
    AND is_primary_workspace = true
  LIMIT 1;

  -- Primary yoksa ilk workspace'i al
  IF v_workspace IS NULL THEN
    SELECT id, display_name, is_primary_workspace
    INTO v_workspace
    FROM public.company_workspaces
    WHERE organization_id = p_organization_id
      AND is_archived = false
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'workspace_id', v_workspace.id,
    'display_name', v_workspace.display_name,
    'is_primary', v_workspace.is_primary_workspace,
    'total_workspaces', v_count
  );
END;
$$;

COMMENT ON FUNCTION public.get_primary_workspace IS 'Nova icin: Organization uuid verildiginde primary workspace bilgisini doner';
;
