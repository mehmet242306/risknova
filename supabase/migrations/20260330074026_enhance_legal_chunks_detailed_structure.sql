
-- Mevzuat Referans Sistemini Detaylandır

-- 1. Fıkra ve Bent bilgileri için yeni kolonlar
ALTER TABLE public.legal_chunks 
ADD COLUMN IF NOT EXISTS paragraph_numbers int[] DEFAULT '{}',  -- Fıkra numaraları (1, 2, 3...)
ADD COLUMN IF NOT EXISTS subparagraphs jsonb DEFAULT '[]',      -- Bentler (a, b, c... veya 1), 2), 3)...)
ADD COLUMN IF NOT EXISTS amendment_info jsonb DEFAULT '{}',     -- Değişiklik bilgisi
ADD COLUMN IF NOT EXISTS effective_date date,                    -- Yürürlük tarihi
ADD COLUMN IF NOT EXISTS is_repealed boolean DEFAULT false,      -- Mülga mı?
ADD COLUMN IF NOT EXISTS repealed_by text,                       -- Hangi düzenleme ile mülga edildi
ADD COLUMN IF NOT EXISTS related_articles text[] DEFAULT '{}',   -- İlişkili maddeler
ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}',           -- Anahtar kelimeler
ADD COLUMN IF NOT EXISTS summary text;                           -- Madde özeti

-- 2. Madde içi referanslar tablosu (çapraz referanslar)
CREATE TABLE IF NOT EXISTS public.legal_cross_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_chunk_id uuid REFERENCES public.legal_chunks(id) ON DELETE CASCADE,
  target_document_id uuid REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  target_article_number text NOT NULL,
  reference_text text,          -- Orijinal referans metni
  reference_type text,          -- 'direct', 'amendment', 'exception', 'definition'
  created_at timestamptz DEFAULT now()
);

-- 3. Madde geçmişi (değişiklik takibi)
CREATE TABLE IF NOT EXISTS public.legal_article_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid REFERENCES public.legal_chunks(id) ON DELETE CASCADE,
  version_number int NOT NULL DEFAULT 1,
  previous_content text,
  change_type text,             -- 'eklenen', 'değişen', 'mülga'
  change_law_number text,       -- Değiştiren kanun numarası
  change_law_date date,         -- Değişiklik tarihi
  change_description text,
  created_at timestamptz DEFAULT now()
);

-- 4. Sektör-Madde ilişkileri
CREATE TABLE IF NOT EXISTS public.legal_sector_relevance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid REFERENCES public.legal_chunks(id) ON DELETE CASCADE,
  nace_code text NOT NULL,
  sector_name text NOT NULL,
  relevance_score float DEFAULT 0.5,  -- 0-1 arası önem derecesi
  relevance_reason text,              -- Neden ilgili
  created_at timestamptz DEFAULT now(),
  UNIQUE(chunk_id, nace_code)
);

