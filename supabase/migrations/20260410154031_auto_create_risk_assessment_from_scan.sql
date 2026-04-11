
-- Scan bittiğinde otomatik risk_assessment oluştur
-- Findings ve images otomatik kopyalanır

CREATE OR REPLACE FUNCTION public.auto_create_risk_assessment_from_scan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_assessment_id uuid;
  v_row_id uuid;
  v_image_id uuid;
  v_detection record;
  v_point record;
  v_org_id uuid;
  v_overall_level text;
  v_critical_count int;
  v_high_count int;
  v_medium_count int;
BEGIN
  -- Sadece status 'completed' olunca, ve scan'de en az 1 risk varsa
  IF NEW.status != 'completed' OR (OLD.status = 'completed') OR NEW.total_risks_found = 0 THEN
    RETURN NEW;
  END IF;

  -- Idempotent: zaten bu session için assessment varsa tekrar oluşturma
  IF EXISTS (SELECT 1 FROM public.risk_assessments WHERE metadata->>'source_session_id' = NEW.id::text) THEN
    RETURN NEW;
  END IF;

  -- Kullanıcının organization_id'sini bul
  SELECT organization_id INTO v_org_id
  FROM public.user_profiles
  WHERE auth_user_id = NEW.user_id
  LIMIT 1;

  -- Overall risk level hesapla
  SELECT
    COUNT(*) FILTER (WHERE risk_level = 'critical'),
    COUNT(*) FILTER (WHERE risk_level = 'high'),
    COUNT(*) FILTER (WHERE risk_level = 'medium')
  INTO v_critical_count, v_high_count, v_medium_count
  FROM public.scan_detections
  WHERE session_id = NEW.id;

  IF v_critical_count > 0 THEN v_overall_level := 'critical';
  ELSIF v_high_count > 0 THEN v_overall_level := 'high';
  ELSIF v_medium_count > 0 THEN v_overall_level := 'medium';
  ELSE v_overall_level := 'low';
  END IF;

  -- risk_assessment kaydı oluştur
  INSERT INTO public.risk_assessments (
    title,
    status,
    method,
    assessment_date,
    workplace_name,
    location_text,
    analysis_note,
    company_workspace_id,
    item_count,
    overall_risk_level,
    created_by,
    metadata
  ) VALUES (
    'Otomatik: ' || COALESCE(NEW.location_name, 'Saha Taraması'),
    'completed',
    COALESCE(NEW.risk_method, 'l_matrix'),
    NEW.created_at::date,
    NEW.location_name,
    NEW.location_name,
    'Canlı saha taramasından otomatik üretildi. Süre: ' || COALESCE(NEW.duration_seconds, 0) || 'sn, Nokta: ' || COALESCE(NEW.total_frames_analyzed, 0),
    NEW.company_id,
    NEW.total_risks_found,
    v_overall_level,
    NEW.user_id,
    jsonb_build_object(
      'source', 'auto_from_scan',
      'source_session_id', NEW.id,
      'auto_created_at', now()
    )
  ) RETURNING id INTO v_assessment_id;

  -- Ana row oluştur
  INSERT INTO public.risk_assessment_rows (
    assessment_id,
    title,
    description,
    sort_order
  ) VALUES (
    v_assessment_id,
    'Canlı Tarama Bulguları',
    'Saha taraması sırasında AI tarafından tespit edilen riskler',
    1
  ) RETURNING id INTO v_row_id;

  -- Tüm detections'ı findings olarak kopyala
  FOR v_detection IN
    SELECT * FROM public.scan_detections WHERE session_id = NEW.id ORDER BY created_at
  LOOP
    INSERT INTO public.risk_assessment_findings (
      row_id,
      title,
      category,
      severity,
      confidence,
      is_manual,
      corrective_action_required,
      recommendation,
      action_text
    ) VALUES (
      v_row_id,
      v_detection.risk_name,
      COALESCE(v_detection.risk_category, 'diger'),
      v_detection.risk_level,
      v_detection.confidence,
      false,
      (v_detection.risk_level IN ('critical', 'high')),
      v_detection.recommended_action,
      v_detection.recommended_action
    );

    -- Detection'ı assessment'a link'le
    UPDATE public.scan_detections
    SET transferred_to_assessment = v_assessment_id
    WHERE id = v_detection.id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger bağla
DROP TRIGGER IF EXISTS trig_auto_create_assessment ON public.scan_sessions;
CREATE TRIGGER trig_auto_create_assessment
  AFTER UPDATE ON public.scan_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_risk_assessment_from_scan();

-- Metadata kolonu ekle
ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_assessments_source_session
  ON public.risk_assessments((metadata->>'source_session_id'));
;
