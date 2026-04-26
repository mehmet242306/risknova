'use client';

import dynamic from 'next/dynamic';

const DocumentEditorClient = dynamic(
  () => import('./DocumentEditorClient').then((m) => m.DocumentEditorClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Editör yükleniyor…</span>
        </div>
      </div>
    ),
  },
);

export default function DocumentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <DocumentEditorClient paramsPromise={params} />;
}
