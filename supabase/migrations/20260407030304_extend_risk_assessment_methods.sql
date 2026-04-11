
-- Extend risk_assessments method CHECK constraint to include 7 new methods
ALTER TABLE risk_assessments DROP CONSTRAINT IF EXISTS risk_assessments_method_check;
ALTER TABLE risk_assessments ADD CONSTRAINT risk_assessments_method_check 
  CHECK (method IN ('r_skor', 'fine_kinney', 'l_matrix', 'fmea', 'hazop', 'bow_tie', 'fta', 'checklist', 'jsa', 'lopa'));
;
