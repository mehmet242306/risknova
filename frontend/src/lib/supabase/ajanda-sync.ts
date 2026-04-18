/**
 * Ajanda sync helper — tarih-bazlı entity'leri `isg_tasks` tablosuna
 * otomatik aktarır, böylece platformun neresinde deadline/tarih girilirse
 * girilsin kullanıcı `/planner` takviminde görür.
 *
 * Kullanım örnekleri:
 *   - İş kazası → SGK bildirim deadline (3 iş günü)
 *   - DÖF deadline
 *   - Sertifika expiry (valid_until)
 *   - Eğitim tarihi
 *   - Periyodik kontrol next date
 *   - Risk analizi review date
 */

import { createClient } from "@/lib/supabase/client";
import { resolveOrganizationId } from "@/lib/supabase/incident-api";
import { createNotification, type NotificationLevel } from "@/lib/supabase/notification-api";

/** isg_task_categories tablosundaki sabit UUID'ler (canlı DB'ye göre) */
export const AJANDA_CATEGORY_IDS = {
  EGITIM:              "9b722ae5-0a72-48c8-9d1f-836e1a114b8a",
  ISG_KURUL:           "7e4dda4c-d0c0-4e61-adce-eba783e43085",
  PERIYODIK_KONTROL:   "5656072d-c601-453d-a3c6-fa40e5a624e6",
  SAGLIK_TAKIBI:       "9c5a3e9f-bf73-4896-a915-990f1c7736ac",
  SAHA_ZIYARETI:       "a5dcb23e-6b1d-4485-a007-4dee431e7074",
  TOPLANTI_TATBIKAT:   "c1ae2428-31e3-4911-bc48-ffb74d18cc34",
  YASAL_YUKUMLULUK:    "4a3456ed-dca5-4144-a5d9-ce38346abbaf",
  DIGER:               "9b34058c-2b07-4702-89ff-dc1e171b30ed",
} as const;

export type AjandaCategoryKey = keyof typeof AJANDA_CATEGORY_IDS;

export interface AjandaTaskInput {
  title: string;
  description?: string | null;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string | null;
  category: AjandaCategoryKey;
  companyWorkspaceId?: string | null;
  location?: string | null;
  reminderDays?: number;
  /** Aynı ref_type + ref_id ile kayıt varsa upsert yapar — duplike önler */
  refType?: string;
  refId?: string;
}

/**
 * Ajanda'ya (isg_tasks) tarih-bazlı bir kayıt ekler.
 * Aynı refType+refId kombinasyonu varsa günceller.
 */
