
-- ============================================================
-- AI Learning Archive: Silinen firma verilerinden anonim ogrenme
-- ============================================================

CREATE TABLE public.ai_learning_archive (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_workspace_id uuid,  -- FK yok, sadece dedup icin
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Anonim firma profili
  sector text,
  nace_code text,
  hazard_class text,
  employee_count_range text,  -- '1-9', '10-49', '50-249', '250+'
  city text,

  -- Risk analiz ozetleri
  total_assessments integer DEFAULT 0,
  methods_used text[] DEFAULT '{}',
  risk_level_distribution jsonb DEFAULT '{}',
  top_hazard_categories jsonb DEFAULT '[]',
  top_findings_summary jsonb DEFAULT '[]',
  common_corrective_actions jsonb DEFAULT '[]',

  -- Olay ozetleri
  total_incidents integer DEFAULT 0,
  incident_type_distribution jsonb DEFAULT '{}',
  common_injury_types jsonb DEFAULT '[]',
  common_injury_causes jsonb DEFAULT '[]',
  avg_days_lost numeric DEFAULT 0,
  severity_distribution jsonb DEFAULT '{}',

  -- Personel profili (sadece sayilar)
  department_distribution jsonb DEFAULT '{}',
  position_distribution jsonb DEFAULT '{}',

  -- Meta
  data_period_start date,
  data_period_end date,
  archived_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_learning_sector ON public.ai_learning_archive(sector);
CREATE INDEX idx_ai_learning_nace ON public.ai_learning_archive(nace_code);
CREATE INDEX idx_ai_learning_hazard ON public.ai_learning_archive(hazard_class);
CREATE INDEX idx_ai_learning_org ON public.ai_learning_archive(organization_id);
CREATE INDEX idx_ai_learning_source ON public.ai_learning_archive(source_workspace_id);

-- RLS
ALTER TABLE public.ai_learning_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org archive"
  ON public.ai_learning_archive FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: Soft delete tetiklendiginde otomatik arsivle
-- ============================================================
CREATE OR REPLACE FUNCTION archive_company_learning_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws record;
  ci record;
  emp_count integer;
  emp_range text;
  ra_count integer;
  ra_methods text[];
  risk_dist jsonb;
  top_hazards jsonb;
  top_findings jsonb;
  top_actions jsonb;
  inc_count integer;
  inc_types jsonb;
  inj_types jsonb;
  inj_causes jsonb;
  avg_lost numeric;
  sev_dist jsonb;
  dept_dist jsonb;
  pos_dist jsonb;
  period_start date;
  period_end date;
BEGIN
  -- Sadece deleted_at yeni set edildiginde calis
  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Company identity bilgilerini al
  SELECT * INTO ci FROM company_identities WHERE id = NEW.id;

  -- Her workspace icin arsivle
  FOR ws IN SELECT * FROM company_workspaces WHERE company_identity_id = NEW.id
  LOOP
    -- Zaten arsivlenmis mi kontrol et
    IF EXISTS (SELECT 1 FROM ai_learning_archive WHERE source_workspace_id = ws.id) THEN
      CONTINUE;
    END IF;

    -- Calisan sayisi
    emp_count := COALESCE((ws.metadata->>'employeeCount')::integer, 0);
    emp_range := CASE
      WHEN emp_count <= 9 THEN '1-9'
      WHEN emp_count <= 49 THEN '10-49'
      WHEN emp_count <= 249 THEN '50-249'
      ELSE '250+'
    END;

    -- Risk analizleri
    SELECT
      COUNT(*),
      COALESCE(array_agg(DISTINCT ra.method) FILTER (WHERE ra.method IS NOT NULL), '{}'),
      COALESCE(jsonb_object_agg(ra.overall_risk_level, cnt) FILTER (WHERE ra.overall_risk_level IS NOT NULL), '{}'),
      MIN(ra.assessment_date),
      MAX(ra.assessment_date)
    INTO ra_count, ra_methods, risk_dist, period_start, period_end
    FROM (
      SELECT method, overall_risk_level, assessment_date, COUNT(*) OVER (PARTITION BY overall_risk_level) as cnt
      FROM risk_assessments
      WHERE company_workspace_id = ws.id
    ) ra;

    -- Risk seviye dagilimi duzelt
    SELECT COALESCE(
      jsonb_object_agg(overall_risk_level, level_count),
      '{}'
    ) INTO risk_dist
    FROM (
      SELECT overall_risk_level, COUNT(*) as level_count
      FROM risk_assessments
      WHERE company_workspace_id = ws.id AND overall_risk_level IS NOT NULL
      GROUP BY overall_risk_level
    ) sub;

    -- En sik tehlike kategorileri (findings tablosundan)
    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]')
    INTO top_hazards
    FROM (
      SELECT category, COUNT(*) as count, ROUND(AVG(
        CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END
      ), 1) as avg_severity
      FROM risk_assessment_findings raf
      JOIN risk_assessments ra ON ra.id = raf.assessment_id
      WHERE ra.company_workspace_id = ws.id AND raf.category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    ) sub;

    -- En sik tespitler
    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]')
    INTO top_findings
    FROM (
      SELECT title, severity, COUNT(*) as frequency
      FROM risk_assessment_findings raf
      JOIN risk_assessments ra ON ra.id = raf.assessment_id
      WHERE ra.company_workspace_id = ws.id AND raf.title IS NOT NULL
      GROUP BY title, severity
      ORDER BY frequency DESC
      LIMIT 15
    ) sub;

    -- En sik onerilen aksiyonlar
    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]')
    INTO top_actions
    FROM (
      SELECT recommendation as action, COUNT(*) as count
      FROM risk_assessment_findings raf
      JOIN risk_assessments ra ON ra.id = raf.assessment_id
      WHERE ra.company_workspace_id = ws.id AND raf.recommendation IS NOT NULL
      GROUP BY recommendation
      ORDER BY count DESC
      LIMIT 10
    ) sub;

    -- Olaylar
    SELECT COUNT(*) INTO inc_count
    FROM incidents WHERE company_workspace_id = ws.id;

    SELECT COALESCE(jsonb_object_agg(incident_type, type_count), '{}')
    INTO inc_types
    FROM (
      SELECT incident_type, COUNT(*) as type_count
      FROM incidents WHERE company_workspace_id = ws.id AND incident_type IS NOT NULL
      GROUP BY incident_type
    ) sub;

    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]')
    INTO inj_types
    FROM (
      SELECT injury_type, COUNT(*) as count
      FROM incidents WHERE company_workspace_id = ws.id AND injury_type IS NOT NULL
      GROUP BY injury_type ORDER BY count DESC LIMIT 10
    ) sub;

    SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]')
    INTO inj_causes
    FROM (
      SELECT injury_cause_event as cause, COUNT(*) as count
      FROM incidents WHERE company_workspace_id = ws.id AND injury_cause_event IS NOT NULL
      GROUP BY injury_cause_event ORDER BY count DESC LIMIT 10
    ) sub;

    SELECT COALESCE(AVG(days_lost), 0) INTO avg_lost
    FROM incidents WHERE company_workspace_id = ws.id;

    SELECT COALESCE(jsonb_object_agg(severity_level, sev_count), '{}')
    INTO sev_dist
    FROM (
      SELECT severity_level, COUNT(*) as sev_count
      FROM incidents WHERE company_workspace_id = ws.id AND severity_level IS NOT NULL
      GROUP BY severity_level
    ) sub;

    -- Personel dagilimi
    SELECT COALESCE(jsonb_object_agg(department, dept_count), '{}')
    INTO dept_dist
    FROM (
      SELECT department, COUNT(*) as dept_count
      FROM company_personnel WHERE company_workspace_id = ws.id AND department IS NOT NULL
      GROUP BY department
    ) sub;

    SELECT COALESCE(jsonb_object_agg(position, pos_count), '{}')
    INTO pos_dist
    FROM (
      SELECT position, COUNT(*) as pos_count
      FROM company_personnel WHERE company_workspace_id = ws.id AND position IS NOT NULL
      GROUP BY position
    ) sub;

    -- Arsive kaydet
    INSERT INTO ai_learning_archive (
      source_workspace_id, organization_id,
      sector, nace_code, hazard_class, employee_count_range, city,
      total_assessments, methods_used, risk_level_distribution,
      top_hazard_categories, top_findings_summary, common_corrective_actions,
      total_incidents, incident_type_distribution, common_injury_types,
      common_injury_causes, avg_days_lost, severity_distribution,
      department_distribution, position_distribution,
      data_period_start, data_period_end
    ) VALUES (
      ws.id, (SELECT organization_id FROM company_workspaces WHERE id = ws.id),
      ci.sector, ci.nace_code, ci.hazard_class, emp_range, ci.city,
      COALESCE(ra_count, 0), ra_methods, risk_dist,
      top_hazards, top_findings, top_actions,
      inc_count, inc_types, inj_types,
      inj_causes, avg_lost, sev_dist,
      dept_dist, pos_dist,
      period_start, period_end
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger: company_identities uzerinde deleted_at degistiginde
CREATE TRIGGER trg_archive_company_learning
  AFTER UPDATE OF deleted_at ON public.company_identities
  FOR EACH ROW
  EXECUTE FUNCTION archive_company_learning_data();
;
