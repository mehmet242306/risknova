
-- workspace_members: add missing columns
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest'));

-- workspace_invitations: add missing columns
ALTER TABLE public.workspace_invitations
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.workspace_invitations
  DROP CONSTRAINT IF EXISTS workspace_invitations_status_check;
ALTER TABLE public.workspace_invitations
  ADD CONSTRAINT workspace_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired'));

-- permission_templates: add role_key, color, is_system
ALTER TABLE public.permission_templates
  ADD COLUMN IF NOT EXISTS role_key text,
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6B7280',
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS permission_templates_role_key_idx
  ON public.permission_templates(role_key) WHERE role_key IS NOT NULL;

-- Tag existing seeded templates
UPDATE public.permission_templates SET role_key = 'admin',        color = '#8B5CF6', is_system = true WHERE name = 'Tam Yetkili (Admin)'   AND is_default = true;
UPDATE public.permission_templates SET role_key = 'isg_expert',   color = '#3B82F6', is_system = true WHERE name = 'İSG Uzmanı'            AND is_default = true;
UPDATE public.permission_templates SET role_key = 'physician',    color = '#10B981', is_system = true WHERE name = 'İşyeri Hekimi'         AND is_default = true;
UPDATE public.permission_templates SET role_key = 'employee_rep', color = '#F59E0B', is_system = true WHERE name = 'Çalışan Temsilcisi'    AND is_default = true;
UPDATE public.permission_templates SET role_key = 'auditor',      color = '#6B7280', is_system = true WHERE name = 'Denetçi / Müfettiş'   AND is_default = true;
UPDATE public.permission_templates SET role_key = 'guest',        color = '#94A3B8', is_system = true WHERE name = 'Misafir'               AND is_default = true;
UPDATE public.permission_templates SET role_key = 'custom',       color = '#64748B', is_system = true WHERE name = 'Özel'                  AND is_default = true;
;
