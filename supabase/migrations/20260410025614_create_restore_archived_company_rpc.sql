
CREATE OR REPLACE FUNCTION public.restore_archived_company_identity(
  p_company_identity_id uuid,
  p_note text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.company_identities
  SET
    is_archived = false,
    archived_at = NULL,
    archived_by_user_id = NULL,
    updated_at = now(),
    updated_by = COALESCE(p_actor_user_id, auth.uid())
  WHERE id = p_company_identity_id;

  -- Workspace'i de arsivden cikar
  UPDATE public.company_workspaces
  SET
    is_archived = false,
    updated_at = now(),
    updated_by = COALESCE(p_actor_user_id, auth.uid())
  WHERE company_identity_id = p_company_identity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_archived_company_identity(uuid, text, uuid) TO authenticated;
;
