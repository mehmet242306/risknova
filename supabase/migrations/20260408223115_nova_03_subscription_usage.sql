
CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_month date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  analysis_count integer NOT NULL DEFAULT 0,
  document_count integer NOT NULL DEFAULT 0,
  tool_usage jsonb DEFAULT '{}'::jsonb,
  total_input_tokens bigint DEFAULT 0,
  total_output_tokens bigint DEFAULT 0,
  estimated_cost_usd numeric(10,4) DEFAULT 0,
  cache_hits integer DEFAULT 0,
  cache_misses integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(subscription_id, usage_month)
);

COMMENT ON TABLE public.subscription_usage IS 'Aylik kullanim sayaclari';

CREATE INDEX IF NOT EXISTS idx_subscription_usage_sub_month ON public.subscription_usage(subscription_id, usage_month);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_month ON public.subscription_usage(user_id, usage_month);

ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.subscription_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage"
  ON public.subscription_usage FOR ALL
  USING (auth.role() = 'service_role');
;
