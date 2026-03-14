export type CalendarEventType =
  | "Ziyaret"
  | "Kurul"
  | "Muayene"
  | "Egitim"
  | "Tatbikat"
  | "Periyodik Kontrol";

export type CalendarEvent = {
  id: number;
  companyId: number;
  title: string;
  type: CalendarEventType;
  date: string;
  owner: string;
  note: string;
};

export const calendarEvents: CalendarEvent[] = [
  {
    id: 1,
    companyId: 1,
    title: "Aylik saha ziyareti",
    type: "Ziyaret",
    date: "2026-03-12",
    owner: "Mehmet Yildirim",
    note: "Yasam birimleri ve ortak alanlar kontrol edilecek.",
  },
  {
    id: 2,
    companyId: 2,
    title: "ISG kurul toplantisi",
    type: "Kurul",
    date: "2026-03-18",
    owner: "Mehmet Yildirim",
    note: "Aksiyonlar ve saha bulgulari degerlendirilecek.",
  },
  {
    id: 3,
    companyId: 3,
    title: "Periyodik saglik gozetimi",
    type: "Muayene",
    date: "2026-03-20",
    owner: "Isyeri Hekimi",
    note: "Ozel politika gerektiren calisanlar kontrol edilecek.",
  },
  {
    id: 4,
    companyId: 4,
    title: "Yangin sondurucu kontrol takibi",
    type: "Periyodik Kontrol",
    date: "2026-03-16",
    owner: "Mehmet Yildirim",
    note: "Etiket ve erisim kontrolu yapılacak.",
  }
];