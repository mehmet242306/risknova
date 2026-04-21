"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusAlert } from "@/components/ui/status-alert";

type CompanyOption = {
  workspaceId: string;
  displayName: string;
};

type PersonnelOption = {
  userId: string;
  label: string;
  professionalRole: string | null;
  workspaceIds: string[];
};

type TaskCompany = {
  workspaceId: string;
  displayName: string;
  workspaceHref: string;
} | null;

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  company: TaskCompany;
  assignees: string[];
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

type OsgbTasksBoardClientProps = {
  companies: CompanyOption[];
  selectedWorkspaceId?: string | null;
  tasks: TaskRow[];
  personnelOptions: PersonnelOption[];
};

const selectClassName =
  "h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground shadow-[var(--shadow-soft)] transition-colors transition-shadow hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]";

function priorityLabel(priority: string | null) {
  switch (priority) {
    case "critical":
      return "Kritik";
    case "high":
      return "Yuksek";
    case "low":
      return "Dusuk";
    case "medium":
      return "Normal";
    default:
      return "Normal";
  }
}

function statusLabel(status: string) {
  if (status === "in_progress") return "Islemde";
  if (status === "done") return "Tamamlandi";
  if (status === "cancelled") return "Iptal";
  return "Acik";
}

async function readJsonSafely(response: Response): Promise<ApiResponse> {
  const raw = await response.text();
  if (!raw.trim()) {
    return response.ok ? { ok: true } : { error: "Sunucudan bos yanit geldi." };
  }

  try {
    return JSON.parse(raw) as ApiResponse;
  } catch {
    return response.ok ? { ok: true } : { error: raw || "Sunucu yaniti okunamadi." };
  }
}

