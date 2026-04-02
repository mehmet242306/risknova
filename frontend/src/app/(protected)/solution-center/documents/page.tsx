"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { downloadDocument, type DocumentBlock } from "@/lib/document-generator";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface DocumentRecord {
  id: string;
  query_id: string;
  doc_type: string;
  doc_title: string | null;
  doc_content: string | null;
  created_at: string;
}

const docTypeConfig: Record<string, { label: string; badge: "default" | "accent" | "success" | "warning" }> = {
  docx: { label: "Word", badge: "default" },
  xlsx: { label: "Excel", badge: "success" },
  pptx: { label: "PowerPoint", badge: "warning" },
  pdf: { label: "PDF", badge: "accent" },
};

/* ------------------------------------------------------------------ */
/* Document type icon                                                  */
/* ------------------------------------------------------------------ */

function DocIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    docx: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    xlsx: "bg-green-500/10 text-green-600 dark:text-green-400",
    pptx: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    pdf: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  const icons: Record<string, React.ReactNode> = {
    pptx: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    ),
    docx: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  };

  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-xl ${
        colors[type] || "bg-secondary text-muted-foreground"
      }`}
    >
      {icons[type] || <span className="text-sm font-bold">{type.toUpperCase().slice(0, 3)}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Download button                                                     */
/* ------------------------------------------------------------------ */

function DownloadButton({ doc }: { doc: DocumentRecord }) {
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleDownload() {
    if (!doc.doc_content) return;
    setDownloading(true);
    try {
      const block: DocumentBlock = {
        title: doc.doc_title || "Dokuman",
        type: doc.doc_type as "docx" | "pptx",
        content: doc.doc_content,
      };
      await downloadDocument(block);
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch {
      // silently fail
    } finally {
      setDownloading(false);
    }
  }

  if (!doc.doc_content) return null;

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium transition-colors",
        done ? "text-emerald-500 border-emerald-500/30" : "text-primary hover:bg-secondary",
        downloading && "opacity-70 cursor-wait",
      )}
    >
      {downloading ? (
        <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : done ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
      {done ? "İndirildi" : "İndir"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Documents page                                                      */
/* ------------------------------------------------------------------ */

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocuments() {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch documents that belong to user's queries
      const { data } = await supabase
        .from("solution_documents")
        .select(
          `
          id,
          query_id,
          doc_type,
          doc_title,
          doc_content,
          created_at,
          solution_queries!inner(user_id)
        `,
        )
        .eq("solution_queries.user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setDocuments((data as unknown as DocumentRecord[]) || []);
      setLoading(false);
    }

    fetchDocuments();
  }, []);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Cozum Merkezi"
        title="Dokumanlarim"
        description="Cozum Merkezi araciligiyla olusturulan dokumanlariniz burada listelenir. Tekrar indirmek icin karta tiklayin."
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          title="Henuz dokuman yok"
          description="Cozum Merkezi sohbetlerinde AI'dan dokuman olusturmasini istediginizde, dokumanlariniz burada gorunecektir. Ornegin: 'Bu konuda bir sunum hazirla' veya 'Rapor olustur' diyebilirsiniz."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const config = docTypeConfig[doc.doc_type] || {
              label: doc.doc_type,
              badge: "neutral" as const,
            };

            return (
              <Card key={doc.id}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <DocIcon type={doc.doc_type} />
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">
                        {doc.doc_title || "Isimsiz Dokuman"}
                      </CardTitle>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={config.badge}>{config.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(doc.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <DownloadButton doc={doc} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
