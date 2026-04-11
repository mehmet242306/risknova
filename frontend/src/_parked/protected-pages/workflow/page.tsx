"use client";

import { useMemo, useState } from "react";
import { companies } from "@/lib/mock-data";
import { initialActions } from "@/lib/action-data";
import { managedDocuments } from "@/lib/document-data";
import { emergencyPlans, emergencyTrainings, drillRecords } from "@/lib/emergency-data";
import { calendarEvents } from "@/lib/calendar-data";
import { seededNotifications } from "@/lib/notification-data";

type StageStatus = "Tamam" | "Devam" | "Kritik" | "Baslanmadi";

type WorkflowStage = {
  title: string;
  status: StageStatus;
  summary: string;
  details: string[];
};

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 18,
        padding: 18,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 16,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function badge(status: StageStatus): React.CSSProperties {
  const bg =
    status === "Tamam"
      ? "#f5fff7"
      : status === "Devam"
      ? "#f4f8ff"
      : status === "Kritik"
      ? "#ffe9e9"
      : "#fff9ef";

  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #eee",
    background: bg,
    fontWeight: 700,
    fontSize: 13,
    display: "inline-flex",
  };
}

function getDateDiff(dateStr: string) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - today.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function WorkflowPage() {
  const [companyId, setCompanyId] = useState<number>(companies[0]?.id ?? 1);

  const company = useMemo(
    () => companies.find((item) => item.id === companyId) ?? companies[0],
    [companyId]
  );

  const companyActions = initialActions.filter((item) => item.companyId === companyId);
  const openActions = companyActions.filter((item) => item.status !== "Tamamlandi");
  const criticalActions = openActions.filter((item) => item.priority === "Kritik");
  const lateActions = openActions.filter((item) => getDateDiff(item.dueDate) < 0);

  const companyDocuments = managedDocuments.filter((item) => item.companyId === companyId);
  const revisionDocs = companyDocuments.filter(
    (item) => item.status === "Revizyon Gerekli" || getDateDiff(item.nextReviewDate) <= 30
  );

  const emergencyPlan = emergencyPlans.find((item) => item.companyId === companyId);
  const companyTrainings = emergencyTrainings.filter((item) => item.companyId === companyId);
  const companyDrills = drillRecords.filter((item) => item.companyId === companyId);

  const upcomingTrainings = companyTrainings.filter((item) => getDateDiff(item.renewalDate) <= 45);
  const upcomingDrills = companyDrills.filter((item) => getDateDiff(item.nextDrillDate) <= 60);

  const companyCalendar = calendarEvents.filter((item) => item.companyId === companyId);
  const nearCalendar = companyCalendar.filter((item) => getDateDiff(item.date) <= 14);

  const companyNotifications = seededNotifications.filter((item) => item.companyId === companyId && !item.read);

  const stages: WorkflowStage[] = [
    {
      title: "1. Kurum Profili",
      status: "Tamam",
      summary: `${company.name} icin temel kurum karti aktif.`,
      details: [
        `Faaliyet: ${company.sector}`,
        `Tehlike sinifi: ${company.hazardClass}`,
        `Calisan sayisi: ${company.employeeCount}`,
      ],
    },
    {
      title: "2. Saha ve Denetim",
      status: company.lastVisit ? "Devam" : "Baslanmadi",
      summary: `Son ziyaret: ${company.lastVisit}`,
      details: [
        `Acik aksiyon sayisi: ${company.openActions}`,
        `Risk seviyesi: ${company.riskLevel}`,
        `Dokuman durumu: ${company.documentStatus}`,
      ],
    },
    {
      title: "3. DOF ve Aksiyon",
      status:
        criticalActions.length > 0 || lateActions.length > 0
          ? "Kritik"
          : openActions.length > 0
          ? "Devam"
          : "Tamam",
      summary: `${openActions.length} acik aksiyon, ${criticalActions.length} kritik, ${lateActions.length} geciken.`,
      details: openActions.length
        ? openActions.slice(0, 3).map((item) => `${item.title} - ${item.dueDate}`)
        : ["Acik aksiyon bulunmuyor."],
    },
    {
      title: "4. Dokuman Durumu",
      status:
        revisionDocs.length > 0
          ? "Kritik"
          : companyDocuments.length > 0
          ? "Devam"
          : "Baslanmadi",
      summary: `${companyDocuments.length} belge, ${revisionDocs.length} revizyon/yakin tarihli belge.`,
      details: companyDocuments.length
        ? companyDocuments.slice(0, 3).map((item) => `${item.title} - ${item.status}`)
        : ["Belge kaydi bulunmuyor."],
    },
    {
      title: "5. Acil Durum Hazirligi",
      status:
        !emergencyPlan
          ? "Baslanmadi"
          : upcomingDrills.length > 0 || upcomingTrainings.length > 0
          ? "Devam"
          : "Tamam",
      summary: emergencyPlan
        ? `Plan mevcut. ${upcomingTrainings.length} egitim, ${upcomingDrills.length} tatbikat takibi var.`
        : "Acil durum plani kaydi bulunmuyor.",
      details: emergencyPlan
        ? [
            `Plan versiyonu: ${emergencyPlan.version}`,
            `Plan gozden gecirme: ${emergencyPlan.nextReviewDate}`,
            `Toplanma alani: ${emergencyPlan.assemblyPoint}`,
          ]
        : ["Plan, ekip ve tatbikat omurgasi kurulmalidir."],
    },
    {
      title: "6. Takvim ve Hatirlatma",
      status: nearCalendar.length > 0 ? "Devam" : "Baslanmadi",
      summary: `${nearCalendar.length} yakin tarihli takvim kaydi var.`,
      details: nearCalendar.length
        ? nearCalendar.slice(0, 3).map((item) => `${item.title} - ${item.date}`)
        : ["Yakin tarihli takvim kaydi bulunmuyor."],
    },
    {
      title: "7. Bildirim ve Onceliklendirme",
      status: companyNotifications.length > 0 ? "Kritik" : "Tamam",
      summary: `${companyNotifications.length} okunmamis bildirim var.`,
      details: companyNotifications.length
        ? companyNotifications.slice(0, 3).map((item) => `${item.title} - ${item.level}`)
        : ["Bekleyen kritik bildirim yok."],
    },
  ];

  const nextActions = [
    criticalActions.length > 0
      ? `Kritik DOF'leri once kapat: ${criticalActions.length} kayit`
      : null,
    lateActions.length > 0
      ? `Geciken aksiyonlar icin sorumlu takibini yap: ${lateActions.length} kayit`
      : null,
    revisionDocs.length > 0
      ? `Revizyon gerektiren belgeleri guncelle: ${revisionDocs.length} belge`
      : null,
    !emergencyPlan
      ? "Acil durum plani ve destek ekipleri modulunu tamamla"
      : null,
    upcomingTrainings.length > 0
      ? `Yenileme tarihi yaklasan egitimleri planla: ${upcomingTrainings.length} kayit`
      : null,
    upcomingDrills.length > 0
      ? `Yaklasan tatbikatlari takvime bagla: ${upcomingDrills.length} kayit`
      : null,
    companyNotifications.length > 0
      ? `Okunmamis bildirimleri degerlendir: ${companyNotifications.length} kayit`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Kurum Bazli Gorev Zinciri</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu ekran; secilen kurum icin tum modulleri tek akista birlestirir ve
          kullaniciya siradaki dogru operasyon adimlarini gosterir.
        </p>
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
          marginBottom: 20,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Kurum Secimi</div>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(Number(e.target.value))}
          style={{ width: "100%", maxWidth: 420, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        >
          {companies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard title="Acik Aksiyon" value={String(openActions.length)} hint={`${criticalActions.length} kritik, ${lateActions.length} geciken`} />
        <StatCard title="Belge Durumu" value={String(companyDocuments.length)} hint={`${revisionDocs.length} revizyon / yakin tarihli`} />
        <StatCard title="Takvim" value={String(nearCalendar.length)} hint="14 gun icindeki kayitlar" />
        <StatCard title="Bildirim" value={String(companyNotifications.length)} hint="Okunmamis kurum bildirimleri" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Akis Durumu">
            <div style={{ display: "grid", gap: 12 }}>
              {stages.map((stage, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{stage.title}</div>
                    <span style={badge(stage.status)}>{stage.status}</span>
                  </div>

                  <div style={{ marginBottom: 8, opacity: 0.85 }}>{stage.summary}</div>

                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                    {stage.details.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Siradaki En Dogru Adimlar">
            {nextActions.length === 0 ? (
              <div style={{ opacity: 0.75 }}>
                Bu kurum icin belirgin acil is adimi gorunmuyor. Sistem dengeli gorunuyor.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {nextActions.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fafafa",
                      fontWeight: 600,
                    }}
                  >
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Kurum Ozeti">
            <div style={{ display: "grid", gap: 8, lineHeight: 1.8 }}>
              <div><strong>Kurum:</strong> {company.name}</div>
              <div><strong>Faaliyet:</strong> {company.sector}</div>
              <div><strong>Tehlike Sinifi:</strong> {company.hazardClass}</div>
              <div><strong>Calisan:</strong> {company.employeeCount}</div>
              <div><strong>Son Ziyaret:</strong> {company.lastVisit}</div>
              <div><strong>Risk Seviyesi:</strong> {company.riskLevel}</div>
              <div><strong>Dokuman Durumu:</strong> {company.documentStatus}</div>
            </div>
          </SectionCard>

          <SectionCard title="Yonlendirme">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #eee", background: "#fafafa", fontWeight: 700 }}>
                Bu kurum icin en kritik alan: {criticalActions.length > 0 ? "DOF / Aksiyon" : revisionDocs.length > 0 ? "Dokuman Revizyonu" : companyNotifications.length > 0 ? "Bildirimler" : "Genel Takip"}
              </div>
              <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #eee", background: "#fafafa", fontWeight: 700 }}>
                Sonraki kontrol ekseni: {upcomingDrills.length > 0 || upcomingTrainings.length > 0 ? "Acil Durum ve Egitim" : nearCalendar.length > 0 ? "Takvim" : "Periyodik Izleme"}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}