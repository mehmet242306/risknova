"use client";

import { useMemo, useState } from "react";
import { companies } from "@/lib/mock-data";
import { initialActions } from "@/lib/action-data";
import { managedDocuments } from "@/lib/document-data";
import { emergencyPlans, emergencyTrainings, drillRecords } from "@/lib/emergency-data";
import { calendarEvents } from "@/lib/calendar-data";
import { seededNotifications, type SystemNotification } from "@/lib/notification-data";

type UnifiedNotification = {
  id: string;
  companyId: number;
  title: string;
  source: string;
  level: "Bilgi" | "Yuksek" | "Kritik";
  createdAt: string;
  message: string;
  read: boolean;
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
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{hint}</div>
    </div>
  );
}

function getCompanyName(companyId: number) {
  return companies.find((company) => company.id === companyId)?.name ?? "Bilinmeyen Kurum";
}

function levelPill(level: string): React.CSSProperties {
  const bg =
    level === "Kritik"
      ? "#ffe9e9"
      : level === "Yuksek"
      ? "#fff9ef"
      : "#f5fff7";

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

function isNear(dateStr: string, days: number) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - today.getTime();
  const diffDays = diff / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

export default function NotificationsPage() {
  const [manualNotifications, setManualNotifications] = useState<SystemNotification[]>(seededNotifications);
  const [companyFilter, setCompanyFilter] = useState<number | "all">("all");
  const [levelFilter, setLevelFilter] = useState<"all" | "Bilgi" | "Yuksek" | "Kritik">("all");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");

  const mergedNotifications = useMemo(() => {
    const actionNotifications: UnifiedNotification[] = initialActions
      .filter((item) => item.status !== "Tamamlandi")
      .map((item) => ({
        id: `action-${item.id}`,
        companyId: item.companyId,
        title: item.title,
        source: "DOF",
        level: item.priority === "Kritik" ? "Kritik" : item.priority === "Yuksek" ? "Yuksek" : "Bilgi",
        createdAt: item.createdAt,
        message: `Termin tarihi ${item.dueDate}. Sorumlu: ${item.responsible}.`,
        read: false,
      }));

    const documentNotifications: UnifiedNotification[] = managedDocuments
      .filter((item) => item.status === "Revizyon Gerekli" || item.status === "Onay Bekliyor" || isNear(item.nextReviewDate, 30))
      .map((item) => ({
        id: `doc-${item.id}`,
        companyId: item.companyId,
        title: item.title,
        source: "Dokuman",
        level: item.status === "Revizyon Gerekli" ? "Yuksek" : "Bilgi",
        createdAt: item.lastUpdated,
        message: `Belge durumu: ${item.status}. Sonraki gozden gecirme: ${item.nextReviewDate}.`,
        read: false,
      }));

    const emergencyNotifications: UnifiedNotification[] = emergencyPlans
      .filter((item) => isNear(item.nextReviewDate, 60))
      .map((item) => ({
        id: `emergency-${item.companyId}`,
        companyId: item.companyId,
        title: "Acil durum plani gozden gecirme uyarisi",
        source: "Acil Durum",
        level: "Kritik",
        createdAt: item.preparedDate,
        message: `Plan versiyonu ${item.version}. Gozden gecirme tarihi ${item.nextReviewDate}.`,
        read: false,
      }));

    const trainingNotifications: UnifiedNotification[] = emergencyTrainings
      .filter((item) => isNear(item.renewalDate, 45))
      .map((item) => ({
        id: `training-${item.id}`,
        companyId: item.companyId,
        title: item.title,
        source: "Egitim",
        level: "Yuksek",
        createdAt: item.date,
        message: `Egitim yenileme tarihi ${item.renewalDate}. Hedef grup: ${item.targetGroup}.`,
        read: false,
      }));

    const drillNotifications: UnifiedNotification[] = drillRecords
      .filter((item) => isNear(item.nextDrillDate, 60))
      .map((item) => ({
        id: `drill-${item.id}`,
        companyId: item.companyId,
        title: item.type,
        source: "Tatbikat",
        level: "Yuksek",
        createdAt: item.date,
        message: `Sonraki tatbikat tarihi ${item.nextDrillDate}.`,
        read: false,
      }));

    const calendarNotifications: UnifiedNotification[] = calendarEvents
      .filter((item) => isNear(item.date, 7))
      .map((item) => ({
        id: `calendar-${item.id}`,
        companyId: item.companyId,
        title: item.title,
        source: "Takvim",
        level: "Bilgi",
        createdAt: item.date,
        message: item.note,
        read: false,
      }));

    const seeded: UnifiedNotification[] = manualNotifications.map((item) => ({
      id: `seeded-${item.id}`,
      companyId: item.companyId,
      title: item.title,
      source: item.source,
      level: item.level,
      createdAt: item.createdAt,
      message: item.message,
      read: item.read,
    }));

    return [
      ...seeded,
      ...actionNotifications,
      ...documentNotifications,
      ...emergencyNotifications,
      ...trainingNotifications,
      ...drillNotifications,
      ...calendarNotifications,
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [manualNotifications]);

  const filteredNotifications = mergedNotifications.filter((item) => {
    const companyMatch = companyFilter === "all" ? true : item.companyId === companyFilter;
    const levelMatch = levelFilter === "all" ? true : item.level === levelFilter;
    const readMatch =
      readFilter === "all"
        ? true
        : readFilter === "read"
        ? item.read
        : !item.read;

    return companyMatch && levelMatch && readMatch;
  });

  const totalCount = mergedNotifications.length;
  const criticalCount = mergedNotifications.filter((item) => item.level === "Kritik").length;
  const unreadCount = mergedNotifications.filter((item) => !item.read).length;
  const highCount = mergedNotifications.filter((item) => item.level === "Yuksek").length;

  function markAllSeededAsRead() {
    setManualNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Bildirim Merkezi</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu ekran; DOF, dokuman, acil durum, egitim, tatbikat ve takvim kaynakli
          tum kritik sinyalleri tek merkezde toplar.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <StatCard title="Toplam Bildirim" value={String(totalCount)} hint="Tum kaynaklardan gelen kayitlar" />
        <StatCard title="Okunmamis" value={String(unreadCount)} hint="Henuz ele alinmamis bildirimler" />
        <StatCard title="Kritik" value={String(criticalCount)} hint="Acil oncelikli bildirimler" />
        <StatCard title="Yuksek" value={String(highCount)} hint="Yakin takip gerektiren bildirimler" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Filtreler">
            <div style={{ display: "grid", gap: 12 }}>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                <option value="all">Tum kurumlar</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as "all" | "Bilgi" | "Yuksek" | "Kritik")}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                <option value="all">Tum seviyeler</option>
                <option value="Bilgi">Bilgi</option>
                <option value="Yuksek">Yuksek</option>
                <option value="Kritik">Kritik</option>
              </select>

              <select
                value={readFilter}
                onChange={(e) => setReadFilter(e.target.value as "all" | "read" | "unread")}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              >
                <option value="all">Tum durumlar</option>
                <option value="unread">Okunmamis</option>
                <option value="read">Okunmus</option>
              </select>

              <button
                onClick={markAllSeededAsRead}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Manuel Bildirimleri Okundu Yap
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Bildirim Mantigi">
            <div style={{ display: "grid", gap: 10, lineHeight: 1.8 }}>
              <div>- Kritik bildirimler once gorulur</div>
              <div>- DOF terminleri ve plan revizyonlari otomatik yukseltilir</div>
              <div>- Egitim ve tatbikat yaklasmalari takip edilir</div>
              <div>- Takvim kayitlari bilgi seviyesinde akar</div>
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Birlesik Bildirim Akisi">
            <div style={{ display: "grid", gap: 12 }}>
              {filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 14,
                    padding: 14,
                    background: item.read ? "#fafafa" : "#fff",
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
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={levelPill(item.level)}>{item.level}</span>
                      <span style={levelPill(item.read ? "Bilgi" : "Yuksek")}>
                        {item.read ? "Okundu" : "Yeni"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    <div><strong>Kurum:</strong> {getCompanyName(item.companyId)}</div>
                    <div><strong>Kaynak:</strong> {item.source}</div>
                    <div><strong>Tarih:</strong> {item.createdAt}</div>
                    <div><strong>Mesaj:</strong> {item.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}