
INSERT INTO public.subscription_plans (
  plan_key, display_name, description,
  price_usd, price_try,
  message_limit, analysis_limit, document_limit,
  company_limit, personnel_limit_per_company,
  allowed_tools,
  has_semantic_cache, has_proactive_suggestions, has_api_access,
  has_priority_support, has_white_label, has_dedicated_manager,
  has_action_tools, sort_order
) VALUES
('free', 'Free', 'Urunu denemek isteyenler icin ucretsiz plan',
 0, 0, 10, 3, 0, 1, 5,
 '["search_legislation", "search_past_answers"]'::jsonb,
 false, false, false, false, false, false, false, 1),
('starter', 'Starter', 'Tek ISG uzmani, KOBI',
 29, 699, 100, 50, 10, 3, 50,
 '["search_legislation", "search_past_answers", "save_conversation", "get_personnel_count", "get_recent_assessments"]'::jsonb,
 true, false, false, false, false, false, false, 2),
('professional', 'Professional', 'Aktif ISG profesyoneli, kucuk OSGB',
 79, 1799, 500, 200, 30, 10, 999999,
 '["search_legislation", "search_past_answers", "save_conversation", "get_personnel_count", "get_recent_assessments", "get_personnel_details", "get_training_status", "get_incidents", "get_documents", "get_ppe_records"]'::jsonb,
 true, true, true, true, false, false, false, 3),
('business', 'Business', 'Buyuk OSGB, kurumsal musteri',
 199, 4499, 2000, 999999, 999999, 50, 999999,
 '["search_legislation", "search_past_answers", "save_conversation", "get_personnel_count", "get_recent_assessments", "get_personnel_details", "get_training_status", "get_incidents", "get_documents", "get_ppe_records", "get_risk_findings", "get_periodic_controls", "get_health_exams", "get_company_info", "get_user_context", "generate_training_slide", "generate_procedure", "generate_checklist", "generate_dof_form", "generate_risk_template"]'::jsonb,
 true, true, true, true, true, true, false, 4),
('enterprise', 'Enterprise', 'Cok uluslu sirketler, holdingler. Ozel anlasma.',
 0, 0, 999999, 999999, 999999, 999999, 999999,
 '["*"]'::jsonb,
 true, true, true, true, true, true, true, 5)
ON CONFLICT (plan_key) DO NOTHING;

UPDATE public.subscription_plans SET is_custom_pricing = true WHERE plan_key = 'enterprise';
;
