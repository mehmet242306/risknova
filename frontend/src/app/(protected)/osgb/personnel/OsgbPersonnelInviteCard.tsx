"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CompanyOption = {
  workspaceId: string;
  displayName: string;
};

type InvitePayload = {
  fullName: string;
  email: string;
  title: string;
  professionalRole:
    | "isg_uzmani"
    | "isyeri_hekimi"
    | "diger_saglik_personeli"
    | "operasyon_sorumlusu"
    | "viewer";
  companyWorkspaceId: string;
};

type InviteResponse = {
  ok?: boolean;
  error?: string;
  createdNewUser?: boolean;
  temporaryPasswordIssued?: boolean;
  emailDelivered?: boolean;
  deliveryMode?: "resend" | "preview" | "failed";
  warning?: string | null;
  invitePreview?: {
    loginEmail: string;
    temporaryPassword?: string | null;
    loginUrl: string;
    resetPasswordUrl: string;
    note: string;
  } | null;
};

type UsageSnapshot = {
  maxActiveStaffSeats: number | null;
  activeStaffCount: number;
};

type OsgbPersonnelInviteCardProps = {
  companies: CompanyOption[];
  selectedWorkspaceId?: string | null;
  usage: UsageSnapshot | null;
};

const selectClassName =
  "mt-2 h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground shadow-[var(--shadow-soft)] transition-colors transition-shadow hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--ring)]";

const ROLE_OPTIONS: Array<{
  value: InvitePayload["professionalRole"];
  label: string;
  detail: string;
}> = [
  {
    value: "isg_uzmani",
    label: "Is Guvenligi Uzmani",
    detail: "A, B veya C sinifi sertifika sahibi uzmanlar icin.",
  },
  {
    value: "isyeri_hekimi",
    label: "Isyeri Hekimi",
    detail: "Saglik gozetimi ve hekim atamasi gereken personel icin.",
  },
  {
    value: "diger_saglik_personeli",
    label: "Diger Saglik Personeli",
    detail: "DSP gorevleri ve saha saglik takibi icin.",
  },
  {
    value: "operasyon_sorumlusu",
    label: "Operasyon Sorumlusu",
    detail: "OSGB operasyon ve koordinasyon gorevleri icin.",
  },
  {
    value: "viewer",
    label: "Goruntuleyici",
    detail: "Sadece izleme yetkisi verilecek kullanicilar icin.",
  },
];

async function readJsonSafely(response: Response): Promise<InviteResponse> {
  const raw = await response.text();
  if (!raw.trim()) {
    return response.ok ? { ok: true } : { error: "Sunucudan bos yanit geldi." };
  }

  try {
    return JSON.parse(raw) as InviteResponse;
  } catch {
    return response.ok
      ? { ok: true }
      : { error: raw || "Sunucudan anlasilamayan bir yanit dondu." };
  }
}

