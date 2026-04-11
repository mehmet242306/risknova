
-- Madde türlerini desteklemek için legal_chunks tablosunu güncelle

-- 1. Madde türü kolonu ekle
ALTER TABLE public.legal_chunks 
ADD COLUMN IF NOT EXISTS article_type text DEFAULT 'normal';
-- Değerler: 'normal', 'ek', 'gecici', 'mukerrer'

-- 2. Normalize edilmiş madde numarası (sadece sayı)
ALTER TABLE public.legal_chunks 
ADD COLUMN IF NOT EXISTS article_number_normalized text;
-- Örnek: "Madde 13" → "13", "Ek Madde 5" → "Ek 5", "Geçici Madde 10" → "Geçici 10"

-- 3. Tam referans formatı (kullanıcıya gösterilecek)
ALTER TABLE public.legal_chunks 
ADD COLUMN IF NOT EXISTS reference_format text;
-- Örnek: "5510 sayılı Kanun'un 13. maddesi"

-- 4. Fıkra numarası (varsa)
ALTER TABLE public.legal_chunks 
ADD COLUMN IF NOT EXISTS paragraph_number int;

-- 5. Bent harfi (varsa)
ALTER TABLE public.legal_chunks 
ADD COLUMN IF NOT EXISTS subparagraph_letter text;

-- article_type için constraint
ALTER TABLE public.legal_chunks 
DROP CONSTRAINT IF EXISTS legal_chunks_article_type_check;

ALTER TABLE public.legal_chunks 
ADD CONSTRAINT legal_chunks_article_type_check 
CHECK (article_type IN ('normal', 'ek', 'gecici', 'mukerrer'));

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_legal_chunks_article_type ON public.legal_chunks(article_type);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_article_number_normalized ON public.legal_chunks(article_number_normalized);

-- Yorum ekle
COMMENT ON COLUMN public.legal_chunks.article_type IS 'Madde türü: normal, ek (Ek Madde), gecici (Geçici Madde), mukerrer (Madde X/A)';
COMMENT ON COLUMN public.legal_chunks.article_number_normalized IS 'Normalize edilmiş madde numarası: "13", "Ek 5", "Geçici 10", "10/A"';
COMMENT ON COLUMN public.legal_chunks.reference_format IS 'Tam referans formatı: "5510 sayılı Kanun''un 13. maddesi"';
;
