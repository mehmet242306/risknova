-- R2D-RCA C1-C9 sistemi için authoritative computation + audit
-- Skorlar [0,1] sürekli skala, delta = max(0, t1 - t0)

/* ------------------------------------------------------------------ */
/*  rca_analyses tablosu                                               */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS public.rca_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE CASCADE,
  incident_title text,

  -- Skor vektörleri — 9 elemanlı NUMERIC array
  t0 numeric[] NOT NULL CHECK (array_length(t0, 1) = 9),
  t1 numeric[] NOT NULL CHECK (array_length(t1, 1) = 9),

  -- Hesaplama sonuçları (server-side tamper-proof)
  delta_hat numeric[] NOT NULL CHECK (array_length(delta_hat, 1) = 9),
  max_delta_hat numeric NOT NULL,
  max_delta_hat_index int NOT NULL CHECK (max_delta_hat_index BETWEEN 0 AND 8),
  max_weighted_index int NOT NULL CHECK (max_weighted_index BETWEEN 0 AND 8),
  override_triggered boolean NOT NULL,
  calculation_mode text NOT NULL CHECK (calculation_mode IN ('override','base_score')),
  r_rca_score numeric NOT NULL,
  is_stable boolean NOT NULL,
  dual_reporting_required boolean NOT NULL,

  -- Eşikler (override edilebilir)
  tau_primary numeric NOT NULL DEFAULT 0.40,
  tau_secondary numeric NOT NULL DEFAULT 0.15,

  -- AI çıktısı
  narrative text,

  -- Meta
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_rca_analyses_incident ON public.rca_analyses(incident_id);
CREATE INDEX IF NOT EXISTS idx_rca_analyses_org ON public.rca_analyses(organization_id);

ALTER TABLE public.rca_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members select rca_analyses" ON public.rca_analyses;
CREATE POLICY "org members select rca_analyses" ON public.rca_analyses
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org members insert rca_analyses" ON public.rca_analyses;
CREATE POLICY "org members insert rca_analyses" ON public.rca_analyses
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org members update rca_analyses" ON public.rca_analyses;
CREATE POLICY "org members update rca_analyses" ON public.rca_analyses
  FOR UPDATE USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

/* ------------------------------------------------------------------ */
/*  Audit log — tüm hesaplamalar loglanır                              */
/* ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS public.rca_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rca_analysis_id uuid REFERENCES public.rca_analyses(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  action text NOT NULL,
  payload jsonb,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rca_audit_org ON public.rca_audit_log(organization_id);
ALTER TABLE public.rca_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members select rca_audit" ON public.rca_audit_log;
CREATE POLICY "org members select rca_audit" ON public.rca_audit_log
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

/* ------------------------------------------------------------------ */
/*  fn_compute_r2d_rca — authoritative hesaplama                       */
/* ------------------------------------------------------------------ */

CREATE OR REPLACE FUNCTION public.fn_compute_r2d_rca(
  p_incident_id uuid,
  p_t0 numeric[],
  p_t1 numeric[],
  p_tau_primary numeric DEFAULT 0.40,
  p_tau_secondary numeric DEFAULT 0.15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_weights constant numeric[] := ARRAY[0.120, 0.085, 0.145, 0.085, 0.145, 0.075, 0.165, 0.105, 0.075];
  v_delta numeric[] := ARRAY[0,0,0,0,0,0,0,0,0]::numeric[];
  v_priority numeric[] := ARRAY[0,0,0,0,0,0,0,0,0]::numeric[];
  v_max_delta numeric := 0;
  v_max_delta_idx int := 0;
  v_max_weighted numeric := 0;
  v_max_weighted_idx int := 0;
  v_override boolean;
  v_mode text;
  v_r_rca numeric;
  v_base_score numeric := 0;
  v_is_stable boolean;
  v_dual_reporting boolean;
  v_org_id uuid;
  v_user_id uuid;
  i int;
  v_d numeric;
  v_p numeric;
BEGIN
  -- Yetki + org çözümleme
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Kimlik doğrulaması gerekli';
  END IF;

  IF p_incident_id IS NOT NULL THEN
    SELECT i.organization_id INTO v_org_id FROM public.incidents i WHERE i.id = p_incident_id;
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'Olay bulunamadı veya erişim yok';
    END IF;
  ELSE
    SELECT organization_id INTO v_org_id FROM public.organization_members WHERE user_id = v_user_id LIMIT 1;
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'Organizasyon üyeliği bulunamadı';
    END IF;
  END IF;

  -- Array kontrolleri
  IF array_length(p_t0, 1) <> 9 OR array_length(p_t1, 1) <> 9 THEN
    RAISE EXCEPTION 't0 ve t1 tam olarak 9 elemanlı olmalı';
  END IF;

  -- Skorlar [0,1] aralığında olmalı
  FOR i IN 1..9 LOOP
    IF p_t0[i] < 0 OR p_t0[i] > 1 THEN RAISE EXCEPTION 't0[%] aralık dışı: %', i, p_t0[i]; END IF;
    IF p_t1[i] < 0 OR p_t1[i] > 1 THEN RAISE EXCEPTION 't1[%] aralık dışı: %', i, p_t1[i]; END IF;
  END LOOP;

  -- Delta ve priority hesabı
  FOR i IN 1..9 LOOP
    v_d := GREATEST(0, p_t1[i] - p_t0[i]);
    v_delta[i] := ROUND(v_d::numeric, 3);
    v_p := v_d * v_weights[i];
    v_priority[i] := ROUND(v_p::numeric, 4);
    v_base_score := v_base_score + v_p;

    IF v_d > v_max_delta THEN
      v_max_delta := v_d;
      v_max_delta_idx := i - 1;  -- 0-indexed
    END IF;

    IF v_p > v_max_weighted THEN
      v_max_weighted := v_p;
      v_max_weighted_idx := i - 1;
    END IF;
  END LOOP;

  -- Override mode
  v_override := v_max_delta >= p_tau_primary;
  v_mode := CASE WHEN v_override THEN 'override' ELSE 'base_score' END;
  v_r_rca := ROUND((CASE WHEN v_override THEN v_max_delta ELSE v_base_score END)::numeric, 3);

  -- Stabilite
  v_is_stable := (v_max_delta_idx = v_max_weighted_idx);
  v_dual_reporting := NOT v_is_stable AND v_max_delta > 0;

  -- Audit log
  INSERT INTO public.rca_audit_log (organization_id, action, payload, performed_by)
  VALUES (
    v_org_id,
    'compute',
    jsonb_build_object(
      'incident_id', p_incident_id,
      't0', to_jsonb(p_t0),
      't1', to_jsonb(p_t1),
      'tau_primary', p_tau_primary,
      'tau_secondary', p_tau_secondary,
      'r_rca_score', v_r_rca,
      'mode', v_mode
    ),
    v_user_id
  );

  RETURN jsonb_build_object(
    'deltaHat', to_jsonb(v_delta),
    'maxDeltaHat', v_max_delta,
    'maxDeltaHatIndex', v_max_delta_idx,
    'maxWeightedIndex', v_max_weighted_idx,
    'overrideTriggered', v_override,
    'calculationMode', v_mode,
    'rRcaScore', v_r_rca,
    'isStable', v_is_stable,
    'dualReportingRequired', v_dual_reporting,
    'priorities', to_jsonb(v_priority),
    'weights', to_jsonb(v_weights),
    'tauPrimary', p_tau_primary,
    'tauSecondary', p_tau_secondary,
    'organizationId', v_org_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_compute_r2d_rca(uuid, numeric[], numeric[], numeric, numeric) TO authenticated;