export function OsgbTasksBoardClient({
  companies,
  selectedWorkspaceId,
  tasks,
  personnelOptions,
}: OsgbTasksBoardClientProps) {
  const router = useRouter();
  const [companyWorkspaceId, setCompanyWorkspaceId] = useState(
    selectedWorkspaceId || companies[0]?.workspaceId || "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeUserIds, setAssigneeUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "warning" | "danger";
    text: string;
  } | null>(null);

  const availablePersonnel = useMemo(() => {
    if (!companyWorkspaceId) return [];
    return personnelOptions.filter((person) => person.workspaceIds.includes(companyWorkspaceId));
  }, [companyWorkspaceId, personnelOptions]);

  function toggleAssignee(userId: string) {
    setAssigneeUserIds((current) =>
      current.includes(userId)
        ? current.filter((value) => value !== userId)
        : [...current, userId],
    );
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyWorkspaceId) {
      setMessage({ tone: "danger", text: "Gorev olusturmak icin once firma sec." });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/osgb/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyWorkspaceId,
          title,
          description,
          priority,
          dueDate,
          assigneeUserIds,
        }),
      });

      const payload = await readJsonSafely(response);
      if (!response.ok || payload.ok === false) {
        setMessage({
          tone: "danger",
          text: payload.error || "Gorev olusturulamadi.",
        });
        return;
      }

      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setAssigneeUserIds([]);
      setMessage({
        tone: "success",
        text: payload.message || "Gorev olusturuldu.",
      });
      router.refresh();
    } catch {
      setMessage({
        tone: "danger",
        text: "Gorev olusturma sirasinda baglanti hatasi olustu.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusUpdate(
    taskId: string,
    status: "open" | "in_progress" | "done" | "cancelled",
  ) {
    setUpdatingTaskId(taskId);
    setMessage(null);

    try {
      const response = await fetch(`/api/osgb/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = await readJsonSafely(response);
      if (!response.ok || payload.ok === false) {
        setMessage({
          tone: "danger",
          text: payload.error || "Gorev durumu guncellenemedi.",
        });
        return;
      }

      setMessage({
        tone: "success",
        text: payload.message || "Gorev durumu guncellendi.",
      });
      router.refresh();
    } catch {
      setMessage({
        tone: "danger",
        text: "Gorev durumu guncellenirken baglanti hatasi olustu.",
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-foreground">Yeni gorev ac</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              OSGB yoneticisi bu ekrandan firma bazli yeni is acabilir, ilgili personeli goreve
              baglayabilir ve son tarihi ayni kayitta belirleyebilir.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <p className="font-semibold">Atama filtresi</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Yalnizca secilen firmaya aktif atanmis personel bu goreve secilebilir.
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleCreateTask}>
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="companyWorkspaceId">
                    Firma
                  </label>
                  <select
                    id="companyWorkspaceId"
                    value={companyWorkspaceId}
                    onChange={(event) => {
                      setCompanyWorkspaceId(event.target.value);
                      setAssigneeUserIds([]);
                    }}
                    className={selectClassName}
                    disabled={Boolean(selectedWorkspaceId)}
                  >
                    {companies.map((company) => (
                      <option key={company.workspaceId} value={company.workspaceId}>
                        {company.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="priority">
                    Oncelik
                  </label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as "low" | "medium" | "high" | "critical")
                    }
                    className={selectClassName}
                  >
                    <option value="low">Dusuk</option>
                    <option value="medium">Normal</option>
                    <option value="high">Yuksek</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>
              </div>

              <Input
                label="Gorev basligi"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ornek: Periyodik kontrol raporlarini tamamla"
                required
              />

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="description">
                  Aciklama
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Gorevin baglamini, beklenen kaniti ve onceligini kisaca yaz..."
                  className="min-h-28 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)] transition-colors transition-shadow hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]"
                />
              </div>

              <Input
                label="Son tarih"
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Atanacak personel</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Gorev bos da acilabilir; ancak personel secildiginde gecikme takibi ve performans
                izleme daha anlamli hale gelir.
              </p>

              {availablePersonnel.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-background/80 px-4 py-5 text-sm text-muted-foreground">
                  Bu firmaya aktif atanmis personel yok. Once gorevlendirme ac ya da gorevi firma
                  bazli ama atamasiz olarak kaydet.
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {availablePersonnel.map((person) => {
                    const selected = assigneeUserIds.includes(person.userId);
                    return (
                      <button
                        key={person.userId}
                        type="button"
                        onClick={() => toggleAssignee(person.userId)}
                        className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:border-primary/30 hover:bg-primary/5"
                        }`}
                      >
                        {person.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={submitting || !companyWorkspaceId || title.trim().length < 2}
                >
                  {submitting ? "Gorev aciliyor..." : "Gorev olustur"}
                </Button>
                <Link
                  href={
                    companyWorkspaceId
                      ? `/osgb/assignments?workspaceId=${companyWorkspaceId}`
                      : "/osgb/assignments"
                  }
                  className="inline-flex h-11 items-center rounded-2xl border border-border bg-card px-5 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-secondary"
                >
                  Gorevlendirmeleri ac
                </Link>
              </div>
            </div>
          </div>

          {message ? <StatusAlert tone={message.tone}>{message.text}</StatusAlert> : null}
        </form>
      </section>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/80 px-6 py-10 text-center">
          <p className="text-base font-semibold text-foreground">Henuz gorev kaydi yok</p>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Ilk gorevi bu sayfadan ac. Gorevler firma workspace baglaminda saklanir, personel
            atamalarina baglanir ve OSGB yonetimi tarafindan gecikme, tamamlama ve kanit zinciri
            olarak izlenir.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {tasks.map((task) => (
            <article
              key={task.id}
              className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary">
                      {statusLabel(task.status)}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {priorityLabel(task.priority)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    {task.company?.displayName || "Firma baglantisi bulunamadi"}
                    {task.dueDate ? ` · Son tarih ${task.dueDate}` : ""}
                  </p>

                  {task.description ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{task.description}</p>
                  ) : null}

                  {task.assignees.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {task.assignees.map((assignee) => (
                        <span
                          key={`${task.id}-${assignee}`}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground"
                        >
                          {assignee}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Henuz personel atanmis degil. Gerekirse gorevi atamasiz acip sonra
                      gorevlendirme matrisiyle personel baglayabilirsin.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {task.status !== "in_progress" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updatingTaskId === task.id}
                      onClick={() => handleStatusUpdate(task.id, "in_progress")}
                    >
                      Isleme al
                    </Button>
                  ) : null}
                  {task.status !== "done" ? (
                    <Button
                      size="sm"
                      disabled={updatingTaskId === task.id}
                      onClick={() => handleStatusUpdate(task.id, "done")}
                    >
                      Tamamla
                    </Button>
                  ) : null}
                  {task.status !== "cancelled" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updatingTaskId === task.id}
                      onClick={() => handleStatusUpdate(task.id, "cancelled")}
                    >
                      Iptal et
                    </Button>
                  ) : null}

                  {task.company ? (
                    <>
                      <Link
                        href={`${task.company.workspaceHref}?tab=tracking`}
                        className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-secondary"
                      >
                        Firma takibi
                      </Link>
                      <Link
                        href={`/osgb/documents?workspaceId=${task.company.workspaceId}`}
                        className="inline-flex h-9 items-center rounded-xl border border-border bg-card px-3.5 text-sm font-medium text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-secondary"
                      >
                        Dokumanlar
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
