-- 7 yeni risk analiz yöntemi: FMEA, HAZOP, Bow-Tie, FTA, Checklist, JSA, LOPA
-- DB destegi: method constraint genisleme + 7 yeni JSONB kolon cifti

-- 1. risk_assessments method check constraint guncelle
ALTER TABLE public.risk_assessments
  DROP CONSTRAINT IF EXISTS risk_assessments_method_check;
ALTER TABLE public.risk_assessments
  ADD CONSTRAINT risk_assessments_method_check
  CHECK (method IN ('r_skor', 'fine_kinney', 'l_matrix', 'fmea', 'hazop', 'bow_tie', 'fta', 'checklist', 'jsa', 'lopa'));
-- 2. risk_assessment_findings: 7 yeni values/result JSONB kolonu
ALTER TABLE public.risk_assessment_findings
  ADD COLUMN IF NOT EXISTS fmea_values jsonb DEFAULT '{"severity":5,"occurrence":5,"detection":5}',
  ADD COLUMN IF NOT EXISTS fmea_result jsonb,
  ADD COLUMN IF NOT EXISTS hazop_values jsonb DEFAULT '{"severity":3,"likelihood":3,"detectability":3,"guideWord":"Çok (More)","parameter":"Akış (Flow)","deviation":""}',
  ADD COLUMN IF NOT EXISTS hazop_result jsonb,
  ADD COLUMN IF NOT EXISTS bow_tie_values jsonb DEFAULT '{"threatProbability":3,"consequenceSeverity":3,"preventionBarriers":1,"mitigationBarriers":1}',
  ADD COLUMN IF NOT EXISTS bow_tie_result jsonb,
  ADD COLUMN IF NOT EXISTS fta_values jsonb DEFAULT '{"components":[],"gateType":"OR","systemCriticality":3}',
  ADD COLUMN IF NOT EXISTS fta_result jsonb,
  ADD COLUMN IF NOT EXISTS checklist_values jsonb DEFAULT '{"items":[],"category":"Genel"}',
  ADD COLUMN IF NOT EXISTS checklist_result jsonb,
  ADD COLUMN IF NOT EXISTS jsa_values jsonb DEFAULT '{"jobTitle":"","steps":[]}',
  ADD COLUMN IF NOT EXISTS jsa_result jsonb,
  ADD COLUMN IF NOT EXISTS lopa_values jsonb DEFAULT '{"initiatingEventFreq":0.1,"consequenceSeverity":3,"layers":[]}',
  ADD COLUMN IF NOT EXISTS lopa_result jsonb;
