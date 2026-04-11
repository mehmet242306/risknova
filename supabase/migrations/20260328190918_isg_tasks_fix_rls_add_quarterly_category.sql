
-- ── 1. Fix isg_tasks RLS: replace JWT-only check with user_profiles lookup ──

DROP POLICY IF EXISTS "isg_tasks_select" ON public.isg_tasks;
DROP POLICY IF EXISTS "isg_tasks_insert" ON public.isg_tasks;
DROP POLICY IF EXISTS "isg_tasks_update" ON public.isg_tasks;
DROP POLICY IF EXISTS "isg_tasks_delete" ON public.isg_tasks;

-- Helper expression: current user's organization_id from user_profiles
-- Allows both JWT-claim path (fast) and user_profiles lookup (reliable fallback)
CREATE POLICY "isg_tasks_select" ON public.isg_tasks
  FOR SELECT USING (
    organization_id = current_organization_id()
    OR organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "isg_tasks_insert" ON public.isg_tasks
  FOR INSERT WITH CHECK (
    organization_id = current_organization_id()
    OR organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "isg_tasks_update" ON public.isg_tasks
  FOR UPDATE USING (
    organization_id = current_organization_id()
    OR organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL
      LIMIT 1
    )
  );

CREATE POLICY "isg_tasks_delete" ON public.isg_tasks
  FOR DELETE USING (
    organization_id = current_organization_id()
    OR organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL
      LIMIT 1
    )
  );


-- ── 2. Fix isg_task_categories RLS: same pattern for org-specific categories ──

DROP POLICY IF EXISTS "isg_task_categories_select" ON public.isg_task_categories;

CREATE POLICY "isg_task_categories_select" ON public.isg_task_categories
  FOR SELECT USING (
    is_default = true
    OR organization_id = current_organization_id()
    OR organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE auth_user_id = auth.uid() AND organization_id IS NOT NULL
      LIMIT 1
    )
  );


-- ── 3. Add 'quarterly' to recurrence check constraint ──

ALTER TABLE public.isg_tasks
  DROP CONSTRAINT IF EXISTS isg_tasks_recurrence_check;

ALTER TABLE public.isg_tasks
  ADD CONSTRAINT isg_tasks_recurrence_check
  CHECK (recurrence IN ('none','daily','weekly','monthly','quarterly','biannual','annual'));


-- ── 4. Insert new default category ──

INSERT INTO public.isg_task_categories (name, color, icon, is_default) VALUES
  ('İSG Kurul Toplantısı', '#6366F1', '🏛️', true)
ON CONFLICT DO NOTHING;
;
