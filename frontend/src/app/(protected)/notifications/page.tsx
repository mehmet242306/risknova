"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  listMyNotifications,
  markAllMyNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRow,
} from "@/lib/supabase/notification-api";

type LevelFilter = "all" | "info" | "warning" | "critical";
type ReadFilter = "all" | "read" | "unread";

function levelLabel(level: string) {
  if (level === "critical") return "Kritik";
  if (level === "warning") return "Yuksek";
  return "Bilgi";
}

function sourceLabel(type: string) {
  if (type === "risk_analysis") return "Risk Analizi";
  if (type === "incident") return "Olay";
  if (type === "dof") return "DOF";
  if (type === "task") return "Gorev";
  return "Sistem";
}

function levelBadge(level: string) {
  if (level === "critical") return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
  if (level === "warning") return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
  return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("tr-TR");
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");

  useEffect(() => {
    let mounted = true;

    void (async () => {
      setLoading(true);
      const rows = await listMyNotifications();
      if (mounted) {
        setNotifications(rows);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        const levelMatch = levelFilter === "all" ? true : item.level === levelFilter;
        const readMatch = readFilter === "all" ? true : readFilter === "read" ? item.is_read : !item.is_read;
        return levelMatch && readMatch;
      }),
    [levelFilter, notifications, readFilter],
  );

  const totalCount = notifications.length;
  const criticalCount = notifications.filter((item) => item.level === "critical").length;
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const highCount = notifications.filter((item) => item.level === "warning").length;

  async function handleMarkAllRead() {
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (unreadIds.length === 0) return;

    const ok = await markAllMyNotificationsAsRead(unreadIds);
    if (!ok) return;

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
  }

  async function handleMarkRead(id: string) {
    const ok = await markNotificationAsRead(id);
    if (!ok) return;

    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
  }

  const selectCls =
    "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none dark:bg-[var(--navy-mid)]";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bildirim Merkezi</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          Bu ekran yalnizca aktif kullanicinin kendi bildirimlerini gosterir.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Toplam Bildirim", value: totalCount, hint: "Size ait kayitlar", color: "text-foreground" },
          { title: "Okunmamis", value: unreadCount, hint: "Henuz ele alinmamis bildirimler", color: unreadCount > 0 ? "text-amber-500" : "text-foreground" },
          { title: "Kritik", value: criticalCount, hint: "Acil oncelikli bildirimler", color: criticalCount > 0 ? "text-red-500" : "text-foreground" },
          { title: "Yuksek", value: highCount, hint: "Yakin takip gerektirenler", color: highCount > 0 ? "text-orange-500" : "text-foreground" },
        ].map((s) => (
          <div key={s.title} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{s.title}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Filtreler</h3>
            <div className="space-y-3">
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as LevelFilter)} className={selectCls}>
                <option value="all">Tum seviyeler</option>
                <option value="info">Bilgi</option>
                <option value="warning">Yuksek</option>
                <option value="critical">Kritik</option>
              </select>
              <select value={readFilter} onChange={(e) => setReadFilter(e.target.value as ReadFilter)} className={selectCls}>
                <option value="all">Tum durumlar</option>
                <option value="unread">Okunmamis</option>
                <option value="read">Okunmus</option>
              </select>
              <button
                onClick={() => void handleMarkAllRead()}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
              >
                Tumunu Okundu Yap
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Bildirim Akisi ({filteredNotifications.length})</h3>
          {loading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Yukleniyor...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Size ait bildirim bulunamadi.
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const card = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                    <div className="flex shrink-0 gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${levelBadge(item.level)}`}>{levelLabel(item.level)}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          item.is_read
                            ? "border-border bg-secondary text-muted-foreground"
                            : "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {item.is_read ? "Okundu" : "Yeni"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                    <p><span className="font-semibold text-foreground">Kaynak:</span> {sourceLabel(item.type)}</p>
                    <p><span className="font-semibold text-foreground">Tarih:</span> {formatDate(item.created_at)}</p>
                    <p><span className="font-semibold text-foreground">Mesaj:</span> {item.message}</p>
                  </div>
                </>
              );

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    item.is_read
                      ? "border-border bg-card/50 opacity-70"
                      : item.level === "critical"
                      ? "border-red-300/30 bg-red-50/5 dark:border-red-800/30 dark:bg-red-950/10"
                      : item.level === "warning"
                      ? "border-amber-300/30 bg-amber-50/5 dark:border-amber-800/30 dark:bg-amber-950/10"
                      : "border-border bg-card"
                  }`}
                >
                  {item.link ? (
                    <Link href={item.link} onClick={() => void handleMarkRead(item.id)} className="block">
                      {card}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => void handleMarkRead(item.id)} className="block w-full text-left">
                      {card}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
