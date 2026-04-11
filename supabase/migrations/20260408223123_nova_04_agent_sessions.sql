
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  company_workspace_id uuid REFERENCES public.company_workspaces(id) ON DELETE SET NULL,
  title text,
  language text DEFAULT 'tr',
  context_page text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  message_count integer DEFAULT 0,
  total_tool_calls integer DEFAULT 0,
  total_tokens_used bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.agent_sessions IS 'Nova konusma oturumlari';

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON public.agent_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_org ON public.agent_sessions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_last_msg ON public.agent_sessions(last_message_at DESC);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON public.agent_sessions FOR ALL
  USING (auth.uid() = user_id);
;
