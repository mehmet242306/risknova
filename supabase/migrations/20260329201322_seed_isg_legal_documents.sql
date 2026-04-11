
-- =============================================
-- TEMEL İSG MEVZUATI SEED DATA
-- =============================================

-- Önce mevzuat.gov.tr source_id'sini al
DO $$
DECLARE
  mevzuat_source_id uuid;
BEGIN
  SELECT id INTO mevzuat_source_id FROM public.legal_sources WHERE source_key = 'mevzuat_gov_tr';

  -- KANUNLAR
  INSERT INTO public.legal_documents (source_id, doc_type, doc_number, title, official_gazette_date, official_gazette_number, source_url) VALUES
  (mevzuat_source_id, 'law', '6331', 'İş Sağlığı ve Güvenliği Kanunu', '2012-06-30', '28339', 'https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6331.pdf'),
  (mevzuat_source_id, 'law', '4857', 'İş Kanunu', '2003-06-10', '25134', 'https://www.mevzuat.gov.tr/MevzuatMetin/1.5.4857.pdf'),
  (mevzuat_source_id, 'law', '5510', 'Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu', '2006-06-16', '26200', 'https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5510.pdf')
  ON CONFLICT DO NOTHING;

  -- YÖNETMELİKLER
  INSERT INTO public.legal_documents (source_id, doc_type, doc_number, title, official_gazette_date, official_gazette_number, source_url) VALUES
  -- Risk Değerlendirme
  (mevzuat_source_id, 'regulation', '28512', 'İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği', '2012-12-29', '28512', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=16925&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- KKD
  (mevzuat_source_id, 'regulation', '28695', 'Kişisel Koruyucu Donanımların İşyerlerinde Kullanılması Hakkında Yönetmelik', '2013-07-02', '28695', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18331&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Yapı İşleri
  (mevzuat_source_id, 'regulation', '28786', 'Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği', '2013-10-05', '28786', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18581&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Kimyasal Maddeler
  (mevzuat_source_id, 'regulation', '28648', 'Kimyasal Maddelerle Çalışmalarda Sağlık ve Güvenlik Önlemleri Hakkında Yönetmelik', '2013-04-12', '28648', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18190&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Gürültü
  (mevzuat_source_id, 'regulation', '28721', 'Çalışanların Gürültü ile İlgili Risklerden Korunmalarına Dair Yönetmelik', '2013-07-28', '28721', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18417&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Elle Taşıma
  (mevzuat_source_id, 'regulation', '28717', 'Elle Taşıma İşleri Yönetmeliği', '2013-07-24', '28717', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18400&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- İş Ekipmanları
  (mevzuat_source_id, 'regulation', '28628', 'İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği', '2013-04-25', '28628', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18132&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Asbestle Çalışma
  (mevzuat_source_id, 'regulation', '28539', 'Asbestle Çalışmalarda Sağlık ve Güvenlik Önlemleri Hakkında Yönetmelik', '2013-01-25', '28539', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=17930&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Titreşim
  (mevzuat_source_id, 'regulation', '28741', 'Çalışanların Titreşimle İlgili Risklerden Korunmalarına Dair Yönetmelik', '2013-08-22', '28741', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18449&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Elektrik Tesisleri
  (mevzuat_source_id, 'regulation', '28681', 'Elektrik Tesislerinde Topraklamalar Yönetmeliği', '2013-06-21', '28681', NULL),
  
  -- İşyeri Bina
  (mevzuat_source_id, 'regulation', '28710', 'İşyeri Bina ve Eklentilerinde Alınacak Sağlık ve Güvenlik Önlemlerine İlişkin Yönetmelik', '2013-07-17', '28710', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18592&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Acil Durumlar
  (mevzuat_source_id, 'regulation', '28681', 'İşyerlerinde Acil Durumlar Hakkında Yönetmelik', '2013-06-18', '28681', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18282&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Sağlık ve Güvenlik İşaretleri
  (mevzuat_source_id, 'regulation', '28762', 'Sağlık ve Güvenlik İşaretleri Yönetmeliği', '2013-09-11', '28762', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18536&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Çalışanların Eğitimi
  (mevzuat_source_id, 'regulation', '28648', 'Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik', '2013-05-15', '28648', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18318&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- İş Güvenliği Uzmanları
  (mevzuat_source_id, 'regulation', '28512', 'İş Güvenliği Uzmanlarının Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik', '2012-12-29', '28512', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=16924&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- İşyeri Hekimleri
  (mevzuat_source_id, 'regulation', '28713', 'İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik', '2013-07-20', '28713', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18615&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- OSGB
  (mevzuat_source_id, 'regulation', '28512', 'İş Sağlığı ve Güvenliği Hizmetleri Yönetmeliği', '2012-12-29', '28512', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=16923&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- İSG Kurulları
  (mevzuat_source_id, 'regulation', '28532', 'İş Sağlığı ve Güvenliği Kurulları Hakkında Yönetmelik', '2013-01-18', '28532', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=17906&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Ekranlı Araçlar
  (mevzuat_source_id, 'regulation', '28620', 'Ekranlı Araçlarla Çalışmalarda Sağlık ve Güvenlik Önlemleri Hakkında Yönetmelik', '2013-04-16', '28620', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18105&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Tozla Mücadele
  (mevzuat_source_id, 'regulation', '28539', 'Tozla Mücadele Yönetmeliği', '2013-11-05', '28812', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18632&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Biyolojik Etkenler
  (mevzuat_source_id, 'regulation', '28678', 'Biyolojik Etkenlere Maruziyet Risklerinin Önlenmesi Hakkında Yönetmelik', '2013-06-15', '28678', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18271&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Patlayıcı Ortamlar
  (mevzuat_source_id, 'regulation', '28633', 'Çalışanların Patlayıcı Ortamların Tehlikelerinden Korunması Hakkında Yönetmelik', '2013-04-30', '28633', 'https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=18154&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5'),
  
  -- Tehlike Sınıfları
  (mevzuat_source_id, 'regulation', '28509', 'İş Sağlığı ve Güvenliğine İlişkin İşyeri Tehlike Sınıfları Tebliği', '2012-12-26', '28509', NULL)
  
  ON CONFLICT DO NOTHING;
END $$;
;
