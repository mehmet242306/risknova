import { createClient } from './client';

// ============================================================
// Document API — CRUD for editor_documents, templates, versions
// ============================================================

export interface DocumentRecord {
  id: string;
  organization_id: string;
  company_workspace_id: string | null;
  template_id: string | null;
  group_key: string;
  title: string;
  content_json: Record<string, unknown>;
  variables_data: Record<string, unknown>;
  status: 'taslak' | 'hazir' | 'onay_bekliyor' | 'revizyon' | 'arsiv';
  version: number;
  prepared_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  share_token: string | null;
  is_shared: boolean;
  shared_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentSignatureRecord {
  id: string;
  document_id: string;
  signer_user_id: string | null;
  signer_name: string;
  signer_role: string;
  signature_image_url: string | null;
  signed_at: string;
  ip_address: string | null;
  certificate_hash: string | null;
  created_at: string;
}

export interface DocumentVersionRecord {
  id: string;
  document_id: string;
  version: number;
  content_json: Record<string, unknown>;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}

// ---- Documents ----

export async function fetchDocuments(
  orgId: string,
  workspaceId?: string
): Promise<DocumentRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from('editor_documents')
    .select('*')
    .eq('organization_id', orgId)
    .neq('status', 'arsiv')
    .order('updated_at', { ascending: false });

  if (workspaceId) {
    query = query.eq('company_workspace_id', workspaceId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('fetchDocuments error:', error);
    return [];
  }
  return (data || []) as DocumentRecord[];
}

export async function fetchDocument(id: string): Promise<DocumentRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('editor_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('fetchDocument error:', error);
    return null;
  }
  return data as DocumentRecord;
}

export async function createDocument(
  doc: Omit<DocumentRecord, 'id' | 'created_at' | 'updated_at' | 'version' | 'approved_by' | 'approved_at' | 'share_token' | 'is_shared' | 'shared_at'>
): Promise<DocumentRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('editor_documents')
    .insert({
      ...doc,
      version: 1,
    })
    .select()
    .single();

  if (error) {
    console.error('createDocument error:', error);
    return null;
  }
  return data as DocumentRecord;
}

export async function updateDocument(
  id: string,
  updates: Partial<Pick<DocumentRecord, 'title' | 'content_json' | 'variables_data' | 'status' | 'version'>>
): Promise<DocumentRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('editor_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('updateDocument error:', error);
    return null;
  }
  return data as DocumentRecord;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('editor_documents')
    .update({ status: 'arsiv' })
    .eq('id', id);

  return !error;
}

// ---- Versions ----

export async function createVersion(
  documentId: string,
  version: number,
  contentJson: Record<string, unknown>,
  changedBy: string | null,
  changeReason?: string
): Promise<DocumentVersionRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('editor_document_versions')
    .insert({
      document_id: documentId,
      version,
      content_json: contentJson,
      changed_by: changedBy,
      change_reason: changeReason || null,
    })
    .select()
    .single();

  if (error) {
    console.error('createVersion error:', error);
    return null;
  }
  return data as DocumentVersionRecord;
}

export async function fetchVersions(documentId: string): Promise<DocumentVersionRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('editor_document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version', { ascending: false });

  if (error) {
    console.error('fetchVersions error:', error);
    return [];
  }
  return (data || []) as DocumentVersionRecord[];
}

// ---- Sharing ----

export async function toggleDocumentSharing(id: string, shared: boolean): Promise<DocumentRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('editor_documents')
    .update({
      is_shared: shared,
      shared_at: shared ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('toggleDocumentSharing error:', error);
    return null;
  }
  return data as DocumentRecord;
}

export async function fetchDocumentByShareToken(token: string): Promise<DocumentRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('editor_documents')
    .select('*')
    .eq('share_token', token)
    .eq('is_shared', true)
    .single();

  if (error) return null;
  return data as DocumentRecord;
}

// ---- Signatures ----

export async function createSignature(
  sig: Omit<DocumentSignatureRecord, 'id' | 'created_at' | 'signed_at'>
): Promise<DocumentSignatureRecord | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('document_signatures')
    .insert(sig)
    .select()
    .single();

  if (error) {
    console.error('createSignature error:', error);
    return null;
  }
  return data as DocumentSignatureRecord;
}

export async function fetchSignatures(documentId: string): Promise<DocumentSignatureRecord[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('document_signatures')
    .select('*')
    .eq('document_id', documentId)
    .order('signed_at', { ascending: true });

  if (error) return [];
  return (data || []) as DocumentSignatureRecord[];
}
