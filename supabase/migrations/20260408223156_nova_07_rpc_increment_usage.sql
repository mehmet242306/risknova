
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_subscription_id uuid,
  p_user_id uuid,
  p_action text,
  p_tool_name text DEFAULT NULL,
  p_input_tokens bigint DEFAULT 0,
  p_output_tokens bigint DEFAULT 0,
  p_was_cache_hit boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month date := date_trunc('month', now())::date;
  v_cost_usd numeric(10,4);
BEGIN
  v_cost_usd := (p_input_tokens::numeric * 0.000003) + (p_output_tokens::numeric * 0.000015);

  INSERT INTO public.subscription_usage (
    subscription_id, user_id, usage_month,
    message_count, analysis_count, document_count,
    tool_usage, total_input_tokens, total_output_tokens,
    estimated_cost_usd, cache_hits, cache_misses
  )
  VALUES (
    p_subscription_id, p_user_id, current_month,
    CASE WHEN p_action = 'message' THEN 1 ELSE 0 END,
    CASE WHEN p_action = 'analysis' THEN 1 ELSE 0 END,
    CASE WHEN p_action = 'document' THEN 1 ELSE 0 END,
    CASE WHEN p_tool_name IS NOT NULL THEN jsonb_build_object(p_tool_name, 1) ELSE '{}'::jsonb END,
    p_input_tokens, p_output_tokens, v_cost_usd,
    CASE WHEN p_was_cache_hit THEN 1 ELSE 0 END,
    CASE WHEN p_was_cache_hit THEN 0 ELSE 1 END
  )
  ON CONFLICT (subscription_id, usage_month)
  DO UPDATE SET
    message_count = subscription_usage.message_count + CASE WHEN p_action = 'message' THEN 1 ELSE 0 END,
    analysis_count = subscription_usage.analysis_count + CASE WHEN p_action = 'analysis' THEN 1 ELSE 0 END,
    document_count = subscription_usage.document_count + CASE WHEN p_action = 'document' THEN 1 ELSE 0 END,
    tool_usage = CASE
      WHEN p_tool_name IS NOT NULL THEN
        subscription_usage.tool_usage || jsonb_build_object(
          p_tool_name,
          COALESCE((subscription_usage.tool_usage->>p_tool_name)::int, 0) + 1
        )
      ELSE subscription_usage.tool_usage
    END,
    total_input_tokens = subscription_usage.total_input_tokens + p_input_tokens,
    total_output_tokens = subscription_usage.total_output_tokens + p_output_tokens,
    estimated_cost_usd = subscription_usage.estimated_cost_usd + v_cost_usd,
    cache_hits = subscription_usage.cache_hits + CASE WHEN p_was_cache_hit THEN 1 ELSE 0 END,
    cache_misses = subscription_usage.cache_misses + CASE WHEN p_was_cache_hit THEN 0 ELSE 1 END,
    updated_at = now();
END;
$$;
;
