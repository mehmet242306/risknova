
-- Add sharing fields to editor_documents
ALTER TABLE editor_documents
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

-- Create index for share token lookups
CREATE INDEX IF NOT EXISTS idx_editor_documents_share_token ON editor_documents(share_token) WHERE is_shared = true;

-- Document signatures table
CREATE TABLE IF NOT EXISTS document_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES editor_documents(id) ON DELETE CASCADE,
  signer_user_id UUID,
  signer_name TEXT NOT NULL,
  signer_role TEXT NOT NULL DEFAULT 'İSG Uzmanı',
  signature_image_url TEXT,
  signed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  certificate_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_signatures_document ON document_signatures(document_id);

-- Enable RLS
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_signatures
CREATE POLICY "Users can view signatures for their org documents"
  ON document_signatures FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM editor_documents
      WHERE organization_id IN (
        SELECT organization_id FROM user_profiles
        WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create signatures for their org documents"
  ON document_signatures FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM editor_documents
      WHERE organization_id IN (
        SELECT organization_id FROM user_profiles
        WHERE auth_user_id = auth.uid()
      )
    )
  );
;
