
-- ============================================================
-- Seed legal_documents with core ISG legislation
-- ============================================================
INSERT INTO public.legal_documents (doc_type, doc_number, title, official_gazette_date, official_gazette_number, source_url, is_active) VALUES
('law', '6331', 'İş Sağlığı ve Güvenliği Kanunu', '2012-06-30', '28339', 'https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6331.pdf', true),
('law', '4857', 'İş Kanunu', '2003-06-10', '25134', 'https://www.mevzuat.gov.tr/MevzuatMetin/1.5.4857.pdf', true),
('law', '5510', 'Sosyal Sigortalar ve Genel Sağlık Sigortası Kanunu', '2006-06-16', '26200', 'https://www.mevzuat.gov.tr/MevzuatMetin/1.5.5510.pdf', true),
('regulation', '28512', 'İş Sağlığı ve Güvenliği Risk Değerlendirmesi Yönetmeliği', '2012-12-29', '28512', NULL, true),
('regulation', '28648-igu', 'İş Güvenliği Uzmanlarının Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik', '2012-12-29', '28648', NULL, true),
('regulation', '28648-hekim', 'İşyeri Hekimi ve Diğer Sağlık Personelinin Görev, Yetki, Sorumluluk ve Eğitimleri Hakkında Yönetmelik', '2012-12-29', '28648', NULL, true),
('regulation', '28681', 'Çalışanların İş Sağlığı ve Güvenliği Eğitimlerinin Usul ve Esasları Hakkında Yönetmelik', '2013-05-15', '28681', NULL, true),
('regulation', '28710-acil', 'İşyerlerinde Acil Durumlar Hakkında Yönetmelik', '2013-06-18', '28710', NULL, true),
('regulation', '28695', 'Kişisel Koruyucu Donanımların İşyerlerinde Kullanılması Hakkında Yönetmelik', '2013-07-02', '28695', NULL, true),
('regulation', '28770', 'Yapı İşlerinde İş Sağlığı ve Güvenliği Yönetmeliği', '2013-10-05', '28770', NULL, true),
('regulation', '28733', 'Kimyasal Maddelerle Çalışmalarda Sağlık ve Güvenlik Önlemleri Hakkında Yönetmelik', '2013-08-12', '28733', NULL, true),
('regulation', '28628', 'İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları Yönetmeliği', '2013-04-25', '28628', NULL, true),
('regulation', '28710-bina', 'İşyeri Bina ve Eklentilerinde Alınacak Sağlık ve Güvenlik Önlemlerine İlişkin Yönetmelik', '2013-07-17', '28710', NULL, true),
('regulation', '28721', 'Çalışanların Gürültü ile İlgili Risklerden Korunmalarına Dair Yönetmelik', '2013-07-28', '28721', NULL, true),
('regulation', '28717', 'Elle Taşıma İşleri Yönetmeliği', '2013-07-24', '28717', NULL, true),
('regulation', '28741', 'Çalışanların Titreşimle İlgili Risklerden Korunmalarına Dair Yönetmelik', '2013-08-22', '28741', NULL, true),
('regulation', '28762', 'Asbestle Çalışmalarda Sağlık ve Güvenlik Önlemleri Hakkında Yönetmelik', '2013-01-25', '28539', NULL, true),
('regulation', '29258', 'Büyük Endüstriyel Kazaların Önlenmesi ve Etkilerinin Azaltılması Hakkında Yönetmelik', '2015-01-30', '29258', NULL, true),
('regulation', '28710-gece', 'Postalar Halinde İşçi Çalıştırılarak Yürütülen İşlerde Çalışmalara İlişkin Özel Usul ve Esaslar Hakkında Yönetmelik', '2013-08-07', '28731', NULL, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Seed legal_chunks for 6331 Kanunu (article level)
-- ============================================================
DO $$
DECLARE
  v_doc_id uuid;
BEGIN
  SELECT id INTO v_doc_id FROM public.legal_documents WHERE doc_number = '6331' AND doc_type = 'law' LIMIT 1;

  IF v_doc_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.legal_chunks (document_id, chunk_index, article_number, article_title, content) VALUES

  (v_doc_id, 1, 'Madde 1', 'Amaç',
   'Bu Kanunun amacı; işyerlerinde iş sağlığı ve güvenliğinin sağlanması ve mevcut sağlık ve güvenlik şartlarının iyileştirilmesi için işveren ve çalışanların görev, yetki, sorumluluk, hak ve yükümlülüklerini düzenlemektir.'),

  (v_doc_id, 2, 'Madde 2', 'Kapsam',
   'Bu Kanun; kamu ve özel sektöre ait bütün işlere ve işyerlerine, bu işyerlerinin işverenleri ile işveren vekillerine, çırak ve stajyerler de dâhil olmak üzere tüm çalışanlarına faaliyet konularına bakılmaksızın uygulanır. Ancak aşağıda belirtilen faaliyetler ve kişiler hakkında bu Kanun hükümleri uygulanmaz: a) Fabrika, bakım merkezi, dikimevi ve benzeri işyerlerindekiler hariç Türk Silahlı Kuvvetleri, genel kolluk kuvvetleri ve Milli İstihbarat Teşkilatı Müsteşarlığının faaliyetleri. b) Afet ve acil durum birimlerinin müdahale faaliyetleri. c) Ev hizmetleri. ç) Çalışan istihdam etmeksizin kendi nam ve hesabına mal ve hizmet üretimi yapanlar. d) Hükümlü ve tutuklulara yönelik infaz hizmetleri sırasında, iyileştirme kapsamında yapılan işyurdu, eğitim, güvenlik ve meslek edindirme faaliyetleri.'),

  (v_doc_id, 3, 'Madde 3', 'Tanımlar',
   'Bu Kanunun uygulanmasında; a) Bakanlık: Çalışma ve Sosyal Güvenlik Bakanlığını, b) Çalışan: Kendi özel kanunlarındaki statülerine bakılmaksızın kamu veya özel işyerlerinde istihdam edilen gerçek kişiyi, c) Çalışan temsilcisi: İş sağlığı ve güvenliği ile ilgili çalışmalara katılma, çalışmaları izleme, tedbir alınmasını isteme, tekliflerde bulunma ve benzeri konularda çalışanları temsil etmeye yetkili çalışanı, ç) Destek elemanı: Asli görevinin yanında iş sağlığı ve güvenliği ile ilgili önleme, koruma, tahliye, yangınla mücadele, ilk yardım ve benzeri konularda özel olarak görevlendirilmiş uygun donanım ve yeterli eğitime sahip kişiyi, d) Eşdeğer sağlık personeli: İş sağlığı ve güvenliği hizmetlerinde görevlendirilmek üzere Bakanlıkça belirlenecek eğitimleri tamamlayan hemşire, sağlık memuru, acil tıp teknisyeni ve çevre sağlığı teknisyeni diplomasına sahip olan ve Bakanlıkça yetkilendirilen kişiyi ifade eder.'),

  (v_doc_id, 4, 'Madde 4', 'İşverenin genel yükümlülüğü',
   '(1) İşveren, çalışanların işle ilgili sağlık ve güvenliğini sağlamakla yükümlü olup bu çerçevede; a) Mesleki risklerin önlenmesi, eğitim ve bilgi verilmesi dâhil her türlü tedbirin alınması, organizasyonun yapılması, gerekli araç ve gereçlerin sağlanması, sağlık ve güvenlik tedbirlerinin değişen şartlara uygun hale getirilmesi ve mevcut durumun iyileştirilmesi için çalışmalar yapar. b) İşyerinde alınan iş sağlığı ve güvenliği tedbirlerine uyulup uyulmadığını izler, denetler ve uygunsuzlukların giderilmesini sağlar. c) Risk değerlendirmesi yapar veya yaptırır. ç) Çalışana görev verirken, çalışanın sağlık ve güvenlik yönünden işe uygunluğunu göz önüne alır. d) Yeterli bilgi ve talimat verilenler dışındaki çalışanların hayati ve özel tehlike bulunan yerlere girmemesi için gerekli tedbirleri alır. (2) İşverenin iş sağlığı ve güvenliği tedbirlerinin maliyetini çalışanlara yansıtamaz.'),

  (v_doc_id, 5, 'Madde 5', 'Risklerden korunma ilkeleri',
   'İşverenin yükümlülüklerinin yerine getirilmesinde aşağıdaki ilkeler göz önünde bulundurulur: a) Risklerden kaçınmak. b) Kaçınılması mümkün olmayan riskleri analiz etmek. c) Risklerle kaynağında mücadele etmek. ç) İşin kişilere uygun hale getirilmesi için işyerlerinin tasarımı ile iş ekipmanı, çalışma şekli ve üretim metotlarının seçiminde özen göstermek; özellikle tekdüze çalışma ve üretim temposunun sağlık ve güvenliğe olumsuz etkilerini önlemek, önlenemiyor ise en aza indirmek. d) Teknik gelişmelere uyum sağlamak. e) Tehlikeli olanı, tehlikesiz veya daha az tehlikeli olanla değiştirmek. f) Teknoloji, iş organizasyonu, çalışma şartları, sosyal ilişkiler ve çalışma ortamı ile ilgili faktörlerin etkilerini kapsayan tutarlı ve genel bir önleme politikası geliştirmek. g) Toplu korunma tedbirlerine, kişisel korunma tedbirlerine göre öncelik vermek. ğ) Çalışanlara uygun talimatlar vermek.'),

  (v_doc_id, 6, 'Madde 6', 'İş sağlığı ve güvenliği hizmetleri',
   '(1) Mesleki risklerin önlenmesi ve bu risklerden korunulmasına yönelik çalışmaları da kapsayacak, iş sağlığı ve güvenliği hizmetlerinin sunulması için işveren; a) Çalışanları arasından iş güvenliği uzmanı, işyeri hekimi ve on ve daha fazla çalışanı olan çok tehlikeli sınıfta yer alan işyerlerinde diğer sağlık personeli görevlendirir. Çalışanları arasında belirlenen niteliklere sahip personel bulunmaması hâlinde, bu hizmetin tamamını veya bir kısmını ortak sağlık ve güvenlik birimlerinden hizmet alarak yerine getirebilir. Ancak belirlenen niteliklere ve gerekli belgeye sahip olması hâlinde, tehlike sınıfı ve çalışan sayısı dikkate alınarak, bu hizmetin yerine getirilmesini işverenin kendisi üstlenebilir.'),

  (v_doc_id, 7, 'Madde 8', 'İşyeri hekimleri ve iş güvenliği uzmanları',
   '(1) İşyeri hekimi ve iş güvenliği uzmanlarının hak ve yetkileri, görevlerini yerine getirmeleri nedeniyle kısıtlanamaz. Bu kişiler, görevlerini mesleğin gerektirdiği etik ilkeler ve mesleki bağımsızlık içerisinde yürütür. (2) İşyeri hekimi ve iş güvenliği uzmanları; görevlendirildikleri işyerlerinde iş sağlığı ve güvenliğiyle ilgili alınması gereken tedbirleri işverene yazılı olarak bildirir; bildirilen hususlardan hayati tehlike arz edenlerin işveren tarafından yerine getirilmemesi hâlinde, bu hususu Bakanlığın yetkili birimine bildirir. (6) Kamu kurum ve kuruluşlarında ilgili mevzuata göre çalıştırılan işyeri hekimi veya iş güvenliği uzmanı olma niteliğini haiz personel, gerekli belgeye sahip olmaları şartıyla asli görevlerinin yanında, belirlenen çalışma süresine riayet ederek çalışmakta oldukları kurumda veya ilgili personelin muvafakati ve üst yöneticinin onayı ile diğer kamu kurum ve kuruluşlarında görevlendirilebilir. Bu şekilde görevlendirilecek personele, görev yaptığı her saat için (200) gösterge rakamının memur aylık katsayısı ile çarpımı tutarında ilave ödeme yapılır.'),

  (v_doc_id, 8, 'Madde 10', 'Risk değerlendirmesi, kontrol, ölçüm ve araştırma',
   '(1) İşveren, iş sağlığı ve güvenliği yönünden risk değerlendirmesi yapmak veya yaptırmakla yükümlüdür. Risk değerlendirmesi yapılırken aşağıdaki hususlar dikkate alınır: a) Belirli risklerden etkilenecek çalışanların durumu. b) Kullanılacak iş ekipmanı ile kimyasal madde ve müstahzarların seçimi. c) İşyerinin tertip ve düzeni. ç) Genç, yaşlı, engelli, gebe veya emziren çalışanlar gibi özel politika gerektiren gruplar ile kadın çalışanların durumu. (2) İşveren, yapılmış olan risk değerlendirmesini; işyerinin taşınması veya binalarda değişiklik yapılması, işyerinde uygulanan teknoloji, kullanılan madde ve ekipmanlarda değişiklikler meydana gelmesi, üretim yönteminde değişiklikler olması, iş kazası, meslek hastalığı veya ramak kala olay meydana gelmesi hallerinde yenilemek zorundadır. (4) İşveren, iş sağlığı ve güvenliği yönünden çalışma ortamına ve çalışanların bu ortamda maruz kaldığı risklere uygun kontrol, ölçüm, inceleme ve araştırmaların yapılmasını sağlar.'),

  (v_doc_id, 9, 'Madde 11', 'Acil durum planları, yangınla mücadele ve ilk yardım',
   '(1) İşveren; a) Çalışma ortamı, kullanılan maddeler, iş ekipmanı ile çevre şartlarını dikkate alarak meydana gelebilecek acil durumları önceden değerlendirerek, çalışanları ve çalışma çevresini etkilemesi mümkün ve muhtemel acil durumları belirler ve bunların olumsuz etkilerini önleyici ve sınırlandırıcı tedbirleri alır. b) Acil durumların olumsuz etkilerinden korunmak üzere gerekli ölçüm ve değerlendirmeleri yapar, acil durum planlarını hazırlar. c) Acil durumlarla mücadele için işyerinin büyüklüğü ve taşıdığı özel tehlikeler, yapılan işin niteliği, çalışan sayısı ile işyerinde bulunan diğer kişileri dikkate alarak; önleme, koruma, tahliye, yangınla mücadele, ilk yardım ve benzeri konularda uygun donanıma sahip ve bu konularda eğitimli yeterli sayıda kişiyi görevlendirir. d) Özellikle ilk yardım, acil tıbbi müdahale, kurtarma ve yangınla mücadele konularında, işyeri dışındaki kuruluşlarla irtibatı sağlayacak gerekli düzenlemeleri yapar.'),

  (v_doc_id, 10, 'Madde 12', 'Tahliye',
   '(1) Ciddi, yakın ve önlenemeyen tehlikenin meydana gelmesi durumunda işveren; a) Çalışanların işi bırakarak derhal çalışma yerlerinden ayrılıp güvenli bir yere gidebilmeleri için, önceden gerekli düzenlemeleri yapar ve çalışanlara gerekli talimatları verir. b) Durumun devam etmesi hâlinde, zorunluluk olmadıkça, gerekli donanıma sahip ve özel olarak görevlendirilenler dışındaki çalışanlardan işlerine devam etmelerini isteyemez. (2) İşveren, çalışanların kendileri veya diğer kişilerin güvenliği için ciddi ve yakın bir tehlike ile karşılaştıkları ve amirine hemen haber veremedikleri durumlarda; istenmeyen sonuçların önlenmesi için, bilgi ve mevcut teknik donanımlar çerçevesinde müdahale edebilmelerine imkân sağlar.'),

  (v_doc_id, 11, 'Madde 13', 'Çalışmaktan kaçınma hakkı',
   '(1) Ciddi ve yakın tehlike ile karşı karşıya kalan çalışanlar kurula, kurulun bulunmadığı işyerlerinde ise işverene başvurarak durumun tespit edilmesini ve gerekli tedbirlerin alınmasına karar verilmesini talep edebilir. Kurul acilen toplanarak, işveren ise derhâl kararını verir ve durumu tutanakla tespit eder. Karar, çalışana ve çalışan temsilcisine yazılı olarak bildirilir. (2) Kurul veya işverenin çalışanın talebi yönünde karar vermesi hâlinde çalışan, gerekli tedbirler alınıncaya kadar çalışmaktan kaçınabilir. (3) Çalışanların çalışmaktan kaçındığı dönemdeki ücreti ile kanunlardan ve iş sözleşmesinden doğan diğer hakları saklıdır.'),

  (v_doc_id, 12, 'Madde 14', 'İş kazası ve meslek hastalıklarının kayıt ve bildirimi',
   '(1) İşveren; a) Bütün iş kazalarının ve meslek hastalıklarının kaydını tutar, gerekli incelemeleri yaparak bunlar ile ilgili raporları düzenler. b) İşyerinde meydana gelen ancak yaralanma veya ölüme neden olmadığı halde işyeri ya da iş ekipmanının zarara uğramasına yol açan veya çalışan, işyeri ya da iş ekipmanını zarara uğratma potansiyeli olan olayları inceleyerek bunlar ile ilgili raporları düzenler. (2) İşveren, aşağıdaki hallerde belirtilen sürede Sosyal Güvenlik Kurumuna bildirimde bulunur: a) İş kazalarını kazadan sonraki üç iş günü içinde. b) Sağlık hizmeti sunucuları veya işyeri hekimi tarafından kendisine bildirilen meslek hastalıklarını, öğrendiği tarihten itibaren üç iş günü içinde.'),

  (v_doc_id, 13, 'Madde 15', 'Sağlık gözetimi',
   '(1) İşveren; a) Çalışanların işyerinde maruz kalacakları sağlık ve güvenlik risklerini dikkate alarak sağlık gözetimine tabi tutulmalarını sağlar. b) Aşağıdaki hallerde çalışanların sağlık muayenelerinin yapılmasını sağlamak zorundadır: 1) İşe girişlerinde. 2) İş değişikliğinde. 3) İş kazası, meslek hastalığı veya sağlık nedeniyle tekrarlanan işten uzaklaşmalarından sonra işe dönüşlerinde talep etmeleri hâlinde. 4) İşin devamı süresince, çalışanın ve işin niteliği ile işyerinin tehlike sınıfına göre Bakanlıkça belirlenen düzenli aralıklarla. (2) Tehlikeli ve çok tehlikeli sınıfta yer alan işyerlerinde çalışacaklar, yapacakları işe uygun olduklarını belirten sağlık raporu olmadan işe başlatılamaz.'),

  (v_doc_id, 14, 'Madde 16', 'Çalışanların bilgilendirilmesi',
   '(1) İşveren, çalışanları ve çalışan temsilcilerini işyerinin özelliklerini de dikkate alarak aşağıdaki konularda bilgilendirir: a) İşyerinde karşılaşılabilecek sağlık ve güvenlik riskleri, koruyucu ve önleyici tedbirler. b) Kendileri ile ilgili yasal hak ve sorumluluklar. c) İlk yardım, olağan dışı durumlar, afetler ve yangınla mücadele ve tahliye işleri konusunda görevlendirilen kişiler. (2) İşveren; a) Başka işyerlerinden çalışmak üzere kendi işyerine gelen çalışanların birinci fıkrada belirtilen bilgilere ulaşmasını sağlamak üzere, söz konusu çalışanların işverenlerine gerekli bilgileri verir.'),

  (v_doc_id, 15, 'Madde 17', 'Çalışanların eğitimi',
   '(1) İşveren, çalışanların iş sağlığı ve güvenliği eğitimlerini almasını sağlar. Bu eğitim özellikle; işe başlamadan önce, çalışma yeri veya iş değişikliğinde, iş ekipmanının değişmesi hâlinde veya yeni teknoloji uygulanması hâlinde verilir. Eğitimler, değişen ve ortaya çıkan yeni risklere uygun olarak yenilenir, gerektiğinde ve düzenli aralıklarla tekrarlanır. (2) Çalışan temsilcileri özel olarak eğitilir. (3) Mesleki eğitim alma zorunluluğu bulunan tehlikeli ve çok tehlikeli sınıfta yer alan işlerde, yapacağı işle ilgili mesleki eğitim aldığını belgeleyemeyenler çalıştırılamaz. (7) Eğitimlerde geçen süre çalışma süresinden sayılır. Eğitim sürelerinin haftalık çalışma süresinin üzerinde olması hâlinde, bu süreler fazla sürelerle çalışma veya fazla çalışma olarak değerlendirilir.'),

  (v_doc_id, 16, 'Madde 18', 'Çalışanların görüşlerinin alınması ve katılımlarının sağlanması',
   '(1) İşveren, görüş alma ve katılımın sağlanması konusunda, çalışanlara veya iki ve daha fazla çalışan temsilcisinin bulunduğu işyerlerinde varsa işçi sendikası temsilcilerine yoksa çalışan temsilcilerine aşağıdaki imkânları sağlar: a) İş sağlığı ve güvenliği ile ilgili konularda görüşlerinin alınması, teklif getirme hakkının tanınması ve bu konulardaki görüşmelerde yer alma ve katılımlarının sağlanması. b) Yeni teknolojilerin uygulanması, seçilecek iş ekipmanı, çalışma ortamı ve şartlarının çalışanların sağlık ve güvenliğine etkisi konularında görüşlerinin alınması.'),

  (v_doc_id, 17, 'Madde 19', 'Çalışanların yükümlülükleri',
   '(1) Çalışanlar, iş sağlığı ve güvenliği ile ilgili aldıkları eğitim ve işverenin bu konudaki talimatları doğrultusunda, kendilerinin ve hareketlerinden veya yaptıkları işten etkilenen diğer çalışanların sağlık ve güvenliklerini tehlikeye düşürmemekle yükümlüdür. (2) Çalışanların, işveren tarafından verilen eğitim ve talimatlar doğrultusunda yükümlülükleri şunlardır: a) İşyerindeki makine, cihaz, araç, gereç, tehlikeli madde, taşıma ekipmanı ve diğer üretim araçlarını kurallara uygun şekilde kullanmak, bunların güvenlik donanımlarını doğru olarak kullanmak, keyfi olarak çıkarmamak ve değiştirmemek. b) Kendilerine sağlanan kişisel koruyucu donanımı doğru kullanmak ve korumak. c) İşyerindeki makine, cihaz, araç, gereç, tesis ve binalarda sağlık ve güvenlik yönünden ciddi ve yakın bir tehlike ile karşılaştıklarında ve koruma tedbirlerinde bir eksiklik gördüklerinde, işverene veya çalışan temsilcisine derhal haber vermek.'),

  (v_doc_id, 18, 'Madde 20', 'Çalışan temsilcisi',
   '(1) İşveren; işyerinin değişik bölümlerindeki riskler ve çalışan sayılarını göz önünde bulundurarak dengeli dağılıma özen göstermek kaydıyla, çalışanlar arasında yapılacak seçim veya seçimle belirlenemediği durumda atama yoluyla, aşağıda belirtilen sayılarda çalışan temsilcisini görevlendirir: a) İki ile elli arasında çalışanı bulunan işyerlerinde bir. b) Ellibir ile yüz arasında çalışanı bulunan işyerlerinde iki. c) Yüzbir ile beşyüz arasında çalışanı bulunan işyerlerinde üç. ç) Beşyüzbir ile bin arasında çalışanı bulunan işyerlerinde dört. d) Binbir ile ikibin arasında çalışanı bulunan işyerlerinde beş. e) İkibinbir ve üzeri çalışanı bulunan işyerlerinde altı. (2) Birden fazla çalışan temsilcisinin bulunması durumunda baş temsilci, çalışan temsilcileri arasında yapılacak seçimle belirlenir.'),

  (v_doc_id, 19, 'Madde 22', 'İş sağlığı ve güvenliği kurulu',
   '(1) Elli ve daha fazla çalışanın bulunduğu ve altı aydan fazla süren sürekli işlerin yapıldığı işyerlerinde işveren, iş sağlığı ve güvenliği ile ilgili çalışmalarda bulunmak üzere kurul oluşturur. (2) Altı aydan fazla süren asıl işveren-alt işveren ilişkisinin bulunduğu hallerde; a) Asıl işveren ve alt işveren tarafından birlikte kurul oluşturulur. b) Fıkranın (a) bendinde belirtilen hallerde kurul oluşturma yükümlülüğü asıl işverene aittir.'),

  (v_doc_id, 20, 'Madde 26', 'İdari para cezaları ve uygulanması',
   'Bu Kanunun; 4 üncü maddesinin birinci fıkrasının (a) ve (b) bentlerinde belirtilen yükümlülükleri yerine getirmeyen işverene her bir yükümlülük için ayrı ayrı ikibin Türk Lirası, 6 ncı maddesinin birinci fıkrası gereğince belirlenen nitelikte iş güvenliği uzmanı veya işyeri hekimi görevlendirmeyen işverene görevlendirmediği her bir kişi için beşbin Türk Lirası, aykırılığın devam ettiği her ay için aynı miktar, 8 inci maddesinin birinci, ikinci, üçüncü ve dördüncü fıkralarında belirtilen yükümlülükleri yerine getirmeyen işverene her bir ihlal için ayrı ayrı binbeşyüz Türk Lirası, 10 uncu maddesi gereğince risk değerlendirmesi yapmayan veya yaptırmayan işverene üçbin Türk Lirası, aykırılığın devam ettiği her ay için dörtbinyüz Türk Lirası, 11 ve 12 nci maddeleri hükümlerine aykırı davranan işverene her bir aykırılık için ayrı ayrı bin Türk Lirası, aykırılığın devam ettiği her ay için aynı miktar idari para cezası verilir.');

END;
$$;
;
