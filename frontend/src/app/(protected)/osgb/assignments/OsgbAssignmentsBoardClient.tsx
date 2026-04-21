"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusAlert } from "@/components/ui/status-alert";

type AssignmentCompany = {
  workspaceId: string;
  displayName: string;
  workspaceHref: string;
} | null;

type AssignmentProfile = {
  fullName: string | null;
  email: string | null;
  title: string | null;
} | null;

type AssignmentRow = {
  id: string;
  userId: string;
  professionalRole: string;
  assignmentStatus: string;
  canView: boolean;
  canCreateRisk: boolean;
  canEditRisk: boolean;
  canApprove: boolean;
  canSign: boolean;
  startsOn: string | null;
  endsOn: string | null;
  company: AssignmentCompany;
  profile: AssignmentProfile;
};

type Props = {
  assignments: AssignmentRow[];
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function statusLabel(status: string) {
  if (status === "suspended") return "Askida";
  if (status === "ended") return "Sonlandi";
  return "Aktif";
}

function roleLabel(role: string) {
  switch (role) {
    case "isg_uzmani":
      return "Is Guvenligi Uzmani";
    case "isyeri_hekimi":
      return "Isyeri Hekimi";
    case "diger_saglik_personeli":
      return "Diger Saglik Personeli";
    case "operasyon_sorumlusu":
      return "Operasyon Sorumlusu";
    case "viewer":
      return "Goruntuleyici";
    default:
      return role;
  }
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

function PermissionChip({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5"
      }`}
    >
      {label}
    </button>
  );
}

export function OsgbAssignmentsBoardClient({ assignments }: Props) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "warning" | "danger";
    text: string;
  } | null>(null);

  async function updateAssignment(
    assignmentId: string,
    payload: Record<string, boolean | string | null>,
  ) {
    setUpdatingId(assignmentId);
    setMessage(null);

    try {
      const response = await fetch(`/api/osgb/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafely(response);
      if (!response.ok || data.ok === false) {
        setMessage({
          tone: "danger",
          text: data.error || "Gorevlendirme guncellenemedi.",
        });
        return;
      }

      setMessage({
        tone: "success",
        text: data.message || "Gorevlendirme guncellendi.",
      });
      router.refresh();
    } catch {
      setMessage({
        tone: "danger",
        text: "Gorevlendirme guncellenirken baglanti hatasi olustu.",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message ? <StatusAlert tone={message.tone}>{message.text}</StatusAlert> : null}

      {assignments.map((assignment) => {
        const disabled = updatingId === assignment.id;
        const personLabel =
          assignment.profile?.fullName ||
          assignment.profile?.email ||
          "Isimsiz personel";

        return (
          <article
            key={assignment.id}
            className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{personLabel}</h3>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary">
                    {roleLabel(assignment.professionalRole)}
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {statusLabel(assignment.assignmentStatus)}
                  </span>
                  {assignment.company ? (
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {assignment.company.displayName}
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {assignment.profile?.title || "Unvan tanimsiz"}
                  {assignment.profile?.email ? ` - ${assignment.profile.email}` : ""}
                </p>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Yetki matrisi
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PermissionChip
                      active={assignment.canView}
                      label="Goruntule"
                      disabled={disabled}
                      onClick={() =>
                        updateAssignment(assignment.id, { canView: !assignment.canView })
                      }
                    />
                    <PermissionChip
                      active={assignment.canCreateRisk}
                      label="Risk olustur"
                      disabled={disabled}
                      onClick={() =>
                        updateAssignment(assignment.id, {
                          canCreateRisk: !assignment.canCreateRisk,
                        })
                      }
                    />
                    <PermissionChip
                      active={assignment.canEditRisk}
                      label="Risk duzenle"
                      disabled={disabled}
                      onClick={() =>
                        updateAssignment(assignment.id, {
                          canEditRisk: !assignment.canEditRisk,
                        })
                      }
                    />
                    <PermissionChip
                      active={assignment.canApprove}
                      label="Onay"
                      disabled={disabled}
                      onClick={() =>
                        updateAssignment(assignment.id, { canApprove: !assignment.canApprove })
                      }
                    />
                    <PermissionChip
                      active={assignment.canSign}
                      label="Imza"
                      disabled={disabled}
                      onClick={() =>
                        updateAssignment(assignment.id, { canSign: !assignment.canSign })
                      }
                    />
                  </div>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  Baslangic: {assignment.startsOn || "-"} - Bitis: {assignment.endsOn || "-"}
                </p>
              </div>

              <div className="flex flex-col gap-3 xl:min-w-[16rem] xl:items-end">
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {assignment.assignmentStatus !== "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        updateAssignment(assignment.id, {
                          assignmentStatus: "active",
                        })
                      }
                    >
                      Aktif et
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        updateAssignment(assignment.id, {
                          assignmentStatus: "suspended",
                        })
                      }
                    >
                      Askiya al
                    </Button>
                  )}

                  {assignment.assignmentStatus !== "ended" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        updateAssignment(assignment.id, {
                          assignmentStatus: "ended",
                        })
                      }
                    >
                      Sonlandir
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {assignment.company ? (
                    <>
                      <Link
                        href={`${assignment.company.workspaceHref}?tab=organization`}
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Firma organizasyonu
                      </Link>
                      <Link
                        href={`${assignment.company.workspaceHref}?tab=risk`}
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Risk akisina git
                      </Link>
                      <Link
                        href={`/osgb/documents?workspaceId=${assignment.company.workspaceId}`}
                        className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                      >
                        Dokumanlar
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
