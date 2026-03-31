import type { IncidentRecord } from "@/lib/supabase/incident-api";

type CategoryKey = "man" | "machine" | "method" | "material" | "environment" | "measurement";

type AISuggestion = {
  ishikawa: {
    problemStatement: string;
    causes: Record<CategoryKey, string[]>;
    rootCauseConclusion: string;
  };
  dof: {
    rootCause: string;
    rootCauseAnalysis: string;
    correctiveActions: { action: string; assignedTo: string; deadline: string; done: boolean }[];
    preventiveActions: { action: string; assignedTo: string; deadline: string; done: boolean }[];
  };
};

/**
 * AI destekli İshikawa ve DÖF önerisi oluşturur.
 * Şu an kural tabanlı çalışıyor - ileride gerçek AI API'ye bağlanacak.
 */
export function generateAISuggestion(incident: IncidentRecord): AISuggestion {
  const type = incident.incidentType;
  const desc = incident.description || "";
  const tool = incident.toolUsed || "";
  const location = incident.incidentLocation || "";
  const activity = incident.generalActivity || "";
  const injury = incident.injuryType || "";
  const cause = incident.injuryCauseEvent || "";

  // İshikawa nedenleri - olay verilerinden çıkarım
  const manCauses: string[] = [];
  const machineCauses: string[] = [];
  const methodCauses: string[] = [];
  const materialCauses: string[] = [];
  const environmentCauses: string[] = [];
  const measurementCauses: string[] = [];

  // İnsan faktörleri
  manCauses.push("Çalışanın iş güvenliği eğitimi yeterliliğinin değerlendirilmesi");
  if (type === "work_accident") {
    manCauses.push("Kişisel koruyucu donanım (KKD) kullanım durumu");
    manCauses.push("Çalışanın dikkat ve konsantrasyon düzeyi");
  }
  if (desc.toLowerCase().includes("tecrübe") || desc.toLowerCase().includes("yeni"))
    manCauses.push("Deneyimsizlik veya işe yeni başlama");

  // Makine faktörleri
  if (tool) {
    machineCauses.push(`${tool} ekipmanının bakım durumu`);
    machineCauses.push(`${tool} koruyucu/güvenlik tertibatları`);
  }
  machineCauses.push("Ekipman periyodik kontrol durumu");

  // Yöntem faktörleri
  methodCauses.push("İş talimatı/prosedürünün güncelliği ve yeterliliği");
  methodCauses.push("Risk değerlendirmesinin yapılmış olması");
  if (activity) methodCauses.push(`${activity} faaliyeti için güvenli çalışma prosedürü`);

  // Malzeme faktörleri
  if (tool) materialCauses.push(`${tool} malzeme kalitesi ve uygunluğu`);
  materialCauses.push("Kullanılan malzemelerin MSDS/güvenlik bilgi formları");

  // Çevre faktörleri
  if (location) environmentCauses.push(`${location} bölgesinin aydınlatma durumu`);
  environmentCauses.push("Çalışma ortamı düzeni ve temizliği (5S)");
  environmentCauses.push("İşaretleme ve uyarı levhaları yeterliliği");

  // Ölçüm faktörleri
  measurementCauses.push("İSG denetim sıklığı ve kalitesi");
  measurementCauses.push("Ramak kala olay raporlama sistemi etkinliği");
  if (type === "occupational_disease")
    measurementCauses.push("Ortam ölçümlerinin (gürültü, toz, kimyasal) güncelliği");

  // Problem tanımı
  const problemStatement = desc ||
    `${type === "work_accident" ? "İş kazası" : type === "near_miss" ? "Ramak kala olay" : "Meslek hastalığı"} - ${location || "belirtilmemiş lokasyon"}${activity ? ` / ${activity}` : ""}`;

  // Kök neden sonucu
  const rootCauseConclusion = type === "work_accident"
    ? `Olay analizi sonucunda; ${cause || "belirlenen etkenler"} nedeniyle ${injury || "yaralanma"} meydana gelmiştir. Temel kök nedenler arasında eğitim eksikliği, prosedür uyumsuzluğu ve çalışma ortamı koşulları ön plana çıkmaktadır.`
    : type === "near_miss"
      ? `Ramak kala olay analizi sonucunda; potansiyel tehlike kaynağı tespit edilmiştir. Proaktif önlemler alınarak kazanın önlenmesi gerekmektedir.`
      : `Meslek hastalığı analizi sonucunda; uzun süreli maruziyet ve yetersiz koruyucu önlemler temel etken olarak belirlenmiştir.`;

  // DÖF önerileri
  const deadline30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const deadline7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const correctiveActions = [
    { action: "Olay yerinin güvenlik kontrolü ve gerekli düzeltmelerin yapılması", assignedTo: "İSG Uzmanı", deadline: deadline7, done: false },
    { action: "İlgili personelin ek İSG eğitimine alınması", assignedTo: "İSG Uzmanı", deadline: deadline30, done: false },
  ];

  if (tool) {
    correctiveActions.push({
      action: `${tool} ekipmanının kontrol ve bakımının yaptırılması`,
      assignedTo: "Teknik Bakım",
      deadline: deadline7,
      done: false,
    });
  }

  const preventiveActions = [
    { action: "Risk değerlendirmesinin güncellenmesi", assignedTo: "İSG Uzmanı", deadline: deadline30, done: false },
    { action: "Benzer çalışma alanlarının kontrol edilmesi", assignedTo: "İSG Uzmanı", deadline: deadline30, done: false },
    { action: "Tüm çalışanlara konu ile ilgili bilgilendirme yapılması", assignedTo: "İSG Uzmanı", deadline: deadline30, done: false },
  ];

  return {
    ishikawa: {
      problemStatement,
      causes: {
        man: manCauses,
        machine: machineCauses,
        method: methodCauses,
        material: materialCauses,
        environment: environmentCauses,
        measurement: measurementCauses,
      },
      rootCauseConclusion,
    },
    dof: {
      rootCause: rootCauseConclusion,
      rootCauseAnalysis: `Olay detayları incelendiğinde; ${desc || "belirtilen koşullar"} çerçevesinde kök nedenler İshikawa analizi ile belirlenmiştir.`,
      correctiveActions,
      preventiveActions,
    },
  };
}
