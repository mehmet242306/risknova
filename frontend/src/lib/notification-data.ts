export type NotificationLevel = "Bilgi" | "Yuksek" | "Kritik";
export type NotificationSource =
  | "DOF"
  | "Dokuman"
  | "Acil Durum"
  | "Takvim"
  | "Egitim"
  | "Tatbikat";

export type SystemNotification = {
  id: number;
  companyId: number;
  title: string;
  source: NotificationSource;
  level: NotificationLevel;
  createdAt: string;
  message: string;
  read: boolean;
};

export const seededNotifications: SystemNotification[] = [
  {
    id: 1,
    companyId: 1,
    title: "Acil durum plani revizyon tarihi yaklasiyor",
    source: "Acil Durum",
    level: "Kritik",
    createdAt: "2026-03-10 09:10",
    message: "Acil durum plani icin gozden gecirme tarihi yaklasti. Revizyon kaydi acilabilir.",
    read: false,
  },
  {
    id: 2,
    companyId: 2,
    title: "Kritik DOF termin tarihi yaklasiyor",
    source: "DOF",
    level: "Kritik",
    createdAt: "2026-03-10 09:20",
    message: "Elektrik veya saha guvenligi ile ilgili kritik aksiyonlarin termin tarihi bu hafta doluyor.",
    read: false,
  },
  {
    id: 3,
    companyId: 3,
    title: "Tatbikat yenileme zamani yaklasiyor",
    source: "Tatbikat",
    level: "Yuksek",
    createdAt: "2026-03-10 09:30",
    message: "Son tatbikat kaydi uzerinden uzun sure gecti. Yeni tatbikat planlanmali.",
    read: false,
  },
  {
    id: 4,
    companyId: 4,
    title: "Belge taslagi onay bekliyor",
    source: "Dokuman",
    level: "Bilgi",
    createdAt: "2026-03-10 09:40",
    message: "Kurul tutanagi veya benzeri taslak belgeler onay akisini bekliyor.",
    read: true,
  }
];