CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'system' CHECK (type IN ('risk_analysis', 'incident', 'task', 'dof', 'system')),
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical')),
  link text,
  actor_name text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON public.notifications (organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read) WHERE NOT is_read;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org notifications" ON public.notifications
  FOR SELECT USING (organization_id = public.current_organization_id());
CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE USING (organization_id = public.current_organization_id());
CREATE POLICY "Users can delete their notifications" ON public.notifications
  FOR DELETE USING (organization_id = public.current_organization_id());;