export async function syncToAjanda(input: AjandaTaskInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  if (!supabase) return { ok: false, error: "Supabase bağlantısı kurulamadı" };

  const auth = await resolveOrganizationId();
  if (!auth) return { ok: false, error: "Organizasyon bilgisi bulunamadı" };

  const payload = {
    organization_id: auth.orgId,
    title: input.title,
    description: input.description ?? null,
    category_id: AJANDA_CATEGORY_IDS[input.category],
    company_workspace_id: input.companyWorkspaceId ?? null,
    start_date: input.startDate,
    end_date: input.endDate ?? input.startDate,
    recurrence: "none",
    status: "planned",
    location: input.location ?? null,
    reminder_days: input.reminderDays ?? 7,
    include_in_timesheet: false,
  };

  try {
    // Aynı ref için mevcut kayıt var mı kontrol et
    if (input.refType && input.refId) {
      const { data: existing } = await supabase
        .from("isg_tasks")
        .select("id")
        .eq("organization_id", auth.orgId)
        .contains("metadata", { ref_type: input.refType, ref_id: input.refId })
        .maybeSingle();

      if (existing?.id) {
        // Güncelle
        const { error } = await supabase
          .from("isg_tasks")
          .update({ ...payload, metadata: { ref_type: input.refType, ref_id: input.refId } })
          .eq("id", existing.id);
        if (error) throw error;
        return { ok: true };
      }
    }

    // Yeni kayıt
    const insertPayload: Record<string, unknown> = { ...payload };
    if (input.refType && input.refId) {
      insertPayload.metadata = { ref_type: input.refType, ref_id: input.refId };
    }
    const { error } = await supabase.from("isg_tasks").insert(insertPayload);
    if (error) {
      // metadata kolon yoksa, metadata'sız tekrar dene
      if (String(error.message).includes("metadata")) {
        const retry = { ...payload };
        const { error: e2 } = await supabase.from("isg_tasks").insert(retry);
        if (e2) throw e2;
      } else {
        throw error;
      }
    }

    // ── Alarm/Bildirim: Ajanda'ya yeni görev eklenince bildirim oluştur  ──
    // Kullanıcı Bell icon'da hemen görür. Ayrıca yaklaşan tarih için
    // level belirlenir (bugün: critical, ≤3 gün: warning, diğer: info).
    try {
      const daysUntil = Math.ceil(
        (new Date(input.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      const level: NotificationLevel =
        daysUntil <= 0 ? "critical" : daysUntil <= (input.reminderDays ?? 7) ? "warning" : "info";
      const deadlineText = daysUntil <= 0
        ? "BUGÜN"
        : daysUntil === 1
          ? "YARIN"
          : `${daysUntil} gün sonra (${input.startDate})`;
      await createNotification({
        title: `🔔 Ajandaya yeni görev: ${input.title}`,
        message: `${deadlineText} son tarih. ${input.description ? input.description.slice(0, 150) : ""}`.trim(),
        type: "task",
        level,
        link: "/planner",
      });
    } catch (notifErr) {
      // Bildirim başarısız olsa bile görev eklendi — sorun değil
      console.warn("syncToAjanda notification:", notifErr);
    }

    return { ok: true };
  } catch (e) {
    console.warn("syncToAjanda:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}

/* ------------------------------------------------------------------ */
/*  Convenience functions — her entity türü için kısayol              */
/* ------------------------------------------------------------------ */

/** DÖF deadline'ını ajandaya ekler (Yasal Yükümlülük kategorisinde) */
export async function syncDofDeadline(dof: {
  id: string;
  deadline?: string | null;
  rootCause?: string | null;
  incidentCode?: string | null;
  companyWorkspaceId?: string | null;
  assignedTo?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!dof.deadline) return { ok: false, error: "DÖF deadline boş" };
  return syncToAjanda({
    title: `DÖF Kapanma Tarihi${dof.incidentCode ? ` — ${dof.incidentCode}` : ""}`,
    description: [
      dof.rootCause && `Kök neden: ${dof.rootCause}`,
      dof.assignedTo && `Sorumlu: ${dof.assignedTo}`,
      "Düzeltici/Önleyici Faaliyet son tamamlanma tarihi.",
    ].filter(Boolean).join("\n"),
    startDate: dof.deadline,
    category: "YASAL_YUKUMLULUK",
    companyWorkspaceId: dof.companyWorkspaceId,
    reminderDays: 3,
    refType: "dof",
    refId: dof.id,
  });
}

/** Sertifika geçerlilik son tarihini ajandaya ekler */
export async function syncCertificateExpiry(cert: {
  id: string;
  validUntil?: string | null;
  title: string;
  holderName?: string | null;
  companyWorkspaceId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!cert.validUntil) return { ok: false, error: "Geçerlilik tarihi boş" };
  return syncToAjanda({
    title: `Sertifika Yenileme — ${cert.title}`,
    description: [
      cert.holderName && `Sahibi: ${cert.holderName}`,
      `Son geçerlilik: ${cert.validUntil}`,
      "Sertifikayı bu tarihten önce yenileyin.",
    ].filter(Boolean).join("\n"),
    startDate: cert.validUntil,
    category: "EGITIM",
    companyWorkspaceId: cert.companyWorkspaceId,
    reminderDays: 30, // 1 ay önceden hatırlat
    refType: "certificate",
    refId: cert.id,
  });
}

/** Risk analizi yenileme tarihini ajandaya ekler */
export async function syncRiskAssessmentReview(ra: {
  id: string;
  nextReviewAt?: string | null;
  title: string;
  companyWorkspaceId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!ra.nextReviewAt) return { ok: false, error: "Yenileme tarihi boş" };
  return syncToAjanda({
    title: `Risk Analizi Yenileme — ${ra.title}`,
    description: "6331 sayılı Kanun gereği periyodik risk değerlendirme güncellemesi.",
    startDate: ra.nextReviewAt,
    category: "YASAL_YUKUMLULUK",
    companyWorkspaceId: ra.companyWorkspaceId,
    reminderDays: 14,
    refType: "risk_assessment",
    refId: ra.id,
  });
}

/* ------------------------------------------------------------------ */
/*  Yaklaşan görev tarayıcısı — her gün için "daily reminder"           */
/* ------------------------------------------------------------------ */

/**
 * Kullanıcının önümüzdeki 7 gün içindeki ajanda görevlerini tarar ve
 * her biri için bildirim üretir (duplike önlemek için localStorage kullanır).
 *
 * Dashboard veya Planner sayfası açıldığında çağırılabilir.
 * Günde bir kez çalışır (aynı gün tekrar çağrılırsa yeni bildirim oluşmaz).
 */
export async function scanUpcomingAjandaTasks(options?: {
  daysAhead?: number;
  force?: boolean;
}): Promise<{ checked: number; notified: number }> {
  if (typeof window === "undefined") return { checked: 0, notified: 0 };

  const daysAhead = options?.daysAhead ?? 7;
  const today = new Date().toISOString().slice(0, 10);
  const storageKey = "ajanda_reminder_last_scan";

  // Günde bir kez çalış — aynı gün tekrar çağrılırsa skip
  if (!options?.force) {
    const lastScan = localStorage.getItem(storageKey);
    if (lastScan === today) return { checked: 0, notified: 0 };
  }

  const supabase = createClient();
  if (!supabase) return { checked: 0, notified: 0 };
  const auth = await resolveOrganizationId();
  if (!auth) return { checked: 0, notified: 0 };

  // Bugün + daysAhead arasındaki görevler
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);
  const endDateStr = endDate.toISOString().slice(0, 10);

  const { data: tasks, error } = await supabase
    .from("isg_tasks")
    .select("id,title,start_date,description,status,reminder_days")
    .eq("organization_id", auth.orgId)
    .gte("start_date", today)
    .lte("start_date", endDateStr)
    .neq("status", "completed")
    .neq("status", "cancelled");

  if (error || !tasks) {
    console.warn("scanUpcomingAjandaTasks:", error);
    return { checked: 0, notified: 0 };
  }

  // Her görev için hatırlatma mantığı
  let notified = 0;
  for (const task of tasks) {
    const daysUntil = Math.ceil(
      (new Date(task.start_date as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const reminderDays = (task.reminder_days as number) ?? 7;
    // Sadece reminderDays eşiğine girenler için bildirim
    if (daysUntil > reminderDays) continue;

    const level: NotificationLevel =
      daysUntil <= 0 ? "critical" : daysUntil <= 1 ? "warning" : "info";

    const deadlineText = daysUntil <= 0
      ? "BUGÜN son gün"
      : daysUntil === 1
        ? "YARIN son gün"
        : `${daysUntil} gün kaldı`;

    try {
      await createNotification({
        title: `⏰ ${task.title}`,
        message: `${deadlineText} — ${task.description ? String(task.description).slice(0, 120) : ""}`.trim(),
        type: "task",
        level,
        link: "/planner",
      });
      notified++;
    } catch (e) {
      console.warn("scanUpcomingAjandaTasks create:", e);
    }
  }

  localStorage.setItem(storageKey, today);
  return { checked: tasks.length, notified };
}

/** Sağlık muayenesi sonraki tarihini ajandaya ekler */
export async function syncHealthCheckNext(hc: {
  id: string;
  nextExamDate?: string | null;
  personName: string;
  companyWorkspaceId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!hc.nextExamDate) return { ok: false, error: "Muayene tarihi boş" };
  return syncToAjanda({
    title: `Sağlık Muayenesi — ${hc.personName}`,
    description: "Periyodik sağlık muayenesi.",
    startDate: hc.nextExamDate,
    category: "SAGLIK_TAKIBI",
    companyWorkspaceId: hc.companyWorkspaceId,
    reminderDays: 7,
    refType: "health_check",
    refId: hc.id,
  });
}
