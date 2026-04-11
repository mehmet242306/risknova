
-- ============================================================
-- Risk Kategorileri: Varsayılan + Kullanıcı Tanımlı
-- ============================================================

CREATE TABLE public.risk_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  icon text NOT NULL DEFAULT '⚠️',
  color text NOT NULL DEFAULT '#6B7280',
  examples text DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT risk_categories_unique_key UNIQUE (organization_id, key)
);

CREATE INDEX idx_risk_categories_org ON public.risk_categories(organization_id);

-- RLS
ALTER TABLE public.risk_categories ENABLE ROW LEVEL SECURITY;

-- Herkes varsayılanları görebilir
CREATE POLICY "Anyone can read defaults"
  ON public.risk_categories FOR SELECT
  USING (organization_id IS NULL);

-- Kendi org kategorilerini görebilir
CREATE POLICY "Users can read own org categories"
  ON public.risk_categories FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- Kendi org'una kategori ekleyebilir
CREATE POLICY "Users can insert own org categories"
  ON public.risk_categories FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL AND
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- Kendi org kategorilerini güncelleyebilir (varsayılanlar hariç)
CREATE POLICY "Users can update own org categories"
  ON public.risk_categories FOR UPDATE
  USING (
    is_default = false AND
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- Kendi org kategorilerini silebilir (varsayılanlar hariç)
CREATE POLICY "Users can delete own org categories"
  ON public.risk_categories FOR DELETE
  USING (
    is_default = false AND
    organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- Varsayılan 10 kategori seed
-- ============================================================
INSERT INTO public.risk_categories (organization_id, key, label, icon, color, examples, is_default, sort_order) VALUES
  (NULL, 'fiziksel',    'Fiziksel',        '⚡', '#3B82F6', 'Gürültü, titreşim, aydınlatma, sıcaklık, KKD, düzen, acil durum', true, 1),
  (NULL, 'kimyasal',    'Kimyasal',        '🧪', '#8B5CF6', 'Gaz, toz, buhar, kimyasal madde, asit, baz', true, 2),
  (NULL, 'biyolojik',   'Biyolojik',       '🦠', '#10B981', 'Bakteri, virüs, küf, biyolojik etkenler, hijyen', true, 3),
  (NULL, 'ergonomik',   'Ergonomik',       '🧍', '#F59E0B', 'Duruş bozukluğu, ağır yük, tekrarlı hareket, elle taşıma', true, 4),
  (NULL, 'psikososyal', 'Psikososyal',     '🧠', '#EC4899', 'Stres, mobbing, iş yükü, vardiya, tükenmişlik', true, 5),
  (NULL, 'mekanik',     'Mekanik',         '⚙️', '#F97316', 'Makine, ekipman, düşme, sıkışma, yüksekte çalışma, iskele', true, 6),
  (NULL, 'elektrik',    'Elektrik',        '🔌', '#EF4444', 'Çarpma, kısa devre, topraklama, elektrik panosu', true, 7),
  (NULL, 'yangin',      'Yangın / Patlama','🔥', '#DC2626', 'Yanıcı madde, patlayıcı ortam, LPG, yangın söndürücü', true, 8),
  (NULL, 'trafik',      'Trafik',          '🚛', '#6366F1', 'Araç, forklift, yaya-araç çatışması, taşıma', true, 9),
  (NULL, 'cevre',       'Çevresel',        '🌿', '#059669', 'Atık, emisyon, gürültü kirliliği, havalandırma', true, 10);

-- ============================================================
-- risk_assessment_findings'e category_key kolonu ekle
-- ============================================================
ALTER TABLE public.risk_assessment_findings ADD COLUMN IF NOT EXISTS category_key text;

-- Mevcut findings'leri backfill
UPDATE public.risk_assessment_findings SET category_key = 
  CASE
    WHEN lower(category) LIKE '%elektrik%' OR lower(category) LIKE '%electrical%' THEN 'elektrik'
    WHEN lower(category) LIKE '%yangın%' OR lower(category) LIKE '%yangin%' OR lower(category) LIKE '%patlama%' OR lower(category) LIKE '%lpg%' THEN 'yangin'
    WHEN lower(category) LIKE '%kimyasal%' OR lower(category) LIKE '%kimya%' THEN 'kimyasal'
    WHEN lower(category) LIKE '%makine%' OR lower(category) LIKE '%mekanik%' OR lower(category) LIKE '%düşme%' OR lower(category) LIKE '%yüksekte%' OR lower(category) LIKE '%iskele%' THEN 'mekanik'
    WHEN lower(category) LIKE '%ergonomi%' OR lower(category) LIKE '%elle taşıma%' THEN 'ergonomik'
    WHEN lower(category) LIKE '%trafik%' OR lower(category) LIKE '%araç%' OR lower(category) LIKE '%forklift%' THEN 'trafik'
    WHEN lower(category) LIKE '%çevre%' OR lower(category) LIKE '%cevre%' OR lower(category) LIKE '%havalandırma%' OR lower(category) LIKE '%aydınlatma%' THEN 'cevre'
    WHEN lower(category) LIKE '%biyolojik%' OR lower(category) LIKE '%hijyen%' THEN 'biyolojik'
    WHEN lower(category) LIKE '%psikososyal%' OR lower(category) LIKE '%stres%' OR lower(category) LIKE '%mobbing%' THEN 'psikososyal'
    ELSE 'fiziksel'
  END
WHERE category_key IS NULL;
;
