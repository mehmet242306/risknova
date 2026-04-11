
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key text UNIQUE NOT NULL CHECK (plan_key IN ('free', 'starter', 'professional', 'business', 'enterprise')),
  display_name text NOT NULL,
  description text,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  price_try numeric(10,2),
  is_custom_pricing boolean DEFAULT false,
  message_limit integer NOT NULL DEFAULT 10,
  analysis_limit integer NOT NULL DEFAULT 3,
  document_limit integer NOT NULL DEFAULT 0,
  company_limit integer NOT NULL DEFAULT 1,
  personnel_limit_per_company integer NOT NULL DEFAULT 5,
  allowed_tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_semantic_cache boolean DEFAULT true,
  has_proactive_suggestions boolean DEFAULT false,
  has_api_access boolean DEFAULT false,
  has_priority_support boolean DEFAULT false,
  has_white_label boolean DEFAULT false,
  has_dedicated_manager boolean DEFAULT false,
  has_action_tools boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.subscription_plans IS 'Nova abonelik planlari (Free, Starter, Pro, Business, Enterprise)';

CREATE INDEX IF NOT EXISTS idx_subscription_plans_key ON public.subscription_plans(plan_key);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active, is_visible);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true AND is_visible = true);

CREATE POLICY "Service role can manage plans"
  ON public.subscription_plans FOR ALL
  USING (auth.role() = 'service_role');
;
