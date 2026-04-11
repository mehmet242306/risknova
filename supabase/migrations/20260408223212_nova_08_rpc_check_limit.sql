
CREATE OR REPLACE FUNCTION public.check_subscription_limit(
  p_user_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription record;
  v_plan record;
  v_usage record;
  v_current_month date := date_trunc('month', now())::date;
  v_used integer := 0;
  v_limit integer := 0;
  v_remaining integer := 0;
BEGIN
  SELECT us.id as sub_id, us.plan_id, sp.plan_key,
         sp.message_limit, sp.analysis_limit, sp.document_limit
  INTO v_subscription
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id AND us.status = 'active'
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_subscription IS NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE plan_key = 'free' LIMIT 1;
    v_limit := CASE p_action
      WHEN 'message' THEN v_plan.message_limit
      WHEN 'analysis' THEN v_plan.analysis_limit
      WHEN 'document' THEN v_plan.document_limit
    END;
    v_used := 0;
    v_remaining := v_limit - v_used;

    RETURN jsonb_build_object(
      'allowed', v_remaining > 0,
      'plan_key', 'free',
      'limit', v_limit,
      'used', v_used,
      'remaining', v_remaining,
      'message', CASE WHEN v_remaining <= 0 THEN 'Free plan limitiniz doldu. Yukseltmek icin tiklayin.' ELSE NULL END
    );
  END IF;

  SELECT * INTO v_usage
  FROM public.subscription_usage
  WHERE subscription_id = v_subscription.sub_id AND usage_month = v_current_month;

  v_used := COALESCE(
    CASE p_action
      WHEN 'message' THEN v_usage.message_count
      WHEN 'analysis' THEN v_usage.analysis_count
      WHEN 'document' THEN v_usage.document_count
    END, 0);

  v_limit := CASE p_action
    WHEN 'message' THEN v_subscription.message_limit
    WHEN 'analysis' THEN v_subscription.analysis_limit
    WHEN 'document' THEN v_subscription.document_limit
  END;

  v_remaining := v_limit - v_used;

  RETURN jsonb_build_object(
    'allowed', v_remaining > 0,
    'plan_key', v_subscription.plan_key,
    'limit', v_limit,
    'used', v_used,
    'remaining', v_remaining,
    'subscription_id', v_subscription.sub_id,
    'message', CASE WHEN v_remaining <= 0
                    THEN 'Bu ayki ' || p_action || ' limitiniz doldu (' || v_used || '/' || v_limit || ').'
                    ELSE NULL END
  );
END;
$$;
;
