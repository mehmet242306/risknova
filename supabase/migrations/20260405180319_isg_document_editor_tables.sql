-- ISG Document Editor System (separate from file-based company_documents)

-- 1. Document Templates (system + custom)
CREATE TABLE IF NOT EXISTS document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  group_key     TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  content_json  JSONB NOT NULL DEFAULT '{}',
  variables     TEXT[] NOT NULL DEFAULT '{}',
  is_system     BOOLEAN NOT NULL DEFAULT false,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),
  created_by    UUID REFERENCES user_profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Editor Documents (TipTap content based)
CREATE TABLE IF NOT EXISTS editor_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_workspace_id UUID REFERENCES company_workspaces(id) ON DELETE SET NULL,
  template_id         UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  group_key           TEXT NOT NULL,
  title               TEXT NOT NULL,
  content_json        JSONB NOT NULL DEFAULT '{}',
  variables_data      JSONB NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'taslak' CHECK (status IN ('taslak','hazir','onay_bekliyor','revizyon','arsiv')),
  version             INTEGER NOT NULL DEFAULT 1,
  prepared_by         UUID REFERENCES user_profiles(id),
  approved_by         UUID REFERENCES user_profiles(id),
  approved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Editor Document Versions (history)
CREATE TABLE IF NOT EXISTS editor_document_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES editor_documents(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  content_json  JSONB NOT NULL DEFAULT '{}',
  changed_by    UUID REFERENCES user_profiles(id),
  change_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_templates_org ON document_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_group ON document_templates(group_key);
CREATE INDEX IF NOT EXISTS idx_editor_documents_org ON editor_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_editor_documents_workspace ON editor_documents(company_workspace_id);
CREATE INDEX IF NOT EXISTS idx_editor_documents_group ON editor_documents(group_key);
CREATE INDEX IF NOT EXISTS idx_editor_documents_status ON editor_documents(status);
CREATE INDEX IF NOT EXISTS idx_editor_document_versions_doc ON editor_document_versions(document_id);

-- Updated_at triggers
CREATE TRIGGER set_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER set_editor_documents_updated_at
  BEFORE UPDATE ON editor_documents
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select_own_org" ON document_templates
  FOR SELECT USING (organization_id = current_organization_id() OR is_system = true);

CREATE POLICY "templates_insert_own_org" ON document_templates
  FOR INSERT WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "templates_update_own_org" ON document_templates
  FOR UPDATE USING (organization_id = current_organization_id());

CREATE POLICY "editor_docs_select_own_org" ON editor_documents
  FOR SELECT USING (organization_id = current_organization_id());

CREATE POLICY "editor_docs_insert_own_org" ON editor_documents
  FOR INSERT WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "editor_docs_update_own_org" ON editor_documents
  FOR UPDATE USING (organization_id = current_organization_id());

CREATE POLICY "editor_docs_delete_own_org" ON editor_documents
  FOR DELETE USING (organization_id = current_organization_id());

CREATE POLICY "editor_doc_versions_select" ON editor_document_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM editor_documents ed WHERE ed.id = editor_document_versions.document_id AND ed.organization_id = current_organization_id())
  );

CREATE POLICY "editor_doc_versions_insert" ON editor_document_versions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM editor_documents ed WHERE ed.id = editor_document_versions.document_id AND ed.organization_id = current_organization_id())
  );;