-- 5. Anahtar kelime çıkarma fonksiyonu
CREATE OR REPLACE FUNCTION extract_legal_keywords(content text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  keywords text[] := '{}';
  keyword text;
BEGIN
  -- İSG ile ilgili anahtar kelimeleri çıkar
  IF content ~* 'iş kazası' THEN keywords := array_append(keywords, 'iş kazası'); END IF;
  IF content ~* 'meslek hastalığı' THEN keywords := array_append(keywords, 'meslek hastalığı'); END IF;
  IF content ~* 'risk değerlendirme' THEN keywords := array_append(keywords, 'risk değerlendirme'); END IF;
  IF content ~* 'iş güvenliği' THEN keywords := array_append(keywords, 'iş güvenliği'); END IF;
  IF content ~* 'iş sağlığı' THEN keywords := array_append(keywords, 'iş sağlığı'); END IF;
  IF content ~* 'işveren' THEN keywords := array_append(keywords, 'işveren'); END IF;
  IF content ~* 'işçi' THEN keywords := array_append(keywords, 'işçi'); END IF;
  IF content ~* 'sigortalı' THEN keywords := array_append(keywords, 'sigortalı'); END IF;
  IF content ~* 'prim' THEN keywords := array_append(keywords, 'prim'); END IF;
  IF content ~* 'aylık' OR content ~* 'gelir' THEN keywords := array_append(keywords, 'aylık/gelir'); END IF;
  IF content ~* 'emeklilik' OR content ~* 'yaşlılık' THEN keywords := array_append(keywords, 'emeklilik'); END IF;
  IF content ~* 'malullük' OR content ~* 'malûllük' THEN keywords := array_append(keywords, 'malullük'); END IF;
  IF content ~* 'ölüm' THEN keywords := array_append(keywords, 'ölüm sigortası'); END IF;
  IF content ~* 'kıdem tazminatı' THEN keywords := array_append(keywords, 'kıdem tazminatı'); END IF;
  IF content ~* 'ihbar' THEN keywords := array_append(keywords, 'ihbar'); END IF;
  IF content ~* 'fesih' THEN keywords := array_append(keywords, 'fesih'); END IF;
  IF content ~* 'izin' THEN keywords := array_append(keywords, 'izin'); END IF;
  IF content ~* 'fazla çalışma' OR content ~* 'fazla mesai' THEN keywords := array_append(keywords, 'fazla çalışma'); END IF;
  IF content ~* 'ücret' THEN keywords := array_append(keywords, 'ücret'); END IF;
  IF content ~* 'tehlike' OR content ~* 'tehlikeli' THEN keywords := array_append(keywords, 'tehlike sınıfı'); END IF;
  IF content ~* 'eğitim' THEN keywords := array_append(keywords, 'eğitim'); END IF;
  IF content ~* 'denetim' THEN keywords := array_append(keywords, 'denetim'); END IF;
  IF content ~* 'ceza' OR content ~* 'idari para' THEN keywords := array_append(keywords, 'idari para cezası'); END IF;
  IF content ~* 'bildirim' THEN keywords := array_append(keywords, 'bildirim'); END IF;
  IF content ~* 'sözleşme' THEN keywords := array_append(keywords, 'sözleşme'); END IF;
  IF content ~* 'kurul' THEN keywords := array_append(keywords, 'kurul'); END IF;
  IF content ~* 'hekim' OR content ~* 'doktor' THEN keywords := array_append(keywords, 'işyeri hekimi'); END IF;
  IF content ~* 'uzman' THEN keywords := array_append(keywords, 'iş güvenliği uzmanı'); END IF;
  IF content ~* 'KKD' OR content ~* 'koruyucu' THEN keywords := array_append(keywords, 'KKD'); END IF;
  IF content ~* 'acil durum' THEN keywords := array_append(keywords, 'acil durum'); END IF;
  IF content ~* 'yangın' THEN keywords := array_append(keywords, 'yangın'); END IF;
  IF content ~* 'tahliye' THEN keywords := array_append(keywords, 'tahliye'); END IF;
  IF content ~* 'sağlık raporu' OR content ~* 'sağlık muayene' THEN keywords := array_append(keywords, 'sağlık gözetimi'); END IF;
  
  RETURN keywords;
END;
$$;

-- 6. Fıkra numaralarını çıkarma fonksiyonu
CREATE OR REPLACE FUNCTION extract_paragraph_numbers(content text)
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  paragraphs int[] := '{}';
  matches text[];
  m text;
BEGIN
  -- "(1)", "(2)", "(3)" gibi fıkra numaralarını bul
  FOR m IN SELECT (regexp_matches(content, '\((\d+)\)', 'g'))[1]
  LOOP
    IF m::int <= 20 THEN  -- Makul fıkra sayısı
      paragraphs := array_append(paragraphs, m::int);
    END IF;
  END LOOP;
  
  RETURN ARRAY(SELECT DISTINCT unnest(paragraphs) ORDER BY 1);
END;
$$;

-- 7. Mülga kontrolü fonksiyonu
CREATE OR REPLACE FUNCTION check_if_repealed(content text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF content ~* '(Mülga)' OR content ~* '\(Mülga:' OR content ~* 'mülga edilmiştir' THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- 8. Değişiklik bilgisi çıkarma fonksiyonu
CREATE OR REPLACE FUNCTION extract_amendment_info(content text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  amendments jsonb := '[]'::jsonb;
  match_result text[];
  law_num text;
  law_date text;
BEGIN
  -- "(Değişik: 17/4/2008-5754/68 md.)" gibi kalıpları bul
  FOR match_result IN 
    SELECT regexp_matches(content, '\(Değişik:\s*(\d+/\d+/\d+)-(\d+)/(\d+)\s*md\.\)', 'gi')
  LOOP
    amendments := amendments || jsonb_build_object(
      'type', 'değişik',
      'date', match_result[1],
      'law_number', match_result[2],
      'article', match_result[3]
    );
  END LOOP;
  
  -- "(Ek: ...)" kalıplarını bul
  FOR match_result IN 
    SELECT regexp_matches(content, '\(Ek:\s*(\d+/\d+/\d+)-(\d+)/(\d+)\s*md\.\)', 'gi')
  LOOP
    amendments := amendments || jsonb_build_object(
      'type', 'ek',
      'date', match_result[1],
      'law_number', match_result[2],
      'article', match_result[3]
    );
  END LOOP;
  
  RETURN amendments;
END;
$$;

-- 9. Kapsamlı referans formatı (fıkra ve bent dahil)
CREATE OR REPLACE FUNCTION create_detailed_reference(
  doc_number text,
  doc_title text,
  article_text text,
  paragraph_num int DEFAULT NULL,
  subparagraph text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base_ref text;
  full_ref text;
BEGIN
  -- Temel referansı oluştur
  base_ref := create_reference_format(doc_number, doc_title, article_text);
  full_ref := base_ref;
  
  -- Fıkra ekle
  IF paragraph_num IS NOT NULL THEN
    full_ref := regexp_replace(full_ref, ' maddesi$', 'nin ' || paragraph_num || ' ' || turkish_ordinal_suffix(paragraph_num::text) || ' fıkrası');
  END IF;
  
  -- Bent ekle
  IF subparagraph IS NOT NULL THEN
    IF paragraph_num IS NOT NULL THEN
      full_ref := regexp_replace(full_ref, ' fıkrası$', ' fıkrasının (' || subparagraph || ') bendi');
    ELSE
      full_ref := regexp_replace(full_ref, ' maddesi$', 'nin (' || subparagraph || ') bendi');
    END IF;
  END IF;
  
  RETURN full_ref;
END;
$$;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_legal_chunks_keywords ON public.legal_chunks USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_is_repealed ON public.legal_chunks(is_repealed);
CREATE INDEX IF NOT EXISTS idx_cross_references_source ON public.legal_cross_references(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_cross_references_target ON public.legal_cross_references(target_document_id, target_article_number);
CREATE INDEX IF NOT EXISTS idx_sector_relevance_nace ON public.legal_sector_relevance(nace_code);
CREATE INDEX IF NOT EXISTS idx_sector_relevance_chunk ON public.legal_sector_relevance(chunk_id);
;
