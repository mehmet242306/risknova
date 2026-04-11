
-- Madde parsing ve referans oluşturma fonksiyonları

-- 1. Madde metninden türü çıkar
CREATE OR REPLACE FUNCTION parse_article_type(article_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  article_text := UPPER(TRIM(article_text));
  
  IF article_text ~ '^GEÇİCİ\s*MADDE' OR article_text ~ '^GECICI\s*MADDE' THEN
    RETURN 'gecici';
  ELSIF article_text ~ '^EK\s*MADDE' THEN
    RETURN 'ek';
  ELSIF article_text ~ 'MADDE\s+\d+/[A-Z]' THEN
    RETURN 'mukerrer';
  ELSE
    RETURN 'normal';
  END IF;
END;
$$;

-- 2. Madde numarasını normalize et
CREATE OR REPLACE FUNCTION normalize_article_number(article_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text;
  num_match text;
BEGIN
  article_text := TRIM(article_text);
  
  -- Geçici Madde X
  IF article_text ~* '^GEÇİCİ\s*MADDE\s*(\d+)' OR article_text ~* '^GECICI\s*MADDE\s*(\d+)' THEN
    num_match := (regexp_matches(article_text, '(\d+)', 'i'))[1];
    RETURN 'Geçici ' || num_match;
  
  -- Ek Madde X
  ELSIF article_text ~* '^EK\s*MADDE\s*(\d+)' THEN
    num_match := (regexp_matches(article_text, '(\d+)', 'i'))[1];
    RETURN 'Ek ' || num_match;
  
  -- Madde X/A (mükerrer)
  ELSIF article_text ~* 'MADDE\s*(\d+/[A-Z])' THEN
    num_match := (regexp_matches(article_text, '(\d+/[A-Z])', 'i'))[1];
    RETURN num_match;
  
  -- Normal Madde X
  ELSIF article_text ~* 'MADDE\s*(\d+)' THEN
    num_match := (regexp_matches(article_text, '(\d+)', 'i'))[1];
    RETURN num_match;
  
  ELSE
    RETURN article_text;
  END IF;
END;
$$;

-- 3. Tam referans formatı oluştur
CREATE OR REPLACE FUNCTION create_reference_format(
  doc_number text,
  doc_title text,
  article_text text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  article_type text;
  normalized text;
  doc_type text;
BEGIN
  article_type := parse_article_type(article_text);
  normalized := normalize_article_number(article_text);
  
  -- Kanun türünü belirle (Kanun, Yönetmelik, Tebliğ)
  IF doc_title ~* 'kanun' THEN
    doc_type := 'Kanun';
  ELSIF doc_title ~* 'yönetmelik' OR doc_title ~* 'yonetmelik' THEN
    doc_type := 'Yönetmelik';
  ELSIF doc_title ~* 'tebliğ' OR doc_title ~* 'teblig' THEN
    doc_type := 'Tebliğ';
  ELSE
    doc_type := 'Mevzuat';
  END IF;
  
  -- Referans formatı oluştur
  IF article_type = 'gecici' THEN
    RETURN doc_number || ' sayılı ' || doc_type || '''un ' || normalized || '. maddesi';
  ELSIF article_type = 'ek' THEN
    RETURN doc_number || ' sayılı ' || doc_type || '''un ' || normalized || '. maddesi';
  ELSIF article_type = 'mukerrer' THEN
    RETURN doc_number || ' sayılı ' || doc_type || '''un ' || normalized || ' maddesi';
  ELSE
    RETURN doc_number || ' sayılı ' || doc_type || '''un ' || normalized || '. maddesi';
  END IF;
END;
$$;

-- 4. Mevcut kayıtları güncelle
UPDATE public.legal_chunks lc
SET 
  article_type = parse_article_type(article_number),
  article_number_normalized = normalize_article_number(article_number),
  reference_format = create_reference_format(
    ld.doc_number,
    ld.title,
    lc.article_number
  )
FROM public.legal_documents ld
WHERE lc.document_id = ld.id
AND lc.reference_format IS NULL;
;
