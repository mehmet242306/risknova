import type { ComponentType } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  ClipboardList,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/security/server";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";

type SignupRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

type AdminUserRow = {
  user_id: string;
  role: string;
  status: string;
  created_at: string;
};

type HealthRow = {
  component_key: string;
  status: "healthy" | "degraded" | "down";
  checked_at: string;
};

type ActionCardProps = {
  title: string;
  description: string;
  href: string;
  cta: string;
  eyebrow: string;
  value: string;
  helper: string;
  icon: ComponentType<{ className?: string }>;
};

type PriorityItem = {
  title: string;
  description: string;
  href: string;
  cta: string;
  tone?: "default" | "amber" | "rose" | "emerald";
};

type PromptShortcut = {
  title: string;
  prompt: string;
  helper: string;
};

function isCompatDataError(message: string | null | undefined) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("column") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

async function safeCount(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
) {
  try {
    const { count, error } = await query;
    if (error) {
      if (isCompatDataError(error.message)) return 0;
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  try {
    const { data, error } = await query;
    if (error) {
      if (isCompatDataError(error.message)) return [];
      return [];
    }
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: HealthRow["status"]) {
  if (status === "down") return "kritik";
  if (status === "degraded") return "izleniyor";
  return "saglikli";
}

function statusClass(status: HealthRow["status"]) {
  if (status === "down") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200";
  }
  if (status === "degraded") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200";
}

function buildPromptHref(prompt: string) {
  return `/solution-center?surface=platform-admin&prompt=${encodeURIComponent(prompt)}`;
}

export default async function PlatformAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getAccountContextForUser(user.id);
  if (!context.isPlatformAdmin) {
    redirect(resolvePostLoginPath(context));
  }

  const service = createServiceClient();

  const [
    individualCount,
    osgbCount,
    enterpriseLeadCount,
    workspaceCount,
    riskAssessmentCount,
    riskDraftCount,
    riskCompletedCount,
    documentCount,
    documentPendingApprovalCount,
    documentReadyCount,
    openErrorCount,
    criticalErrorCount,
    criticalAlertCount,
    pendingQueueCount,
    recentSignups,
    adminUsers,
    healthChecks,
  ] = await Promise.all([
    safeCount(
      service
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .eq("account_type", "individual"),
    ),
    safeCount(
      service
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .eq("account_type", "osgb"),
    ),
    safeCount(
      service.from("enterprise_leads").select("id", { count: "exact", head: true }),
    ),
    safeCount(
      service
        .from("company_workspaces")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ),
    safeCount(
      service.from("risk_assessments").select("id", { count: "exact", head: true }),
    ),
    safeCount(
      service
        .from("risk_assessments")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
    ),
    safeCount(
      service
        .from("risk_assessments")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
    ),
    safeCount(
      service.from("editor_documents").select("id", { count: "exact", head: true }),
    ),
    safeCount(
      service
        .from("editor_documents")
        .select("id", { count: "exact", head: true })
        .eq("status", "onay_bekliyor"),
    ),
    safeCount(
      service
        .from("editor_documents")
        .select("id", { count: "exact", head: true })
        .eq("status", "hazir"),
    ),
    safeCount(
      service
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .is("resolved_at", null),
    ),
    safeCount(
      service
        .from("error_logs")
        .select("id", { count: "exact", head: true })
        .eq("level", "critical")
        .is("resolved_at", null),
    ),
    safeCount(
      service
        .from("admin_notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_resolved", false)
        .eq("level", "critical"),
    ),
    safeCount(
      service
        .from("task_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ),
    safeRows<SignupRow>(
      service
        .from("user_profiles")
        .select("id, full_name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
    ),
    safeRows<AdminUserRow>(
      service
        .from("platform_admins")
        .select("user_id, role, status, created_at")
        .order("created_at", { ascending: false }),
    ),
    safeRows<HealthRow>(
      service
        .from("health_checks")
        .select("component_key, status, checked_at")
        .order("checked_at", { ascending: false })
        .limit(8),
    ),
  ]);

  const actionCards: ActionCardProps[] = [
    {
      title: "Nova Platform",
      description:
        "Sitenin genel sagligini, acik aksakliklari, belge onay kuyrugunu ve operasyon risklerini Nova'dan raporlat.",
      href: "/settings?tab=admin_ai",
      cta: "Nova'yi ac",
      eyebrow: "Ic denetim AI",
      value: `${criticalAlertCount + criticalErrorCount}`,
      helper: "kritik sinyal",
      icon: Bot,
    },
    {
      title: "Risk analizi omurgasi",
      description:
        "Musteri icerigine dalmadan global risk boru hattini, taslak yogunlugunu ve tamamlanma temposunu izle.",
      href: "/settings?tab=audit_logs",
      cta: "Audit loglarini ac",
      eyebrow: "Risk izleme",
      value: `${riskAssessmentCount}`,
      helper: `${riskDraftCount} taslak / ${riskCompletedCount} tamamlanan`,
      icon: ClipboardList,
    },
    {
      title: "Dokuman ve yayin hatti",
      description:
        "Onay bekleyen, hazir ve yayin omurgasina giren kurumsal dokuman hareketlerini tek yerden kontrol et.",
      href: "/settings?tab=admin_documents",
      cta: "Belge merkezini ac",
      eyebrow: "Yayin akisi",
      value: `${documentCount}`,
      helper: `${documentPendingApprovalCount} onay bekliyor`,
      icon: FileText,
    },
    {
      title: "Hata ve olay takibi",
      description:
        "Sistemin aksayan noktalari, cozulmemis hatalar ve kuyruk birikmeleri icin teknik operasyon yuzeyine gec.",
      href: "/settings?tab=error_logs",
      cta: "Hata loglarini ac",
      eyebrow: "Platform sagligi",
      value: `${openErrorCount}`,
      helper: `${pendingQueueCount} bekleyen kuyruk`,
      icon: Activity,
    },
  ];

  const priorityItems: PriorityItem[] = [
    ...(criticalErrorCount > 0
      ? [
          {
            title: "Kritik hata birikimi",
            description:
              "Platformda halen cozulmemis kritik hata kayitlari var. Once hata akislarini ve etkilenen modulleri gozden gecir.",
            href: "/settings?tab=error_logs",
            cta: "Hata loglarini ac",
            tone: "rose" as const,
          },
        ]
      : []),
    ...(criticalAlertCount > 0
      ? [
          {
            title: "Kritik alarm akisi",
            description:
              "Admin bildirimlerinde kritik seviye sinyaller var. Alarm kaynaklarini ayiklayip operasyon onceligini netlestir.",
            href: "/settings?tab=admin_dashboard",
            cta: "Admin dashboard'a gec",
            tone: "rose" as const,
          },
        ]
      : []),
    ...(documentPendingApprovalCount > 0
      ? [
          {
            title: "Belge onay kuyrugu",
            description:
              "Onay bekleyen belge kayitlari birikiyor. Yayin hattinin yavasladigi modulleri kontrol et.",
            href: "/settings?tab=admin_documents",
            cta: "Belge merkezini ac",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(riskDraftCount > 0
      ? [
          {
            title: "Taslak risk analizi yogunlugu",
            description:
              "Tamamlanmayan risk analizleri platform hareketini yavaslatabilir. Taslak yogunlugunu modullere gore incele.",
            href: "/risk-analysis",
            cta: "Risk analizine git",
            tone: "amber" as const,
          },
        ]
      : []),
    ...(pendingQueueCount > 0
      ? [
          {
            title: "Bekleyen kuyruk islemleri",
            description:
              "Arka plandaki gorev kuyrugunda bekleyen kayitlar var. Isleyen task hatlarini ve retry ihtiyaclarini kontrol et.",
            href: "/settings?tab=self_healing",
            cta: "Self-healing paneli",
            tone: "amber" as const,
          },
        ]
      : []),
  ];

  const promptShortcuts: PromptShortcut[] = [
    {
      title: "Hata trendini ozetle",
      prompt:
        "Son 24 saatte en cok hata veren akislar hangileri? Modullere gore kisa bir operasyon ozeti cikar.",
      helper: "Error loglari, alarmlar ve kuyruk birikmesi icin yonetici ozeti.",
    },
    {
      title: "Belge onay risklerini ayikla",
      prompt:
        "Onay bekleyen belge yogunlugu hangi modullerde birikiyor? Oncelik sirasiyla raporla.",
      helper: "Belge ve yayin hattindaki darbohazlari bulur.",
    },
    {
      title: "Risk hattini degerlendir",
      prompt:
        "Taslakta kalan risk analizleri sistemde nasil bir tablo ciziyor? Operasyonel etkisini ozetle.",
      helper: "Risk taslak yogunlugunu platform etkisiyle birlikte okur.",
    },
    {
      title: "Mudahale sirasi cikar",
      prompt:
        "Kritik alarm, hata ve kuyruk sinyallerinden hangisi once ele alinmali? Bana net bir mudahale sirasi ver.",
      helper: "Nova Platform dogrudan yapilacaklar listesini siralar.",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Platform operasyon merkezi
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              Bu ekranda neyi yonetirsin?
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Bu panel musteri dashboard'u degil; global ic operasyon, kalite, Nova,
              hata takibi, belge omurgasi ve platform sagligini yonettigin merkezdir.
              Burada tenant iceriklerini tek tek duzenlemekten cok sistemin butununu
              izler, aksakliklari yakalar ve ilgili operasyon yuzeylerine gecersin.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={buildPromptHref(
                "Bugun platform genelinde en riskli alanlar neler? Bana kisa bir ic operasyon raporu ver.",
              )}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition hover:opacity-95"
            >
              Nova Platform
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/settings?tab=error_logs"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Hata loglari
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/settings?tab=admin_documents"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Belgeler
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Bireysel hesap" value={individualCount} />
        <MetricCard title="OSGB hesap" value={osgbCount} />
        <MetricCard title="Enterprise talep" value={enterpriseLeadCount} />
        <MetricCard title="Aktif workspace" value={workspaceCount} />
      </div>

      <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {actionCards.map((card) => (
          <ActionCard key={card.title} {...card} />
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Islem merkezi</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Burasi platform admin olarak dogrudan nereye bakman gerektigini
              soyler. Sayaclara bakip karar vermek yerine ilgili akis merkezine
              tek tikla gecersin.
            </p>
          </div>
          <AlertTriangle className="h-5 w-5 text-primary" />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {priorityItems.length === 0 ? (
            <div className="lg:col-span-2">
              <EmptyState text="Su anda kritik mudahale gerektiren birikim gorunmuyor." />
            </div>
          ) : (
            priorityItems.map((item) => <PriorityCard key={item.title} {...item} />)
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Risk analizi omurgasi
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Platform admin olarak burada musteri icerigini degil, global risk
                boru hattinin sagligini izlersin. Taslak birikimi, tamamlanma orani
                ve platformdaki genel hareket hacmi senin erken uyarindir.
              </p>
            </div>
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InlineStat title="Toplam analiz" value={riskAssessmentCount} />
            <InlineStat title="Taslakta kalan" value={riskDraftCount} tone="amber" />
            <InlineStat title="Tamamlanan" value={riskCompletedCount} tone="emerald" />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/settings?tab=audit_logs"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Audit loglarini ac
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/settings?tab=error_logs"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Hata etkisini incele
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Dokuman ve yayin hatti
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Onay bekleyen belgeler, hazir durumdaki kayitlar ve arka plandaki
                yayin omurgasi bu panelden takip edilir. Gerektiginde dogrudan
                kurumsal belge merkezine gecersin.
              </p>
            </div>
            <FileText className="h-5 w-5 text-primary" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InlineStat title="Toplam belge" value={documentCount} />
            <InlineStat
              title="Onay bekleyen"
              value={documentPendingApprovalCount}
              tone="amber"
            />
            <InlineStat title="Hazir" value={documentReadyCount} tone="emerald" />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/settings?tab=admin_documents"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Belge merkezini ac
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/settings?tab=deleted_records"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Silinmis kayitlari ac
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Platform sagligi
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Kritik hata, acik alarm ve kuyruk birikmesi burada gorunur. Bunlar
                musteri iceriginden bagimsiz olarak sitenin genel isleyisini denetlemeni saglar.
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InlineStat title="Acik hata" value={openErrorCount} tone="amber" />
            <InlineStat title="Kritik hata" value={criticalErrorCount} tone="rose" />
            <InlineStat title="Kritik alarm" value={criticalAlertCount} tone="rose" />
            <InlineStat title="Bekleyen kuyruk" value={pendingQueueCount} tone="amber" />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/settings?tab=error_logs"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Olay kayitlarini ac
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/settings?tab=self_healing"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Self-healing paneli
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Nova Platform sana ne raporlar?
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Nova bu yuzeyde OSGB veya bireysel veri ureticisi gibi degil, ic operasyon analisti gibi davranmali.
              </p>
            </div>
            <Bot className="h-5 w-5 text-primary" />
          </div>

          <div className="mt-4 grid gap-3">
            {promptShortcuts.map((item) => (
              <PromptShortcutCard key={item.title} {...item} />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={buildPromptHref(
                "Bugun platform genelinde eksik, aksaklik ve hata kaynagi olan basliklari bana ozetle.",
              )}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-95"
            >
              Nova Platform'u ac
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/settings?tab=admin_dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/35 hover:text-primary"
            >
              Admin dashboard'a gec
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Son kayitlar</h2>
          <div className="mt-4 space-y-3">
            {recentSignups.length === 0 ? (
              <EmptyState text="Yeni kullanici kaydi bulunmuyor." />
            ) : (
              recentSignups.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-2xl border border-border bg-background/70 px-4 py-3"
                >
                  <p className="font-medium text-foreground">
                    {profile.full_name || profile.email || "Yeni kullanici"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profile.email || "-"} | {formatDateTime(profile.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">
            Platform admin kullanicilari
          </h2>
          <div className="mt-4 space-y-3">
            {adminUsers.length === 0 ? (
              <EmptyState text="Aktif platform admin kaydi bulunmuyor." />
            ) : (
              adminUsers.map((admin) => (
                <div
                  key={admin.user_id}
                  className="rounded-2xl border border-border bg-background/70 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium capitalize text-foreground">
                      {admin.role.replaceAll("_", " ")}
                    </p>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                      {admin.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {admin.user_id} | {formatDateTime(admin.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Son saglik kontrolleri
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Health check verisi varsa burada guncel platform bilesenlerinin durumunu
              gorursun. Bu alan bozulsa bile sayfa fail-closed kalir.
            </p>
          </div>
          <Users className="h-5 w-5 text-primary" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {healthChecks.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-4">
              <EmptyState text="Health check verisi bulunmuyor." />
            </div>
          ) : (
            healthChecks.map((row) => (
              <div
                key={`${row.component_key}-${row.checked_at}`}
                className="rounded-2xl border border-border bg-background/70 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {row.component_key}
                  </p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(row.checked_at)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InlineStat({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: number;
  tone?: "default" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-300"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-300"
        : tone === "rose"
          ? "text-rose-600 dark:text-rose-300"
          : "text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <p className={`mt-3 text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  cta,
  eyebrow,
  value,
  helper,
  icon: Icon,
}: ActionCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/35 hover:text-primary"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function toneClasses(tone: PriorityItem["tone"] = "default") {
  if (tone === "rose") {
    return "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20";
  }
  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20";
  }
  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20";
  }
  return "border-border bg-background";
}

function PriorityCard({ title, description, href, cta, tone = "default" }: PriorityItem) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses(tone)}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{description}</p>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary"
        >
          {cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function PromptShortcutCard({ title, prompt, helper }: PromptShortcut) {
  return (
    <Link
      href={buildPromptHref(prompt)}
      className="rounded-xl border border-border bg-background px-4 py-3 transition hover:border-primary/35 hover:bg-primary/5"
    >
      <div className="flex items-start justify-between gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{helper}</p>
        </div>
        <ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
      </div>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

