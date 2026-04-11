
-- ============================================================
-- FIX 1: agent_tool_calls - authenticated users kendi loglarini
-- insert edebilsin (service_role kisitlamasi kaldirilsin)
-- ============================================================

DROP POLICY IF EXISTS "Service role can insert tool calls" ON public.agent_tool_calls;

CREATE POLICY "Users can insert own tool calls"
  ON public.agent_tool_calls
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FIX 2: agent_sessions - UPDATE icin policy ekle
-- (mesaj sayaci icin gerekli)
-- ============================================================

-- Mevcut "ALL" policy UPDATE'i de kapsamali ama net olsun diye
-- with_check ekliyoruz
DROP POLICY IF EXISTS "Users can manage own sessions" ON public.agent_sessions;

CREATE POLICY "Users can manage own sessions"
  ON public.agent_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FIX 3: ai_qa_learning - Nova cache'e yazabilmeli
-- ============================================================

ALTER TABLE public.ai_qa_learning ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read cache" ON public.ai_qa_learning;
DROP POLICY IF EXISTS "Users can insert cache" ON public.ai_qa_learning;
DROP POLICY IF EXISTS "Users can update cache usage" ON public.ai_qa_learning;

-- Okuma: herkes (authenticated) cache'i okuyabilir
CREATE POLICY "Authenticated users can read cache"
  ON public.ai_qa_learning
  FOR SELECT
  TO authenticated
  USING (true);

-- Yazma: authenticated users yazabilir
CREATE POLICY "Authenticated users can insert cache"
  ON public.ai_qa_learning
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update: usage_count artirma vs icin
CREATE POLICY "Authenticated users can update cache"
  ON public.ai_qa_learning
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- FIX 4: subscription_usage - authenticated users kendi
-- kaydini insert/update edebilsin
-- ============================================================

DROP POLICY IF EXISTS "Service role can manage usage" ON public.subscription_usage;

CREATE POLICY "Users can insert own usage"
  ON public.subscription_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON public.subscription_usage
  FOR UPDATE
  USING (auth.uid() = user_id);
;
