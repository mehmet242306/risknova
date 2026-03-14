export type UserRole = "İSG Uzmanı" | "İşyeri Hekimi" | "DSP" | "Yönetici";
export type UserServiceModel = "Kurum İçi" | "OSGB" | "Kendi Nam ve Hesabına";

export type UserProfile = {
  id: number;
  fullName: string;
  role: UserRole;
  title: string;
  certificateClass: string;
  email: string;
  phone: string;
  city: string;
  serviceModel: UserServiceModel;
  organization: string;
  profileImage: string | null;
  bio: string;
  activeCompanies: number;
  activeTasks: number;
  lastLogin: string;
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    system: boolean;
  };
};

export const userProfile: UserProfile = {
  id: 1,
  fullName: "Mehmet Yıldırım",
  role: "İSG Uzmanı",
  title: "İş Sağlığı ve Güvenliği Profesyoneli",
  certificateClass: "B Sınıfı",
  email: "mehmet@example.com",
  phone: "0532 000 00 00",
  city: "Elazığ",
  serviceModel: "Kendi Nam ve Hesabına",
  organization: "güvenliğimcepte",
  profileImage: null,
  bio: "Saha denetimi, risk analizi, dokümantasyon ve aksiyon takibi süreçlerini yöneten profesyonel kullanıcı profili.",
  activeCompanies: 4,
  activeTasks: 7,
  lastLogin: "09.03.2026 03:10",
  notificationPreferences: {
    email: true,
    sms: false,
    system: true,
  },
};

export function getUserInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}