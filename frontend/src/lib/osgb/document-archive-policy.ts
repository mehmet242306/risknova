export type OsgbArchivePolicyRule = {
  key: string;
  title: string;
  legalMinimum: string;
  startPoint: string;
  defaultPolicy: string;
};

export const OSGB_ARCHIVE_POLICY_RULES: OsgbArchivePolicyRule[] = [
  {
    key: "health-personal-file",
    title: "Kisisel saglik dosyasi",
    legalMinimum: "Isten ayrilistan itibaren en az 15 yil",
    startPoint: "Isten ayrilis tarihi",
    defaultPolicy: "Sifreli saglik arsivinde tutulur; talep halinde onayli ornek akisi uretilir.",
  },
  {
    key: "long-latency-exposure",
    title: "Asbest ve uzun latent etkili maruziyet kayitlari",
    legalMinimum: "40 yila kadar saklama ihtiyaci",
    startPoint: "Maruziyet ya da kayit olusum tarihi",
    defaultPolicy: "Normal saglik dosyasindan ayri uzun sureli maruziyet arsivine ayrilir.",
  },
  {
    key: "risk-versions",
    title: "Risk degerlendirmesi surumleri",
    legalMinimum: "Acik sabit sure yok",
    startPoint: "Surum tarihi",
    defaultPolicy: "Guncel surum canli kalir, eski surumler ezilmeden en az 10 yil saklanir.",
  },
  {
    key: "emergency-and-drill",
    title: "Acil durum plani ve tatbikat raporlari",
    legalMinimum: "Acik sabit sure yok",
    startPoint: "Plan surumu veya tatbikat tarihi",
    defaultPolicy: "Tum tarihceler ve baski gecmisi en az 10 yil korunur.",
  },
  {
    key: "training-and-lms",
    title: "Egitim kayitlari ve uzaktan egitim loglari",
    legalMinimum: "Acik sabit sure yok",
    startPoint: "Egitim tarihi",
    defaultPolicy: "Istihdam boyunca aktif, sonrasinda en az 10 yil; ham LMS loglari da tutulur.",
  },
  {
    key: "incident-and-sgk",
    title: "Is kazasi, ramak kala ve SGK bildirim kaniti",
    legalMinimum: "Acik tek sure yok",
    startPoint: "Olay tarihi",
    defaultPolicy: "En az 15 yil; olay dosyasi ile saglik kayitlari ayni denetim zincirine baglanir.",
  },
  {
    key: "annual-plan",
    title: "Onayli defter, yillik plan ve yillik degerlendirme",
    legalMinimum: "Acik tek sure yok",
    startPoint: "Hizmet veya belge tarihi",
    defaultPolicy: "Hizmet bittikten sonra da en az 10 yil, asil ve suret mantigi korunur.",
  },
  {
    key: "measurements-controls",
    title: "Olcum, analiz ve periyodik kontrol raporlari",
    legalMinimum: "Acik tek sure yok",
    startPoint: "Rapor tarihi",
    defaultPolicy: "Bir sonraki olcume kadar sicak, sonrasinda en az 10 yil soguk arsivde tutulur.",
  },
];
