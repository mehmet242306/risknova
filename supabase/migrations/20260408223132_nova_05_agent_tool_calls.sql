
CREATE TABLE IF NOT EXISTS public.agent_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.agent_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  tool_input jsonb NOT NULL,
  tool_output jsonb,
  status text NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  error_message text,
  duration_ms integer,
  cost_usd numeric(10,6) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.agent_tool_calls IS 'Nova tool cagri loglari (audit trail)';

CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_session ON public.agent_tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_user ON public.agent_tool_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_tool ON public.agent_tool_calls(tool_name, status);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_created ON public.agent_tool_calls(created_at DESC);

ALTER TABLE public.agent_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tool calls"
  ON public.agent_tool_calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert tool calls"
  ON public.agent_tool_calls FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
;
