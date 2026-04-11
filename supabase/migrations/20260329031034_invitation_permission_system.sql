
-- ── 1. Add "Diğer Sağlık Personeli" after İşyeri Hekimi (push sort_order >= 3 up first)
UPDATE public.team_categories SET sort_order = sort_order + 1 WHERE is_default = true AND sort_order >= 3;
INSERT INTO public.team_categories (name, color, icon, is_default, sort_order)
VALUES ('Diğer Sağlık Personeli', '#14B8A6', '🏥', true, 3);

-- ── 2. permission_templates
CREATE TABLE IF NOT EXISTS public.permission_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '📋',
  permissions jsonb NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permission_templates_select" ON public.permission_templates
  FOR SELECT USING (
    is_default = true
    OR organization_id = current_organization_id()
    OR organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "permission_templates_insert" ON public.permission_templates
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

-- ── 3. workspace_invitations
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_workspace_id uuid NOT NULL REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  inviter_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  invitee_email text NOT NULL,
  invitee_name text,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  permission_template_id uuid REFERENCES public.permission_templates(id) ON DELETE SET NULL,
  custom_permissions jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX workspace_invitations_workspace_idx ON public.workspace_invitations(company_workspace_id);
CREATE INDEX workspace_invitations_email_idx ON public.workspace_invitations(invitee_email);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_invitations_select" ON public.workspace_invitations
  FOR SELECT USING (
    company_workspace_id IN (
      SELECT id FROM public.company_workspaces
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "workspace_invitations_insert" ON public.workspace_invitations
  FOR INSERT WITH CHECK (
    company_workspace_id IN (
      SELECT id FROM public.company_workspaces
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "workspace_invitations_update" ON public.workspace_invitations
  FOR UPDATE USING (
    company_workspace_id IN (
      SELECT id FROM public.company_workspaces
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

-- ── 4. workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_workspace_id uuid NOT NULL REFERENCES public.company_workspaces(id) ON DELETE CASCADE,
  user_profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}',
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  invited_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  UNIQUE(company_workspace_id, user_profile_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
    OR company_workspace_id IN (
      SELECT id FROM public.company_workspaces
      WHERE organization_id IN (
        SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid() LIMIT 1
      )
    )
  );

-- ── 5. Seed 7 default permission templates
INSERT INTO public.permission_templates (name, description, icon, is_default, sort_order, permissions) VALUES
(
  'Tam Yetkili (Admin)',
  'Tüm modüllerde tam erişim ve yönetim yetkisi',
  '👑', true, 1,
  '{"risk.view_analyses":true,"risk.edit_analyses":true,"risk.view_scores":true,"risk.manage_dof":true,"planner.view":true,"planner.create_edit":true,"planner.complete_tasks":true,"planner.calendar":true,"personnel.view_list":true,"personnel.edit":true,"personnel.add_delete":true,"team.view_members":true,"team.edit_members":true,"health.view_records":true,"training.view_records":true,"docs.view":true,"docs.upload":true,"docs.delete":true,"docs.view_confidential":true,"reports.view":true,"reports.download":true,"reports.create":true,"reports.view_stats":true,"company.view_info":true,"company.edit_info":true,"company.manage_locations":true,"company.view_org_chart":true,"admin.invite_users":true,"admin.edit_permissions":true,"admin.view_audit_logs":true,"admin.change_settings":true}'::jsonb
),
(
  'İSG Uzmanı',
  'Risk, planlama, personel, doküman ve raporlarda tam yetki',
  '🦺', true, 2,
  '{"risk.view_analyses":true,"risk.edit_analyses":true,"risk.view_scores":true,"risk.manage_dof":true,"planner.view":true,"planner.create_edit":true,"planner.complete_tasks":true,"planner.calendar":true,"personnel.view_list":true,"personnel.edit":true,"personnel.add_delete":true,"team.view_members":true,"team.edit_members":true,"health.view_records":true,"training.view_records":true,"docs.view":true,"docs.upload":true,"docs.delete":true,"docs.view_confidential":false,"reports.view":true,"reports.download":true,"reports.create":true,"reports.view_stats":true,"company.view_info":true,"company.edit_info":false,"company.manage_locations":false,"company.view_org_chart":true,"admin.invite_users":true,"admin.edit_permissions":false,"admin.view_audit_logs":false,"admin.change_settings":false}'::jsonb
),
(
  'İşyeri Hekimi',
  'Sağlık kayıtları, personel ve rapor görüntüleme',
  '🏥', true, 3,
  '{"risk.view_analyses":true,"risk.edit_analyses":false,"risk.view_scores":true,"risk.manage_dof":false,"planner.view":true,"planner.create_edit":false,"planner.complete_tasks":true,"planner.calendar":true,"personnel.view_list":true,"personnel.edit":false,"personnel.add_delete":false,"team.view_members":true,"team.edit_members":false,"health.view_records":true,"training.view_records":true,"docs.view":true,"docs.upload":true,"docs.delete":false,"docs.view_confidential":false,"reports.view":true,"reports.download":true,"reports.create":false,"reports.view_stats":true,"company.view_info":true,"company.edit_info":false,"company.manage_locations":false,"company.view_org_chart":true,"admin.invite_users":false,"admin.edit_permissions":false,"admin.view_audit_logs":false,"admin.change_settings":false}'::jsonb
),
(
  'Çalışan Temsilcisi',
  'Risk ve doküman görüntüleme, toplantı takibi',
  '🗣️', true, 4,
  '{"risk.view_analyses":true,"risk.edit_analyses":false,"risk.view_scores":true,"risk.manage_dof":false,"planner.view":true,"planner.create_edit":false,"planner.complete_tasks":true,"planner.calendar":true,"personnel.view_list":true,"personnel.edit":false,"personnel.add_delete":false,"team.view_members":true,"team.edit_members":false,"health.view_records":false,"training.view_records":true,"docs.view":true,"docs.upload":false,"docs.delete":false,"docs.view_confidential":false,"reports.view":true,"reports.download":false,"reports.create":false,"reports.view_stats":false,"company.view_info":true,"company.edit_info":false,"company.manage_locations":false,"company.view_org_chart":true,"admin.invite_users":false,"admin.edit_permissions":false,"admin.view_audit_logs":false,"admin.change_settings":false}'::jsonb
),
(
  'Denetçi / Müfettiş',
  'Tüm alanlarda sadece görüntüleme yetkisi',
  '📋', true, 5,
  '{"risk.view_analyses":true,"risk.edit_analyses":false,"risk.view_scores":true,"risk.manage_dof":false,"planner.view":true,"planner.create_edit":false,"planner.complete_tasks":false,"planner.calendar":true,"personnel.view_list":true,"personnel.edit":false,"personnel.add_delete":false,"team.view_members":true,"team.edit_members":false,"health.view_records":false,"training.view_records":true,"docs.view":true,"docs.upload":false,"docs.delete":false,"docs.view_confidential":false,"reports.view":true,"reports.download":true,"reports.create":false,"reports.view_stats":true,"company.view_info":true,"company.edit_info":false,"company.manage_locations":false,"company.view_org_chart":true,"admin.invite_users":false,"admin.edit_permissions":false,"admin.view_audit_logs":true,"admin.change_settings":false}'::jsonb
),
(
  'Misafir',
  'Yalnızca firma bilgileri ve temel doküman görüntüleme',
  '👤', true, 6,
  '{"risk.view_analyses":false,"risk.edit_analyses":false,"risk.view_scores":false,"risk.manage_dof":false,"planner.view":false,"planner.create_edit":false,"planner.complete_tasks":false,"planner.calendar":false,"personnel.view_list":false,"personnel.edit":false,"personnel.add_delete":false,"team.view_members":false,"team.edit_members":false,"health.view_records":false,"training.view_records":false,"docs.view":true,"docs.upload":false,"docs.delete":false,"docs.view_confidential":false,"reports.view":false,"reports.download":false,"reports.create":false,"reports.view_stats":false,"company.view_info":true,"company.edit_info":false,"company.manage_locations":false,"company.view_org_chart":false,"admin.invite_users":false,"admin.edit_permissions":false,"admin.view_audit_logs":false,"admin.change_settings":false}'::jsonb
),
(
  'Özel',
  'Manuel izin seçimi ile özelleştirilmiş erişim',
  '⚙️', true, 7,
  '{}'::jsonb
);
;
