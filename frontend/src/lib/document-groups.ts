// ============================================================
// ISG Document Groups — 20 groups, 101 documents
// ============================================================

export interface DocumentGroupItem {
  id: string;
  title: string;
  description?: string;
  isP1?: boolean; // priority 1 — has active template
  isP2?: boolean;
}

export interface DocumentGroup {
  key: string;
  title: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class
  items: DocumentGroupItem[];
}

export const DOCUMENT_GROUPS: DocumentGroup[] = [
  {
    key: 'is-giris-oryantasyon',
    title: 'İş Giriş İSG ve Oryantasyon',
    icon: 'UserCheck',
    color: 'text-blue-600',
    items: [
      { id: 'oryantasyon-formu', title: 'İSG Oryantasyon Eğitim Formu', isP1: true, isP2: true },
      { id: 'ise-giris-eslestirme', title: 'İşe Giriş Eşleştirme Formu', isP1: true },
      { id: 'ise-giris-saglik', title: 'İşe Giriş Sağlık Raporu Takip', isP1: true },
      { id: 'ise-giris-taahhut', title: 'İSG Taahhütnamesi', isP1: true },
      { id: 'kkd-zimmet', title: 'KKD Zimmet Formu', isP1: true, isP2: true },
      { id: 'isg-bilgilendirme', title: 'İSG Bilgilendirme Tutanağı', isP1: true },
      { id: 'gorev-tanimlari', title: 'Görev Tanımları', isP1: true },
      { id: 'oryantasyon-kontrol', title: 'Oryantasyon Kontrol Listesi', isP1: true },
    ],
  },
  {
    key: 'kurul-kayitlari',
    title: 'İSG Kurul Kayıtları',
    icon: 'Users',
    color: 'text-purple-600',
    items: [
      { id: 'kurul-tutanagi', title: 'İSG Kurul Toplantı Tutanağı', isP1: true },
      { id: 'kurul-uye-listesi', title: 'Kurul Üye Listesi', isP1: true },
      { id: 'kurul-karar-takip', title: 'Kurul Karar Takip Formu', isP1: true },
      { id: 'kurul-gundem', title: 'Kurul Gündem Belgesi', isP1: true },
      { id: 'kurul-yillik-plan', title: 'Kurul Yıllık Toplantı Planı', isP1: true },
      { id: 'kurul-katilim', title: 'Kurul Katılım Çizelgesi', isP1: true },
      { id: 'kurul-ozel-toplanti', title: 'Özel Toplantı Tutanağı', isP1: true },
      { id: 'kurul-secim-tutanagi', title: 'Kurul Seçim Tutanağı', isP1: true },
    ],
  },
  {
    key: 'egitim-dosyasi',
    title: 'Eğitim Dosyası',
    icon: 'GraduationCap',
    color: 'text-green-600',
    items: [
      { id: 'egitim-katilim-formu', title: 'Eğitim Katılım Formu', isP1: true },
      { id: 'egitim-sertifika', title: 'Eğitim Sertifikası', isP1: true },
      { id: 'egitim-yillik-plan', title: 'Yıllık Eğitim Planı', isP1: true },
      { id: 'egitim-ihtiyac-analizi', title: 'Eğitim İhtiyaç Analizi', isP1: true },
      { id: 'egitim-degerlendirme', title: 'Eğitim Değerlendirme Formu', isP1: true },
      { id: 'egitim-icerik', title: 'Eğitim İçerik Dokümanı', isP1: true },
      { id: 'egitim-etkinlik', title: 'Eğitim Etkinlik Ölçüm Formu', isP1: true },
      { id: 'egitim-talep', title: 'Eğitim Talep Formu', isP1: true },
      { id: 'egitim-ozet-raporu', title: 'Eğitim Özet Raporu', isP1: true },
    ],
  },
  {
    key: 'risk-degerlendirme',
    title: 'Risk Değerlendirme ve Tespit Öneri',
    icon: 'ShieldAlert',
    color: 'text-red-600',
    items: [
      { id: 'risk-raporu', title: 'Risk Değerlendirme Raporu', isP1: true },
      { id: 'tespit-oneri-defteri', title: 'Tespit ve Öneri Defteri', isP1: true },
      { id: 'risk-envanter', title: 'Tehlike ve Risk Envanteri', isP1: true },
      { id: 'risk-aksiyon-plani', title: 'Risk Aksiyon Planı', isP1: true },
      { id: 'is-kazasi-risk', title: 'Kaza Sonrası Risk Güncelleme', isP1: true },
      { id: 'risk-haritasi', title: 'Risk Haritası Dokümanı', isP1: true },
      { id: 'risk-izleme-raporu', title: 'Risk İzleme Raporu', isP1: true },
      { id: 'risk-iletisim-formu', title: 'Risk İletişim Formu', isP1: true },
      { id: 'risk-metodoloji', title: 'Risk Metodoloji Belgesi', isP1: true },
    ],
  },
  {
    key: 'acil-durum',
    title: 'Acil Durum Faaliyetleri',
    icon: 'Siren',
    color: 'text-orange-600',
    items: [
      { id: 'acil-durum-plani', title: 'Acil Durum Planı', isP1: true },
      { id: 'acil-durum-ekip', title: 'Acil Durum Ekip Listesi', isP1: true },
      { id: 'tahliye-plani', title: 'Tahliye Planı', isP1: true },
      { id: 'tatbikat-raporu', title: 'Tatbikat Raporu', isP1: true },
      { id: 'acil-durum-tel', title: 'Acil Durum Telefon Listesi', isP1: true },
      { id: 'acil-durum-talimat', title: 'Acil Durum Talimatı', isP1: true },
      { id: 'toplanma-alani', title: 'Toplanma Alanı Krokisi', isP1: true },
      { id: 'acil-durum-egitim', title: 'Acil Durum Eğitim Planı', isP1: true },
      { id: 'acil-durum-envanter', title: 'Acil Durum Ekipman Envanteri', isP1: true },
      { id: 'acil-durum-senaryo', title: 'Acil Durum Senaryoları', isP1: true },
    ],
  },
  {
    key: 'kaza-olay',
    title: 'Kaza, Olay ve Ramak Kala',
    icon: 'AlertTriangle',
    color: 'text-amber-600',
    items: [
      { id: 'kaza-bildirim-formu', title: 'İş Kazası Bildirim Formu', isP1: true },
      { id: 'kaza-arastirma-raporu', title: 'Kaza Araştırma Raporu', isP1: true },
      { id: 'ramak-kala-formu', title: 'Ramak Kala Bildirim Formu', isP1: true },
      { id: 'dof-formu', title: 'Düzeltici Önleyici Faaliyet (DÖF) Raporu', isP1: true, isP2: true },
      { id: 'kaza-istatistik', title: 'Kaza İstatistik Raporu', isP1: true },
      { id: 'kok-neden-analizi', title: 'Kök Neden Analizi Raporu', isP1: true },
      { id: 'olay-degerlendirme', title: 'Olay Değerlendirme Tutanağı', isP1: true },
    ],
  },
  {
    key: 'iletisim-yazisma',
    title: 'İletişim ve Yazışma',
    icon: 'Mail',
    color: 'text-sky-600',
    items: [
      { id: 'resmi-yazi', title: 'Resmi Yazı Şablonu', isP1: true },
      { id: 'uyari-yazisi', title: 'Uyarı Yazısı', isP1: true },
      { id: 'bilgilendirme-yazisi', title: 'Bilgilendirme Yazısı', isP1: true },
    ],
  },
  {
    key: 'talimatlar',
    title: 'Talimatlar',
    icon: 'ClipboardList',
    color: 'text-teal-600',
    items: [
      { id: 'genel-isg-talimati', title: 'Genel İSG Talimatı', isP1: true },
      { id: 'makine-talimati', title: 'Makine/Ekipman Kullanım Talimatı', isP1: true },
      { id: 'kimyasal-talimati', title: 'Kimyasal Madde Kullanım Talimatı', isP1: true },
      { id: 'kkd-kullanim-talimati', title: 'KKD Kullanım Talimatı', isP1: true },
    ],
  },
  {
    key: 'prosedurler',
    title: 'İSG Prosedürleri',
    icon: 'BookOpen',
    color: 'text-indigo-600',
    items: [
      { id: 'isg-politikasi', title: 'İSG Politikası', isP1: true, isP2: true },
      { id: 'risk-degerlendirme-prosedur', title: 'Risk Değerlendirme Prosedürü', isP1: true },
      { id: 'egitim-proseduru', title: 'Eğitim Prosedürü', isP1: true },
      { id: 'acil-durum-prosedur', title: 'Acil Durum Prosedürü', isP1: true },
      { id: 'kaza-bildirimi-prosedur', title: 'Kaza Bildirimi Prosedürü', isP1: true },
      { id: 'kkd-proseduru', title: 'KKD Yönetimi Prosedürü', isP1: true },
      { id: 'saglik-gozetimi-prosedur', title: 'Sağlık Gözetimi Prosedürü', isP1: true },
      { id: 'is-izni-proseduru', title: 'İş İzni Prosedürü', isP1: true },
      { id: 'yuksekte-calisma', title: 'Yüksekte Çalışma Prosedürü', isP1: true },
      { id: 'kapali-alan', title: 'Kapalı Alan Çalışma Prosedürü', isP1: true },
      { id: 'elektrik-guvenlik', title: 'Elektrik Güvenliği Prosedürü', isP1: true },
      { id: 'ergonomi-prosedur', title: 'Ergonomi Prosedürü', isP1: true },
      { id: 'taseron-yonetimi', title: 'Taşeron Yönetimi Prosedürü', isP1: true },
      { id: 'depolama-prosedur', title: 'Depolama Prosedürü', isP1: true },
      { id: 'isaret-etiketleme', title: 'İşaret ve Etiketleme Prosedürü', isP1: true },
      { id: 'gece-calisma', title: 'Gece Çalışma Prosedürü', isP1: true },
      { id: 'sicak-calisma', title: 'Sıcak Çalışma Prosedürü', isP1: true },
      { id: 'gurultu-prosedur', title: 'Gürültü Kontrolü Prosedürü', isP1: true },
      { id: 'toz-prosedur', title: 'Toz Kontrolü Prosedürü', isP1: true },
    ],
  },
  {
    key: 'denetim-kontrol',
    title: 'İşletme Kontrolü ve Denetim',
    icon: 'Search',
    color: 'text-cyan-600',
    items: [
      { id: 'is-yeri-denetim', title: 'İş Yeri Denetim Raporu', isP1: true },
      { id: 'ic-denetim-raporu', title: 'İç Denetim Raporu', isP1: true },
      { id: 'kontrol-listesi', title: 'Genel Kontrol Listesi', isP1: true },
      { id: 'uygunsuzluk-raporu', title: 'Uygunsuzluk Raporu', isP1: true },
    ],
  },
  {
    key: 'personel-ozluk',
    title: 'Personel Özlük ve Sözleşmeler',
    icon: 'UserCog',
    color: 'text-rose-600',
    items: [
      { id: 'is-sozlesmesi', title: 'İş Sözleşmesi', isP1: true },
      { id: 'ek-sozlesme', title: 'Ek Sözleşme (İSG)', isP1: true },
      { id: 'gizlilik-sozlesme', title: 'Gizlilik Sözleşmesi', isP1: true },
      { id: 'gorev-tanım-belgesi', title: 'Görev Tanım Belgesi', isP1: true },
      { id: 'ise-giris-evrak', title: 'İşe Giriş Evrak Listesi', isP1: true },
      { id: 'isten-ayrilma', title: 'İşten Ayrılma Formu', isP1: true },
      { id: 'izin-formu', title: 'İzin Talep Formu', isP1: true },
      { id: 'mesai-formu', title: 'Fazla Mesai Talep Formu', isP1: true },
      { id: 'disiplin-tutanagi', title: 'Disiplin Tutanağı', isP1: true },
      { id: 'performans-degerlendirme', title: 'Performans Değerlendirme Formu', isP1: true },
      { id: 'terfi-formu', title: 'Terfi Teklif Formu', isP1: true },
      { id: 'personel-bilgi-formu', title: 'Personel Bilgi Formu', isP1: true },
      { id: 'cv-formu', title: 'Özgeçmiş Formu', isP1: true },
      { id: 'referans-formu', title: 'Referans Kontrol Formu', isP1: true },
      { id: 'bordro-mutabakat', title: 'Bordro Mutabakat Formu', isP1: true },
      { id: 'zimmet-teslim', title: 'Zimmet Teslim Tutanağı', isP1: true },
      { id: 'yetkinlik-matrisi', title: 'Yetkinlik Matrisi', isP1: true },
    ],
  },
  {
    key: 'yillik-degerlendirme',
    title: 'İSG Yıllık Değerlendirme',
    icon: 'CalendarCheck',
    color: 'text-emerald-600',
    items: [
      { id: 'yillik-faaliyet-raporu', title: 'Yıllık Faaliyet Raporu', isP1: true },
      { id: 'yillik-calisma-plani', title: 'Yıllık Çalışma Planı', isP1: true },
    ],
  },
  {
    key: 'calisan-temsilcisi',
    title: 'Çalışan Temsilcisi',
    icon: 'UserPlus',
    color: 'text-violet-600',
    items: [
      { id: 'temsilci-secim-tutanagi', title: 'Çalışan Temsilcisi Seçim Tutanağı', isP1: true },
      { id: 'temsilci-gorev-tanimi', title: 'Temsilci Görev Tanımı', isP1: true },
      { id: 'temsilci-raporu', title: 'Temsilci Faaliyet Raporu', isP1: true },
      { id: 'temsilci-oneri-formu', title: 'Temsilci Öneri Formu', isP1: true },
      { id: 'temsilci-egitim-kaydi', title: 'Temsilci Eğitim Kaydı', isP1: true },
      { id: 'temsilci-atama-yazisi', title: 'Temsilci Atama Yazısı', isP1: true },
    ],
  },
  {
    key: 'iyi-uygulama',
    title: 'İyi Uygulama',
    icon: 'Award',
    color: 'text-yellow-600',
    items: [
      { id: 'iyi-uygulama-raporu', title: 'İyi Uygulama Raporu', isP1: true },
      { id: 'oneri-odul-sistemi', title: 'Öneri ve Ödül Sistemi Formu', isP1: true },
      { id: 'benchmark-raporu', title: 'Kıyaslama (Benchmark) Raporu', isP1: true },
    ],
  },
  {
    key: 'dis-gorevlendirme',
    title: 'İş Yeri Dışı Görevlendirme',
    icon: 'MapPin',
    color: 'text-lime-600',
    items: [
      { id: 'dis-gorev-yazisi', title: 'Dış Görevlendirme Yazısı', isP1: true },
    ],
  },
  {
    key: 'arac-makine',
    title: 'Araç ve Makine Takip',
    icon: 'Wrench',
    color: 'text-stone-600',
    items: [
      { id: 'arac-kontrol-listesi', title: 'Araç Kontrol Listesi', isP1: true },
      { id: 'makine-bakim-formu', title: 'Makine Bakım Formu', isP1: true },
      { id: 'forklift-kontrol', title: 'Forklift Günlük Kontrol Formu', isP1: true },
      { id: 'arac-zimmet', title: 'Araç Zimmet Tutanağı', isP1: true },
      { id: 'makine-envanter', title: 'Makine Envanteri', isP1: true },
    ],
  },
  {
    key: 'periyodik-kontrol',
    title: 'Periyodik Kontrol Belgeleri',
    icon: 'Clock',
    color: 'text-fuchsia-600',
    items: [
      { id: 'asansor-kontrol', title: 'Asansör Periyodik Kontrol', isP1: true },
      { id: 'basincli-kap', title: 'Basınçlı Kap Kontrolü', isP1: true },
      { id: 'elektrik-tesisati', title: 'Elektrik Tesisatı Kontrolü', isP1: true },
      { id: 'topraklama-kontrol', title: 'Topraklama Ölçümü', isP1: true },
      { id: 'paratoner-kontrol', title: 'Paratoner Kontrolü', isP1: true },
      { id: 'yangin-tup-kontrol', title: 'Yangın Tüpü Kontrolü', isP1: true },
      { id: 'yangin-dolap-kontrol', title: 'Yangın Dolabı Kontrolü', isP1: true },
      { id: 'kompressor-kontrol', title: 'Kompresör Kontrolü', isP1: true },
      { id: 'vinc-kontrol', title: 'Vinç/Kaldırma Ekipmanı Kontrolü', isP1: true },
      { id: 'kazan-kontrol', title: 'Kazan Periyodik Kontrolü', isP1: true },
      { id: 'havalandirma-kontrol', title: 'Havalandırma Sistemi Kontrolü', isP1: true },
      { id: 'jenerator-kontrol', title: 'Jeneratör Kontrolü', isP1: true },
      { id: 'lpg-kontrol', title: 'LPG Tesisat Kontrolü', isP1: true },
      { id: 'merdiven-iskele', title: 'Merdiven/İskele Kontrolü', isP1: true },
    ],
  },
  {
    key: 'diger-kayitlar',
    title: 'Diğer Kayıtlar',
    icon: 'FolderOpen',
    color: 'text-gray-600',
    items: [
      { id: 'msds-kayit', title: 'MSDS/GBF Kayıt Formu', isP1: true },
      { id: 'is-izni-formu', title: 'İş İzni Formu', isP1: true },
      { id: 'sicak-is-izni', title: 'Sıcak İş İzni Formu', isP1: true },
      { id: 'yuksekte-is-izni', title: 'Yüksekte Çalışma İzni', isP1: true },
      { id: 'kapali-alan-izni', title: 'Kapalı Alan Giriş İzni', isP1: true },
      { id: 'kazi-is-izni', title: 'Kazı İş İzni', isP1: true },
      { id: 'ortam-olcum', title: 'Ortam Ölçüm Raporu', isP1: true },
      { id: 'gurultu-haritasi', title: 'Gürültü Haritası', isP1: true },
      { id: 'aydinlatma-olcum', title: 'Aydınlatma Ölçüm Raporu', isP1: true },
      { id: 'termal-konfor', title: 'Termal Konfor Ölçümü', isP1: true },
      { id: 'toz-olcum', title: 'Toz Ölçüm Raporu', isP1: true },
      { id: 'titresim-olcum', title: 'Titreşim Ölçüm Raporu', isP1: true },
    ],
  },
  {
    key: 'yangin-kimyasal',
    title: 'Yangın ve Kimyasallar',
    icon: 'Flame',
    color: 'text-red-500',
    items: [
      { id: 'yangin-risk-analizi', title: 'Yangın Risk Analizi', isP1: true },
      { id: 'yangin-sondurme-plani', title: 'Yangın Söndürme Planı', isP1: true },
      { id: 'kimyasal-envanter', title: 'Kimyasal Madde Envanteri', isP1: true },
      { id: 'kimyasal-risk', title: 'Kimyasal Risk Değerlendirmesi', isP1: true },
      { id: 'kimyasal-depolama', title: 'Kimyasal Depolama Planı', isP1: true },
      { id: 'yangin-tatbikat', title: 'Yangın Tatbikat Raporu', isP1: true },
      { id: 'yangin-ekipman-kontrol', title: 'Yangın Ekipman Kontrol Çizelgesi', isP1: true },
    ],
  },
  {
    key: 'ilkyardim',
    title: 'İlkyardım Eğitimleri',
    icon: 'Heart',
    color: 'text-pink-600',
    items: [
      { id: 'ilkyardim-egitim-plani', title: 'İlkyardım Eğitim Planı', isP1: true },
      { id: 'ilkyardimci-listesi', title: 'İlkyardımcı Listesi', isP1: true },
      { id: 'ilkyardim-malzeme', title: 'İlkyardım Malzeme Kontrol Formu', isP1: true },
    ],
  },
  {
    key: 'isyeri-hekimi',
    title: 'İşyeri Hekimi Dokümanları',
    icon: 'Heart',
    color: 'text-emerald-600',
    items: [
      { id: 'hekim-gozetim-raporu', title: 'Sağlık Gözetimi Raporu', isP1: true },
      { id: 'hekim-periyodik-muayene', title: 'Periyodik Muayene Planı', isP1: true },
      { id: 'hekim-ise-giris-muayene', title: 'İşe Giriş Muayene Formu', isP1: true },
      { id: 'hekim-meslek-hastaligi', title: 'Meslek Hastalığı Takip Formu', isP1: true },
      { id: 'hekim-ilac-takip', title: 'İlaç ve Sarf Malzeme Takip', isP1: true },
      { id: 'hekim-recete-kayit', title: 'Reçete Kayıt Formu', isP1: true },
      { id: 'hekim-revir-defteri', title: 'Revir/Muayene Defteri', isP1: true },
      { id: 'hekim-saglik-tarama', title: 'Toplu Sağlık Tarama Raporu', isP1: true },
      { id: 'hekim-biolojik-maruziyet', title: 'Biyolojik Maruziyet Değerlendirmesi', isP1: true },
      { id: 'hekim-yillik-degerlendirme', title: 'İşyeri Hekimi Yıllık Değerlendirme', isP1: true },
    ],
  },
];

// Helper: get group by key
export function getGroupByKey(key: string): DocumentGroup | undefined {
  return DOCUMENT_GROUPS.find((g) => g.key === key);
}

// Helper: get all P1 items
export function getP1Items(): { group: DocumentGroup; item: DocumentGroupItem }[] {
  const result: { group: DocumentGroup; item: DocumentGroupItem }[] = [];
  for (const group of DOCUMENT_GROUPS) {
    for (const item of group.items) {
      if (item.isP1) result.push({ group, item });
    }
  }
  return result;
}

// Helper: total document count
export function getTotalDocumentCount(): number {
  return DOCUMENT_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
}