export function OsgbPersonnelInviteCard({
  companies,
  selectedWorkspaceId,
  usage,
}: OsgbPersonnelInviteCardProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [professionalRole, setProfessionalRole] =
    useState<InvitePayload["professionalRole"]>("isg_uzmani");
  const [companyWorkspaceId, setCompanyWorkspaceId] = useState(
    selectedWorkspaceId || companies[0]?.workspaceId || "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<InviteResponse["invitePreview"]>(null);

  useEffect(() => {
    if (selectedWorkspaceId) {
      setCompanyWorkspaceId(selectedWorkspaceId);
      return;
    }

    if (!companyWorkspaceId && companies[0]?.workspaceId) {
      setCompanyWorkspaceId(companies[0].workspaceId);
    }
  }, [companies, companyWorkspaceId, selectedWorkspaceId]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.workspaceId === companyWorkspaceId) ?? null,
    [companies, companyWorkspaceId],
  );

  const remainingSeats =
    typeof usage?.maxActiveStaffSeats === "number"
      ? Math.max(usage.maxActiveStaffSeats - usage.activeStaffCount, 0)
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setWarning(null);
    setInvitePreview(null);

    try {
      const response = await fetch("/api/osgb/personnel/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          email,
          title,
          professionalRole,
          companyWorkspaceId,
        } satisfies InvitePayload),
      });

      const payload = await readJsonSafely(response);
      if (!response.ok || payload.ok === false) {
        setError(payload.error || "Personel daveti gonderilemedi.");
        return;
      }

      setWarning(payload.warning || null);
      setInvitePreview(payload.invitePreview || null);

      if (payload.emailDelivered === false) {
        setSuccess(
          payload.createdNewUser
            ? "Personel olusturuldu ve firmaya atandi. Mail gonderimi yerine erisim bilgileri hazirlandi."
            : "Personel firmaya baglandi. Mail gonderimi yerine giris ve sifre yenileme bilgileri hazirlandi.",
        );
      } else {
        setSuccess(
          payload.createdNewUser
            ? "Personel olusturuldu. Kullanici adi ve gecici sifre e-posta ile gonderildi; ilk giriste sifresini degistirmesi istenecek."
            : "Personel ilgili firmaya baglandi. Hesaba giris ve sifre yenileme yonlendirmesi e-posta ile gonderildi.",
        );
      }
      setFullName("");
      setEmail("");
      setTitle("");
      setProfessionalRole("isg_uzmani");
      router.refresh();
    } catch {
      setError("Davet sirasinda baglanti hatasi olustu. Lutfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <span className="eyebrow">Personel daveti</span>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Firma bazli davet ve oturum yonetimi
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Davet edilen personel once OSGB hesabindaki aktif seat sayisina dahil edilir, sonra
            secilen firmaya atanir. Sistem kullaniciya e-posta ile giris bilgilerini yollar; yeni
            kullanicilar ilk giriste sifre degistirmeye yonlendirilir.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <p className="font-semibold">Aktif personel / seat</p>
          <p className="mt-1 text-xl font-semibold">
            {usage?.activeStaffCount ?? 0}
            {typeof usage?.maxActiveStaffSeats === "number"
              ? ` / ${usage.maxActiveStaffSeats}`
              : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {remainingSeats === null
              ? "Paket seat limiti migration tamamlandiginda net gorunecek."
              : remainingSeats > 0
                ? `${remainingSeats} bos aktif personel koltugu kaldi.`
                : "Seat limiti doluysa sadece mevcut personeli ek firmalara baglayabilirsin."}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Ad soyad"
              name="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Personelin adi soyadi"
              required
            />
            <Input
              label="E-posta"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="personel@firma.com"
              required
            />
            <Input
              label="Unvan"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="A sinifi uzman, isyeri hekimi vb."
            />
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="professionalRole">
                Profesyonel rol
              </label>
              <select
                id="professionalRole"
                value={professionalRole}
                onChange={(event) =>
                  setProfessionalRole(event.target.value as InvitePayload["professionalRole"])
                }
                className={selectClassName}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-5 text-muted-foreground">
                {ROLE_OPTIONS.find((option) => option.value === professionalRole)?.detail}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground" htmlFor="companyWorkspaceId">
              Gorevlendirilecegi firma
            </label>
            <select
              id="companyWorkspaceId"
              value={companyWorkspaceId}
              onChange={(event) => setCompanyWorkspaceId(event.target.value)}
              className={selectClassName}
              required
            >
              <option value="" disabled>
                Firma secin
              </option>
              {companies.map((company) => (
                <option key={company.workspaceId} value={company.workspaceId}>
                  {company.displayName}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-muted-foreground">
              Davet edilen kullanici sadece bu firmaya ve sonradan atanacagi diger workspace'lere
              kendi hesabi uzerinden erisebilir.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {success}
            </div>
          ) : null}

          {warning ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {warning}
            </div>
          ) : null}

          {invitePreview ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 text-sm text-foreground">
              <p className="font-semibold">Paylasilacak giris bilgileri</p>
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  <span className="font-medium">Kullanici adi:</span> {invitePreview.loginEmail}
                </p>
                {invitePreview.temporaryPassword ? (
                  <p>
                    <span className="font-medium">Gecici sifre:</span> {invitePreview.temporaryPassword}
                  </p>
                ) : null}
                <p>
                  <span className="font-medium">Giris:</span> {invitePreview.loginUrl}
                </p>
                <p>
                  <span className="font-medium">Sifre yenileme:</span> {invitePreview.resetPasswordUrl}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">{invitePreview.note}</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting || !companyWorkspaceId}>
              {submitting ? "Davet gonderiliyor..." : "Personel daveti gonder"}
            </Button>
            {selectedCompany ? (
              <p className="flex items-center text-sm text-muted-foreground">
                Secili firma: <span className="ml-1 font-medium text-foreground">{selectedCompany.displayName}</span>
              </p>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-border bg-background p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Davet sonrasi akış
          </h3>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <li>1. Personel OSGB hesabindaki aktif seat havuzuna dahil edilir.</li>
            <li>2. Secilen firmaya rol bazli workspace atamasi otomatik acilir.</li>
            <li>3. E-posta ile kullanici adi ve giris bilgileri iletilir.</li>
            <li>4. Yeni kullanici ilk giriste dogrudan sifre yenilemeye yonlendirilir.</li>
            <li>5. Sonraki gorevlendirmeler ayni hesap uzerinden baska firmalara eklenebilir.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}
