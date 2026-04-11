
-- 6331 Kanun
INSERT INTO public.mevzuat_documents (id, doc_type, official_no, title, short_title, publish_date, gazette_no, gazette_date, status, summary, tags, source_url) VALUES
  ('a0000001-6331-4000-8000-000000000001', 'kanun', '6331', 'İş Sağlığı ve Güvenliği Kanunu', '6331 Kanun', '2012-06-20', '28339', '2012-06-30', 'active',
   'İşyerlerinde iş sağlığı ve güvenliğinin sağlanması ve mevcut sağlık ve güvenlik şartlarının iyileştirilmesi amacıyla düzenlenmiş temel kanun.',
   ARRAY['isg','temel','kanun','işveren','çalışan','risk','önlem','denetim','ceza'], 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6331&MevzuatTur=1')
ON CONFLICT (id) DO NOTHING;

-- Maddeler
INSERT INTO public.mevzuat_sections (document_id, section_type, section_no, title, content, summary, keywords, sort_order) VALUES

('a0000001-6331-4000-8000-000000000001', 'madde', '1', 'Amaç',
 'Bu Kanunun amacı; işyerlerinde iş sağlığı ve güvenliğinin sağlanması ve mevcut sağlık ve güvenlik şartlarının iyileştirilmesi için işveren ve çalışanların görev, yetki, sorumluluk, hak ve yükümlülüklerini düzenlemektir.',
 'Kanunun amacı: İşyerlerinde İSG sağlanması ve iyileştirilmesi', ARRAY['amaç','kapsam','isg','temel'], 10),

('a0000001-6331-4000-8000-000000000001', 'madde', '2', 'Kapsam',
 'Bu Kanun; kamu ve özel sektöre ait bütün işlere ve işyerlerine, bu işyerlerinin işverenleri ile işveren vekillerine, çırak ve stajyerler de dâhil olmak üzere tüm çalışanlarına faaliyet konularına bakılmaksızın uygulanır. Ancak aşağıda belirtilen faaliyetler ve kişiler hakkında bu Kanun hükümleri uygulanmaz: a) Fabrika, bakım merkezi, dikimevi ve benzeri işyerlerindekiler hariç Türk Silahlı Kuvvetleri, genel kolluk kuvvetleri ve Milli İstihbarat Teşkilatı Müsteşarlığının faaliyetleri. b) Afet ve acil durum birimlerinin müdahale faaliyetleri. c) Ev hizmetleri. ç) Çalışan istihdam etmeksizin kendi nam ve hesabına mal ve hizmet üretimi yapanlar.',
 'Kanun kamu ve özel tüm işyerlerine uygulanır. TSK, ev hizmetleri vb. istisnalar var.', ARRAY['kapsam','uygulama','istisna','işyeri','çalışan'], 20),

('a0000001-6331-4000-8000-000000000001', 'madde', '4', 'İşverenin genel yükümlülüğü',
 '(1) İşveren, çalışanların işle ilgili sağlık ve güvenliğini sağlamakla yükümlü olup bu çerçevede; a) Mesleki risklerin önlenmesi, eğitim ve bilgi verilmesi dâhil her türlü tedbirin alınması, organizasyonun yapılması, gerekli araç ve gereçlerin sağlanması, sağlık ve güvenlik tedbirlerinin değişen şartlara uygun hale getirilmesi ve mevcut durumun iyileştirilmesi için çalışmalar yapar. b) İşyerinde alınan iş sağlığı ve güvenliği tedbirlerine uyulup uyulmadığını izler, denetler ve uygunsuzlukların giderilmesini sağlar. c) Risk değerlendirmesi yapar veya yaptırır. ç) Çalışana görev verirken, çalışanın sağlık ve güvenlik yönünden işe uygunluğunu göz önüne alır. (2) İşverenin iş sağlığı ve güvenliği tedbirlerinin maliyetini çalışanlara yansıtamaz.',
 'İşveren İSG tedbirleri almak, risk değerlendirmesi yapmak, denetlemekle yükümlüdür. Maliyet çalışana yansıtılamaz.', ARRAY['işveren','yükümlülük','risk','tedbir','denetim','maliyet'], 40),

('a0000001-6331-4000-8000-000000000001', 'madde', '5', 'Risklerden korunma ilkeleri',
 'İşverenin yükümlülüklerinin yerine getirilmesinde aşağıdaki ilkeler göz önünde bulundurulur: a) Risklerden kaçınmak. b) Kaçınılması mümkün olmayan riskleri analiz etmek. c) Risklerle kaynağında mücadele etmek. ç) İşin kişilere uygun hale getirilmesi için işyerlerinin tasarımı ile iş ekipmanı, çalışma şekli ve üretim metotlarının seçiminde özen göstermek. d) Teknik gelişmelere uyum sağlamak. e) Tehlikeli olanı, tehlikesiz veya daha az tehlikeli olanla değiştirmek. f) Tutarlı ve genel bir önleme politikası geliştirmek. g) Toplu korunma tedbirlerine, kişisel korunma tedbirlerine göre öncelik vermek. ğ) Çalışanlara uygun talimatlar vermek.',
 'Risk önleme hiyerarşisi: Kaçınma → Analiz → Kaynakta mücadele → Toplu koruma → KKD → Talimat', ARRAY['risk','korunma','ilke','hiyerarşi','önleme','kkd','toplu korunma'], 50),

('a0000001-6331-4000-8000-000000000001', 'madde', '6', 'İş sağlığı ve güvenliği hizmetleri',
 '(1) İşveren; a) Çalışanları arasından iş güvenliği uzmanı, işyeri hekimi ve diğer sağlık personeli görevlendirir. Çalışanları arasında belirlenen niteliklere sahip personel bulunmaması hâlinde, bu hizmetin tamamını veya bir kısmını ortak sağlık ve güvenlik birimlerinden hizmet alarak yerine getirebilir.',
 'İşveren iş güvenliği uzmanı, işyeri hekimi görevlendirmeli. OSGB hizmet alınabilir.', ARRAY['isg hizmeti','uzman','hekim','osgb','görevlendirme'], 60),

('a0000001-6331-4000-8000-000000000001', 'madde', '8', 'İşyeri hekimleri ve iş güvenliği uzmanları',
 '(1) İşyeri hekimi ve iş güvenliği uzmanlarının hak ve yetkileri, görevlerini yerine getirmeleri nedeniyle kısıtlanamaz. Bu kişiler, görevlerini mesleğin gerektirdiği etik ilkeler ve mesleki bağımsızlık içerisinde yürütür. (2) Bildirilen hususlardan hayati tehlike arz edenlerin işveren tarafından yerine getirilmemesi hâlinde, bu hususu Bakanlığın yetkili birimine bildirir. (6) Kamu kurum ve kuruluşlarında ilgili mevzuata göre çalıştırılan işyeri hekimi veya iş güvenliği uzmanı olma niteliğini haiz personel, görev yaptığı her saat için (200) gösterge rakamının memur aylık katsayısı ile çarpımı tutarında ilave ödeme, hizmet alan kurum tarafından yapılır. Bu ödemeden damga vergisi hariç herhangi bir kesinti yapılmaz.',
 'İGU ve işyeri hekimleri mesleki bağımsızlık içinde çalışır. Hayati tehlike bildirim yükümlülüğü. Kamu ödeme kuralları.', ARRAY['uzman','hekim','bağımsızlık','bildirim','hayati tehlike','kamu','görevlendirme','ödeme','memur'], 80),

('a0000001-6331-4000-8000-000000000001', 'madde', '10', 'Risk değerlendirmesi, kontrol, ölçüm ve araştırma',
 '(1) İşveren, iş sağlığı ve güvenliği yönünden risk değerlendirmesi yapmak veya yaptırmakla yükümlüdür. Risk değerlendirmesi yapılırken dikkate alınır: a) Belirli risklerden etkilenecek çalışanların durumu. b) İş ekipmanı ile kimyasal madde seçimi. c) İşyerinin tertip ve düzeni. ç) Özel politika gerektiren gruplar. (2) İşveren, risk değerlendirmesini; taşınma, teknoloji değişikliği, iş kazası, meslek hastalığı veya ramak kala olay meydana gelmesi, sınır değer değişikliği, yeni tehlike ortaya çıkması hâllerinde yenilemek zorundadır.',
 'İşveren risk değerlendirmesi yapmak zorundadır. Özel gruplar dikkate alınır. Değişikliklerde yenilenir.', ARRAY['risk değerlendirmesi','işveren','tehlike','özel grup','gebe','engelli','yenileme'], 100),

('a0000001-6331-4000-8000-000000000001', 'madde', '11', 'Acil durum planları, yangınla mücadele ve ilk yardım',
 '(1) İşveren; a) Meydana gelebilecek acil durumları önceden değerlendirerek belirler ve önleyici tedbirleri alır. b) Acil durum planlarını hazırlar. c) Önleme, koruma, tahliye, yangınla mücadele, ilk yardım konularında uygun donanıma sahip ve eğitimli yeterli sayıda kişiyi görevlendirir.',
 'İşveren acil durumları belirler, plan hazırlar, görevli personel atar.', ARRAY['acil durum','plan','yangın','tahliye','ilk yardım','görevlendirme'], 110),

('a0000001-6331-4000-8000-000000000001', 'madde', '15', 'Sağlık gözetimi',
 '(1) İşveren; a) Çalışanların sağlık gözetimine tabi tutulmalarını sağlar. b) Sağlık muayeneleri: 1) İşe girişlerinde. 2) İş değişikliğinde. 3) İş kazası sonrası işe dönüşlerinde. 4) Düzenli aralıklarla.',
 'İşveren sağlık gözetimi yaptırmalı: İşe giriş, iş değişikliği, periyodik muayeneler.', ARRAY['sağlık','muayene','gözetim','işe giriş','periyodik','meslek hastalığı'], 150),

('a0000001-6331-4000-8000-000000000001', 'madde', '17', 'Çalışanların eğitimi',
 '(1) İşveren, çalışanların İSG eğitimlerini almasını sağlar. İşe başlamadan önce, iş değişikliğinde, yeni teknoloji uygulanması hâlinde verilir. Değişen risklere uygun yenilenir. (3) Tehlikeli ve çok tehlikeli sınıfta yer alan işlerde mesleki eğitim belgesi zorunludur.',
 'İşveren İSG eğitimi vermekle yükümlüdür. Tehlikeli işlerde mesleki eğitim belgesi zorunludur.', ARRAY['eğitim','çalışan','tehlikeli iş','mesleki eğitim','belge'], 170),

('a0000001-6331-4000-8000-000000000001', 'madde', '19', 'Çalışanların yükümlülükleri',
 '(1) Çalışanlar, kendilerinin ve diğer çalışanların sağlık ve güvenliklerini tehlikeye düşürmemekle yükümlüdür. (2) Yükümlülükler: a) Makine, cihaz, araçları kurallara uygun kullanmak. b) KKD doğru kullanmak. c) Ciddi ve yakın tehlikeleri derhal bildirmek.',
 'Çalışanlar İSG kurallarına uymak, KKD kullanmak, tehlikeleri bildirmekle yükümlüdür.', ARRAY['çalışan','yükümlülük','kkd','bildirim','tehlike'], 190),

('a0000001-6331-4000-8000-000000000001', 'madde', '26', 'İdari para cezaları ve uygulanması',
 'İSG hizmeti eksikliği 5.000TL/kişi/ay, risk değerlendirmesi yapmama 3.000TL + 4.100TL/ay devamında, acil durum planı eksikliği 1.000TL/ay, eğitim vermeme 1.000TL/çalışan, iş kazası bildirmeme 2.000TL.',
 'İdari para cezaları: İSG hizmeti, risk değerlendirmesi, eğitim, acil durum eksikliklerinde uygulanır.', ARRAY['ceza','idari para cezası','yaptırım','işveren','ihlal'], 260);

-- Yönetmelikler
INSERT INTO public.mevzuat_documents (doc_type, official_no, title, short_title, publish_date, status, summary, tags) VALUES
  ('yonetmelik', '28512', 'İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği', 'Risk Değerlendirmesi Yönetmeliği', '2012-12-29', 'active', 'Risk değerlendirmesinin usul ve esaslarını düzenler.', ARRAY['risk değerlendirmesi','tehlike','analiz','önlem']),
  ('yonetmelik', '28648', 'İş Güvenliği Uzmanlarının Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik', 'İGU Yönetmeliği', '2012-12-29', 'active', 'İGU nitelikleri, eğitimleri, görev ve sorumlulukları.', ARRAY['iş güvenliği uzmanı','görev','yetki','sorumluluk','eğitim','sınıf']),
  ('yonetmelik', '28648', 'İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik', 'İşyeri Hekimi Yönetmeliği', '2012-12-29', 'active', 'İşyeri hekimi görev ve sorumlulukları.', ARRAY['işyeri hekimi','sağlık personeli','muayene','sağlık gözetimi']),
  ('yonetmelik', '28681', 'Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik', 'İSG Eğitim Yönetmeliği', '2013-05-15', 'active', 'İSG eğitimlerinin usul ve esasları. Tehlike sınıfına göre eğitim süreleri.', ARRAY['eğitim','süre','tehlike sınıfı','çalışan','program']),
  ('yonetmelik', '28710', 'İşyerlerinde Acil Durumlar Hakkında Yönetmelik', 'Acil Durum Yönetmeliği', '2013-06-18', 'active', 'Acil durum planları, tahliye, tatbikat usul ve esasları.', ARRAY['acil durum','plan','tahliye','yangın','tatbikat']),
  ('yonetmelik', '28695', 'Kişisel Koruyucu Donanımların İşyerlerinde Kullanılması Hakkında Yönetmelik', 'KKD Yönetmeliği', '2013-07-02', 'active', 'KKD seçimi, kullanımı ve bakımı.', ARRAY['kkd','kişisel koruyucu','donanım','seçim','kullanım']),
  ('yonetmelik', '28770', 'Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği', 'Yapı İşleri Yönetmeliği', '2013-10-05', 'active', 'İnşaat ve yapı işlerinde İSG şartları.', ARRAY['yapı','inşaat','iskele','kazı','yüksekte çalışma','vinç']),
  ('yonetmelik', '28733', 'Kimyasal Maddelerle Çalışmalarda Sağlık ve Güvenlik Önlemleri Hakkında Yönetmelik', 'Kimyasal Maddeler Yönetmeliği', '2013-08-12', 'active', 'Kimyasal madde riskleri ve korunma.', ARRAY['kimyasal','madde','risk','maruziyet','sds','etiketleme']),
  ('yonetmelik', '28628', 'İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği', 'İş Ekipmanları Yönetmeliği', '2013-04-25', 'active', 'İş ekipmanları güvenlik şartları ve periyodik kontrol.', ARRAY['iş ekipmanı','makine','bakım','periyodik kontrol','muayene']),
  ('yonetmelik', '28710', 'İşyeri Bina ve Eklentilerinde Alınacak Sağlık ve Güvenlik Önlemlerine İlişkin Yönetmelik', 'İşyeri Bina Yönetmeliği', '2013-07-17', 'active', 'İşyeri bina sağlık ve güvenlik şartları.', ARRAY['bina','işyeri','aydınlatma','havalandırma','merdiven']);

-- Topics
INSERT INTO public.mevzuat_topics (title, description, icon, sort_order) VALUES
  ('İşveren Yükümlülükleri', 'İşverenin İSG kapsamındaki yasal sorumlulukları', '⚖️', 10),
  ('Risk Değerlendirmesi', 'Risk analizi ve değerlendirme süreçleri', '📊', 20),
  ('Eğitim', 'Çalışan eğitimleri ve belgelendirme', '📚', 30),
  ('Acil Durum', 'Acil durum planları, yangın, tahliye', '🚨', 40),
  ('KKD', 'Kişisel koruyucu donanım seçimi ve kullanımı', '🦺', 50),
  ('Sağlık Gözetimi', 'İşyeri hekimi, muayeneler, sağlık takibi', '🏥', 60),
  ('İSG Profesyonelleri', 'İGU, işyeri hekimi görev ve yetkileri', '👨‍⚕️', 70),
  ('Yaptırımlar', 'İdari para cezaları ve yaptırımlar', '🔨', 80),
  ('Özel Gruplar', 'Gebe, genç, engelli çalışan hakları', '👥', 90),
  ('Sektörel', 'İnşaat, maden, kimya gibi sektör kuralları', '🏗️', 100);
;
