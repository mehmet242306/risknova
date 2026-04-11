
-- Mükerrer kayıtları engellemek için unique constraint ekle
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_documents_unique 
ON public.legal_documents(title, doc_number) 
WHERE doc_number IS NOT NULL;
;
