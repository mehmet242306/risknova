
-- Geçici Madde ve Ek Madde parsing fonksiyonlarını düzelt (v2)

-- 1. Madde türünü tespit et
CREATE OR REPLACE FUNCTION parse_article_type(article_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_text text;
BEGIN
  clean_text := UPPER(TRIM(regexp_replace(article_text, '\s+', ' ', 'g')));
  
  IF clean_text ~ '^GEÇİCİ' OR clean_text ~ '^GECICI' THEN
    RETURN 'gecici';
  ELSIF clean_text ~ '^EK\s' OR clean_text ~ '^EK$' THEN
    RETURN 'ek';
  ELSIF clean_text ~ 'MADDE\s*\d+\s*/\s*[A-Z]' THEN
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
  clean_text text;
  num_match text[];
BEGIN
  clean_text := TRIM(regexp_replace(article_text, '\s+', ' ', 'g'));
  
  -- Geçici Madde
  IF clean_text ~* '^GEÇİCİ' OR clean_text ~* '^GECICI' THEN
    num_match := regexp_matches(clean_text, '(\d+)', 'i');
    IF num_match IS NOT NULL THEN
      RETURN 'Geçici ' || num_match[1];
    END IF;
  
  -- Ek Madde
  ELSIF clean_text ~* '^EK\s' THEN
    num_match := regexp_matches(clean_text, '(\d+)', 'i');
    IF num_match IS NOT NULL THEN
      RETURN 'Ek ' || num_match[1];
    END IF;
  
  -- Mükerrer (Madde X/A)
  ELSIF clean_text ~* 'MADDE\s*\d+\s*/\s*[A-Z]' THEN
    num_match := regexp_matches(clean_text, '(\d+)\s*/\s*([A-Za-z])', 'i');
    IF num_match IS NOT NULL THEN
      RETURN num_match[1] || '/' || UPPER(num_match[2]);
    END IF;
  END IF;
  
  -- Normal Madde
  num_match := regexp_matches(clean_text, '(\d+)', 'i');
  IF num_match IS NOT NULL THEN
    RETURN num_match[1];
  END IF;
  
  RETURN clean_text;
END;
$$;

-- 3. Türkçe sıra eki fonksiyonu (basitleştirilmiş)
CREATE OR REPLACE FUNCTION turkish_ordinal_suffix(num_str text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  num int;
  last_digit int;
BEGIN
  -- Sayıya çevir
  BEGIN
    num := num_str::int;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'inci';
  END;
  
  -- Son rakam
  last_digit := num % 10;
  
  -- 10, 30, 40, 50, 60, 70, 80, 90 için özel
  IF num >= 10 AND num % 10 = 0 THEN
    IF (num / 10) % 10 IN (1, 3, 4, 5) THEN
      RETURN 'uncu';
    ELSIF (num / 10) % 10 IN (2, 7) THEN
      RETURN 'nci';
    ELSIF (num / 10) % 10 IN (6, 9) THEN
      RETURN 'ncı';
    ELSIF (num / 10) % 10 = 8 THEN
      RETURN 'inci';
    ELSE
      RETURN 'ıncı';
    END IF;
  END IF;
  
  -- Son rakama göre
  CASE last_digit
    WHEN 1 THEN RETURN 'inci';
    WHEN 2 THEN RETURN 'nci';
    WHEN 3 THEN RETURN 'üncü';
    WHEN 4 THEN RETURN 'üncü';
    WHEN 5 THEN RETURN 'inci';
    WHEN 6 THEN RETURN 'ncı';
    WHEN 7 THEN RETURN 'nci';
    WHEN 8 THEN RETURN 'inci';
    WHEN 9 THEN RETURN 'uncu';
    ELSE RETURN 'inci';
  END CASE;
END;
$$;

-- 4. Tam referans formatı oluştur
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
  num_match text[];
  num_only text;
  suffix text;
BEGIN
  article_type := parse_article_type(article_text);
  normalized := normalize_article_number(article_text);
  
  -- Sadece sayıyı çıkar
  num_match := regexp_matches(normalized, '(\d+)');
  num_only := COALESCE(num_match[1], '1');
  suffix := turkish_ordinal_suffix(num_only);
  
  -- Kanun türünü belirle
  IF doc_title ~* 'kanun' THEN
    doc_type := 'Kanun';
  ELSIF doc_title ~* 'yönetmelik' OR doc_title ~* 'yonetmelik' THEN
    doc_type := 'Yönetmelik';
  ELSIF doc_title ~* 'tebliğ' OR doc_title ~* 'teblig' THEN
    doc_type := 'Tebliğ';
  ELSE
    doc_type := 'Mevzuat';
  END IF;
  
  -- Referans formatı
  IF article_type = 'gecici' THEN
    RETURN doc_number || ' sayılı ' || doc_type || '''un Geçici ' || num_only || ' ' || suffix || ' maddesi';
  ELSIF article_type = 'ek' THEN
    RETURN doc_number || ' sayılı ' || doc_type || '''un Ek ' || num_only || ' ' || suffix || ' maddesi';
  ELSIF article_type = 'mukerrer' THEN
    RETURN doc_number || ' sayılı ' || doc_type || '''un ' || normalized || ' maddesi';
  ELSE
    RETURN doc_number || ' sayılı ' || doc_type || '''un ' || num_only || ' ' || suffix || ' maddesi';
  END IF;
END;
$$;
;
