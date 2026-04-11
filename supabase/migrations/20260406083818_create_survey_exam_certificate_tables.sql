
-- ============================================================
-- ANKET / SINAV / SERTİFİKA SİSTEMİ TABLOLARI
-- ============================================================

-- 1. Anket/Sinav tanimlari
CREATE TABLE surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES company_workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('survey', 'exam')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  settings jsonb DEFAULT '{}',
  pass_score integer,
  time_limit_minutes integer,
  shuffle_questions boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Sorular
CREATE TABLE survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'open_ended', 'scale', 'yes_no', 'multi_select')),
  options jsonb,
  required boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  points integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 3. Kisiye ozel token (dampali link)
CREATE TABLE survey_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
  personnel_id uuid REFERENCES personnel(id) ON DELETE SET NULL,
  token text UNIQUE NOT NULL,
  person_name text,
  person_email text,
  person_phone text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'completed', 'expired')),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 4. Yanit kayitlari
CREATE TABLE survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
  token_id uuid REFERENCES survey_tokens(id) ON DELETE CASCADE,
  question_id uuid REFERENCES survey_questions(id) ON DELETE CASCADE,
  answer jsonb,
  is_correct boolean,
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. Sertifika sablonlari
CREATE TABLE certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_html text,
  variables jsonb DEFAULT '[]',
  style jsonb DEFAULT '{}',
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 6. Uretilen sertifikalar
CREATE TABLE certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES certificate_templates(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES company_workspaces(id) ON DELETE CASCADE,
  personnel_id uuid REFERENCES personnel(id) ON DELETE SET NULL,
  survey_id uuid REFERENCES surveys(id) ON DELETE SET NULL,
  token_id uuid REFERENCES survey_tokens(id) ON DELETE SET NULL,
  certificate_no text UNIQUE,
  person_name text NOT NULL,
  training_name text,
  training_date date,
  training_duration text,
  trainer_name text,
  company_name text,
  score integer,
  qr_code text,
  issued_at timestamptz DEFAULT now(),
  valid_until timestamptz,
  metadata jsonb DEFAULT '{}'
);

-- ============================================================
-- INDEXLER
-- ============================================================
CREATE INDEX idx_surveys_org ON surveys(organization_id);
CREATE INDEX idx_surveys_company ON surveys(company_id);
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_survey_questions_survey ON survey_questions(survey_id);
CREATE INDEX idx_survey_tokens_survey ON survey_tokens(survey_id);
CREATE INDEX idx_survey_tokens_token ON survey_tokens(token);
CREATE INDEX idx_survey_tokens_personnel ON survey_tokens(personnel_id);
CREATE INDEX idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_token ON survey_responses(token_id);
CREATE INDEX idx_certificates_org ON certificates(organization_id);
CREATE INDEX idx_certificates_company ON certificates(company_id);
CREATE INDEX idx_certificates_personnel ON certificates(personnel_id);
CREATE INDEX idx_certificates_no ON certificates(certificate_no);

-- ============================================================
-- RLS POLİTİKALARI
-- ============================================================
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Surveys: org members can CRUD
CREATE POLICY surveys_select ON surveys FOR SELECT USING (
  organization_id IN (SELECT id FROM organizations WHERE id = organization_id)
);
CREATE POLICY surveys_insert ON surveys FOR INSERT WITH CHECK (true);
CREATE POLICY surveys_update ON surveys FOR UPDATE USING (true);
CREATE POLICY surveys_delete ON surveys FOR DELETE USING (true);

-- Survey questions: via survey
CREATE POLICY survey_questions_select ON survey_questions FOR SELECT USING (true);
CREATE POLICY survey_questions_insert ON survey_questions FOR INSERT WITH CHECK (true);
CREATE POLICY survey_questions_update ON survey_questions FOR UPDATE USING (true);
CREATE POLICY survey_questions_delete ON survey_questions FOR DELETE USING (true);

-- Survey tokens: auth users + anon (for public fill)
CREATE POLICY survey_tokens_select ON survey_tokens FOR SELECT USING (true);
CREATE POLICY survey_tokens_insert ON survey_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY survey_tokens_update ON survey_tokens FOR UPDATE USING (true);

-- Survey responses: auth + anon
CREATE POLICY survey_responses_select ON survey_responses FOR SELECT USING (true);
CREATE POLICY survey_responses_insert ON survey_responses FOR INSERT WITH CHECK (true);

-- Certificate templates
CREATE POLICY cert_templates_select ON certificate_templates FOR SELECT USING (true);
CREATE POLICY cert_templates_insert ON certificate_templates FOR INSERT WITH CHECK (true);
CREATE POLICY cert_templates_update ON certificate_templates FOR UPDATE USING (true);
CREATE POLICY cert_templates_delete ON certificate_templates FOR DELETE USING (true);

-- Certificates
CREATE POLICY certificates_select ON certificates FOR SELECT USING (true);
CREATE POLICY certificates_insert ON certificates FOR INSERT WITH CHECK (true);
CREATE POLICY certificates_update ON certificates FOR UPDATE USING (true);
;
