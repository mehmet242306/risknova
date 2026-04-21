import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/security/server";
import {
  getAccountContextForUser,
  resolvePostLoginPath,
} from "@/lib/account/account-routing";

function isCompatError(message: string | undefined | null) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("relation") ||
    normalized.includes("schema cache") ||
    normalized.includes("does not exist")
  );
}

export default async function OsgbDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getAccountContextForUser(user.id);
  if (context.isPlatformAdmin) {
    redirect("/platform-admin");
  }
  if (context.accountType !== "osgb" || !context.organizationId) {
    redirect(resolvePostLoginPath(context));
  }

  const service = createServiceClient();

  const [
    { data: firmsCount, error: firmsCountError },
    { data: staffCount, error: staffCountError },
    { count: openTaskCount, error: openTaskError },
    { count: overdueTaskCount, error: overdueTaskError },
    { data: recentRisks, error: recentRisksError },
    { data: recentActivity, error: recentActivityError },
    { data: usageRows, error: usageError },
  ] = await Promise.all([
    service.rpc("active_company_workspace_count", {
      p_organization_id: context.organizationId,
    }),
    service.rpc("active_account_staff_count", {
      p_organization_id: context.organizationId,
    }),
    service
      .from("workspace_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .eq("status", "open"),
    service
      .from("workspace_tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .lt("due_date", new Date().toISOString().slice(0, 10))
      .in("status", ["open", "in_progress"]),
    service
      .from("risk_assessments")
      .select("id, title, created_at, company_workspace_id")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false })
      .limit(5),
    service
      .from("workspace_activity_logs")
      .select("id, event_type, created_at, event_payload")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
    service.rpc("current_plan_limits", {
      p_organization_id: context.organizationId,
    }),
  ]);

  const blockingError = [
    firmsCountError,
    staffCountError,
    openTaskError,
    overdueTaskError,
    recentRisksError,
    recentActivityError,
    usageError,
  ].find((error) => error && !isCompatError(error.message));

  if (blockingError) {
    throw new Error(blockingError.message);
  }

  const usage = Array.isArray(usageRows) ? usageRows[0] ?? null : usageRows;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          OSGB Yonetim Merkezi
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          {context.organizationName || "OSGB hesabi"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Firma portfoyu, gorevlendirilmis personeller, sozlesmeler, dokuman
          akislari ve operasyonel performans ayni merkezde yonetilir.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Aktif firma"
          value={`${firmsCount ?? 0}${usage?.max_active_workspaces ? ` / ${usage.max_active_workspaces}` : ""}`}
        />
        <MetricCard
          title="Aktif personel"
          value={`${staffCount ?? 0}${usage?.max_active_staff_seats ? ` / ${usage.max_active_staff_seats}` : ""}`}
        />
        <MetricCard title="Acik isler" value={`${openTaskCount ?? 0}`} />
        <MetricCard title="Geciken isler" value={`${overdueTaskCount ?? 0}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Yonetim kisayollari</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <QuickNav href="/osgb/firms" label="Firmalar" description="Musteri, isyeri ve calisma alani yonetimi" />
            <QuickNav href="/osgb/personnel" label="Personeller" description="Uzman, hekim ve DSP havuzu" />
            <QuickNav href="/osgb/assignments" label="Gorevlendirmeler" description="Firma bazli atama ve yetki matrisi" />
            <QuickNav href="/osgb/contracts" label="Sozlesmeler" description="Musteri ve personel kontratlari" />
            <QuickNav href="/osgb/documents" label="Dokuman Sistemi" description="PDF/A rapor, metadata ve arsiv" />
            <QuickNav href="/osgb/tasks" label="Is Takibi" description="SLA, DOF ve gecikme gorunumu" />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Nova OSGB Manager</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>Hangi personelin is yuku kritik seviyeye yaklasti?</p>
            <p>Hangi firmada atama veya belge boslugu var?</p>
            <p>Hangi gecikmeler sozlesme veya denetim riski olusturuyor?</p>
            <p>Nova bu yuzeyde profesyonel kullanicidan farkli olarak yoneticiye karar destegi verir.</p>
          </div>
          <div className="mt-5">
            <Link
              href="/solution-center?surface=osgb-manager"
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Nova OSGB Manager'i ac
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Son risk kayitlari</h2>
          <div className="mt-4 space-y-3">
            {(recentRisks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Henuz kayit bulunmuyor.</p>
            ) : (
              (recentRisks ?? []).map((risk) => (
                <div key={risk.id} className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                  <p className="font-medium text-foreground">{risk.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(risk.created_at).toLocaleString("tr-TR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-foreground">Son aktiviteler</h2>
          <div className="mt-4 space-y-3">
            {(recentActivity ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Henuz aktivite logu yok.</p>
            ) : (
              (recentActivity ?? []).map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                  <p className="font-medium text-foreground">{activity.event_type}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleString("tr-TR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function QuickNav({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-background/70 px-4 py-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
