import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { SharedDocumentView } from './SharedDocumentView';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharedDocumentPage({ params }: Props) {
  const { token } = await params;
  const supabase = await createClient();

  // Fetch document by share token
  const { data: doc } = await supabase
    .from('editor_documents')
    .select('*')
    .eq('share_token', token)
    .eq('is_shared', true)
    .single();

  if (!doc) {
    notFound();
  }

  // Fetch signatures
  const { data: signatures } = await supabase
    .from('document_signatures')
    .select('*')
    .eq('document_id', doc.id)
    .order('signed_at', { ascending: true });

  // Fetch company info if available
  let companyName = '';
  if (doc.organization_id) {
    const { data: workspaces } = await supabase
      .from('company_workspaces')
      .select('company_identity_id, display_name')
      .eq('organization_id', doc.organization_id)
      .limit(1);

    if (workspaces && workspaces.length > 0) {
      const { data: company } = await supabase
        .from('company_identities')
        .select('official_name')
        .eq('id', workspaces[0].company_identity_id)
        .single();
      companyName = company?.official_name || workspaces[0].display_name || '';
    }
  }

  return (
    <SharedDocumentView
      title={doc.title}
      contentJson={doc.content_json}
      companyName={companyName}
      status={doc.status}
      createdAt={doc.created_at}
      signatures={signatures || []}
    />
  );
}
