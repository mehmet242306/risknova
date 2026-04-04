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

function isNear(dateStr: string, days: number) {
  const today = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - today.getTime();
  const diffDays = diff / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

function getCompanyName(companyId: number) {
  return companies.find((company) => company.id === companyId)?.name ?? "Bilinmeyen Kurum";
}

function levelBadge(level: string) {
  if (level === "Kritik") return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
  if (level === "Yuksek") return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
  return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
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
        source: "DÖF",
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
        source: "Doküman",
        level: item.status === "Revizyon Gerekli" ? "Yuksek" : "Bilgi",
        createdAt: item.lastUpdated,
        message: `Belge durumu: ${item.status}. Sonraki gözden geçirme: ${item.nextReviewDate}.`,
        read: false,
      }));

    const emergencyNotifications: UnifiedNotification[] = emergencyPlans
      .filter((item) => isNear(item.nextReviewDate, 60))
      .map((item) => ({
        id: `emergency-${item.companyId}`,
        companyId: item.companyId,
        title: "Acil durum planı gözden geçirme uyarısı",
        source: "Acil Durum",
        level: "Kritik",
        createdAt: item.preparedDate,
        message: `Plan versiyonu ${item.version}. Gözden geçirme tarihi ${item.nextReviewDate}.`,
        read: false,
      }));

    const trainingNotifications: UnifiedNotification[] = emergencyTrainings
      .filter((item) => isNear(item.renewalDate, 45))
      .map((item) => ({
        id: `training-${item.id}`,
        companyId: item.companyId,
        title: item.title,
        source: "Eğitim",
        level: "Yuksek",
        createdAt: item.date,
        message: `Eğitim yenileme tarihi ${item.renewalDate}. Hedef grup: ${item.targetGroup}.`,
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
    const readMatch = readFilter === "all" ? true : readFilter === "read" ? item.read : !item.read;
    return companyMatch && levelMatch && readMatch;
  });

  const totalCount = mergedNotifications.length;
  const criticalCount = mergedNotifications.filter((item) => item.level === "Kritik").length;
  const unreadCount = mergedNotifications.filter((item) => !item.read).length;
  const highCount = mergedNotifications.filter((item) => item.level === "Yuksek").length;

  function markAllSeededAsRead() {
    setManualNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  const selectCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none dark:bg-[var(--navy-mid)]";

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bildirim Merkezi</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          DÖF, doküman, acil durum, eğitim, tatbikat ve takvim kaynaklı tüm kritik sinyalleri tek merkezde toplar.
        </p>
      </div>

      {/* İstatistikler */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Toplam Bildirim", value: totalCount, hint: "Tüm kaynaklardan gelen kayıtlar", color: "text-foreground" },
          { title: "Okunmamış", value: unreadCount, hint: "Henüz ele alınmamış bildirimler", color: unreadCount > 0 ? "text-amber-500" : "text-foreground" },
          { title: "Kritik", value: criticalCount, hint: "Acil öncelikli bildirimler", color: criticalCount > 0 ? "text-red-500" : "text-foreground" },
          { title: "Yüksek", value: highCount, hint: "Yakın takip gerektiren bildirimler", color: highCount > 0 ? "text-orange-500" : "text-foreground" },
        ].map((s) => (
          <div key={s.title} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{s.title}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Ana içerik: Filtreler + Akış */}
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Filtreler */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Filtreler</h3>
            <div className="space-y-3">
              <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value === "all" ? "all" : Number(e.target.value))} className={selectCls}>
                <option value="all">Tüm kurumlar</option>
                {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as "all" | "Bilgi" | "Yuksek" | "Kritik")} className={selectCls}>
                <option value="all">Tüm seviyeler</option>
                <option value="Bilgi">Bilgi</option>
                <option value="Yuksek">Yüksek</option>
                <option value="Kritik">Kritik</option>
              </select>
              <select value={readFilter} onChange={(e) => setReadFilter(e.target.value as "all" | "read" | "unread")} className={selectCls}>
                <option value="all">Tüm durumlar</option>
                <option value="unread">Okunmamış</option>
                <option value="read">Okunmuş</option>
              </select>
              <button onClick={markAllSeededAsRead} className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80">
                Tümünü Okundu Yap
              </button>
            </div>
          </div>
        </div>

        {/* Bildirim akışı */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Bildirim Akışı ({filteredNotifications.length})</h3>
          {filteredNotifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Filtreye uygun bildirim bulunamadı.
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-4 transition-colors ${
                  item.read
                    ? "border-border bg-card/50 opacity-70"
                    : item.level === "Kritik"
                    ? "border-red-300/30 bg-red-50/5 dark:border-red-800/30 dark:bg-red-950/10"
                    : item.level === "Yuksek"
                    ? "border-amber-300/30 bg-amber-50/5 dark:border-amber-800/30 dark:bg-amber-950/10"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                  <div className="flex shrink-0 gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${levelBadge(item.level)}`}>{item.level}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.read ? "border-border bg-secondary text-muted-foreground" : "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                      {item.read ? "Okundu" : "Yeni"}
                    </span>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <p><span className="font-semibold text-foreground">Kurum:</span> {getCompanyName(item.companyId)}</p>
                  <p><span className="font-semibold text-foreground">Kaynak:</span> {item.source}</p>
                  <p><span className="font-semibold text-foreground">Tarih:</span> {item.createdAt}</p>
                  <p><span className="font-semibold text-foreground">Mesaj:</span> {item.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
