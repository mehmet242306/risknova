import { Resend } from "resend";
import { defaultLocale, type Locale } from "@/i18n/routing";
import { getLocalizedDemoMailCopy } from "@/lib/platform-admin/demo-localization";

type PasswordResetMailParams = {
  to: string;
  code: string;
};

type SuspiciousLoginMailParams = {
  to: string;
  deviceInfo: string;
  ipAddress: string;
  occurredAt: string;
};

type DataDeletionConfirmationMailParams = {
  to: string;
  scheduledPurgeAt: string;
};

type OsgbPersonnelInviteMailParams = {
  to: string;
  fullName: string;
  organizationName: string;
  companyName: string;
  professionalRole: string;
  loginEmail: string;
  temporaryPassword?: string | null;
  loginUrl: string;
  resetPasswordUrl: string;
};

type DemoAccountProvisionMailParams = {
  to: string;
  fullName: string;
  organizationName: string;
  accountTypeLabel: string;
  locale?: Locale;
  loginEmail: string;
  temporaryPassword: string;
  loginUrl: string;
  resetPasswordUrl: string;
  accessExpiresAt: string;
};

type WelcomeAccountMailParams = {
  to: string;
  fullName: string;
  loginUrl: string;
  onboardingUrl: string;
};

type GoogleConnectedMailParams = {
  to: string;
  fullName: string;
  loginUrl: string;
  onboardingUrl: string;
};

type PasswordResetLinkMailParams = {
  to: string;
  fullName: string;
  resetUrl: string;
  expiresInLabel?: string;
};

type PasswordChangedMailParams = {
  to: string;
  fullName: string;
  loginUrl: string;
  changedAt: string;
};

export type OsgbPersonnelInvitePreview = {
  loginEmail: string;
  temporaryPassword?: string | null;
  loginUrl: string;
  resetPasswordUrl: string;
  note: string;
};

export type DemoAccountProvisionPreview = {
  loginEmail: string;
  temporaryPassword: string;
  loginUrl: string;
  resetPasswordUrl: string;
  note: string;
};

export type OsgbPersonnelInviteDeliveryResult =
  | {
      delivered: true;
      mode: "resend";
    }
  | {
      delivered: false;
      mode: "preview";
      reason: string;
      preview: OsgbPersonnelInvitePreview;
    };

export type DemoAccountProvisionDeliveryResult =
  | {
      delivered: true;
      mode: "resend";
    }
  | {
      delivered: false;
      mode: "preview";
      reason: string;
      preview: DemoAccountProvisionPreview;
    };

const BRAND_NAME = "RiskNova";
const BRAND_TAGLINE = "AI destekli ISG platformu";
const BRAND_SUPPORT_EMAIL = "support@getrisknova.com";
const BRAND_HELLO_EMAIL = "hello@getrisknova.com";

function resolveBrandWebsite() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return "https://getrisknova.com";

  const normalized = configured.toLowerCase();
  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) {
    return "https://getrisknova.com";
  }

  return configured;
}

const BRAND_WEBSITE = resolveBrandWebsite();

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveFromEmail() {
  return process.env.RESEND_FROM_EMAIL || "noreply@example.com";
}

function formatEmailDateTime(value: string, locale: Locale = defaultLocale) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(date);
  } catch {
    return value;
  }
}

function renderBadge(label: string) {
  return `
    <span style="display:inline-block;padding:8px 14px;border-radius:999px;background:#fff7e6;border:1px solid #f1d19a;color:#b7791f;font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderActionButton(label: string, href: string, variant: "primary" | "secondary" = "primary") {
  const isPrimary = variant === "primary";
  return `
    <a
      href="${escapeHtml(href)}"
      style="
        display:inline-block;
        padding:14px 22px;
        border-radius:14px;
        font-size:15px;
        font-weight:800;
        text-decoration:none;
        margin-right:10px;
        margin-bottom:10px;
        background:${isPrimary ? "linear-gradient(135deg, #c6922a 0%, #f6c64d 100%)" : "#ffffff"};
        color:${isPrimary ? "#0f172a" : "#0f172a"};
        border:${isPrimary ? "none" : "1px solid #d6c4a3"};
        box-shadow:${isPrimary ? "0 12px 30px rgba(198, 146, 42, 0.28)" : "none"};
      "
    >
      ${escapeHtml(label)}
    </a>
  `;
}

function renderInfoCard(title: string, body: string, tone: "gold" | "navy" | "rose" = "gold") {
  const palette =
    tone === "navy"
      ? {
          background: "#eef4ff",
          border: "#c7d6f7",
          title: "#153e75",
          text: "#334155",
        }
      : tone === "rose"
        ? {
            background: "#fff5f5",
            border: "#fecaca",
            title: "#b91c1c",
            text: "#7f1d1d",
          }
        : {
            background: "#fffaf0",
            border: "#f3d7a7",
            title: "#9a6700",
            text: "#475569",
          };

  return `
    <div style="margin:18px 0;padding:18px 20px;border:1px solid ${palette.border};border-radius:18px;background:${palette.background};">
      <div style="font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${palette.title};margin-bottom:8px;">
        ${escapeHtml(title)}
      </div>
      <div style="font-size:15px;line-height:1.75;color:${palette.text};">
        ${body}
      </div>
    </div>
  `;
}

function renderCredentialCard(
  rows: Array<{ label: string; value: string; emphasize?: boolean }>,
) {
  const content = rows
    .map(
      ({ label, value, emphasize }) => `
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:14px;vertical-align:top;width:170px;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:10px 0;color:#0f172a;font-size:15px;font-weight:${emphasize ? "800" : "700"};vertical-align:top;">
            ${escapeHtml(value)}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="margin:22px 0;padding:22px;border-radius:22px;border:1px solid #eadcc3;background:#fcfaf6;box-shadow:inset 0 1px 0 rgba(255,255,255,0.8);">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${content}
      </table>
    </div>
  `;
}

function renderEmailShell(input: {
  eyebrow: string;
  title: string;
  lead: string;
  greeting?: string;
  sections: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  closing?: string;
}) {
  const greetingHtml = input.greeting
    ? `<p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:#334155;">${input.greeting}</p>`
    : "";

  const primaryActionHtml = input.primaryAction
    ? renderActionButton(input.primaryAction.label, input.primaryAction.href, "primary")
    : "";
  const secondaryActionHtml = input.secondaryAction
    ? renderActionButton(input.secondaryAction.label, input.secondaryAction.href, "secondary")
    : "";

  const actionsHtml =
    primaryActionHtml || secondaryActionHtml
      ? `
        <div style="margin:28px 0 8px 0;">
          ${primaryActionHtml}
          ${secondaryActionHtml}
        </div>
      `
      : "";

  const closingHtml = input.closing
    ? `<p style="margin:26px 0 0 0;font-size:15px;line-height:1.75;color:#475569;">${input.closing}</p>`
    : "";

  return `
    <!doctype html>
    <html lang="tr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:28px 12px;background:#f5efe4;font-family:Arial, Helvetica, sans-serif;color:#0f172a;">
        <div style="max-width:720px;margin:0 auto;">
          <div style="padding:22px 22px 24px 22px;border-radius:28px;background:linear-gradient(135deg, #0f172a 0%, #16233b 100%);box-shadow:0 24px 60px rgba(15, 23, 42, 0.24);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:top;">
                  <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="vertical-align:middle;">
                        <div style="font-size:34px;font-weight:900;color:#ffffff;letter-spacing:-0.04em;line-height:1;">
                          ${BRAND_NAME}
                        </div>
                        <div style="margin-top:10px;font-size:15px;color:#e2e8f0;">
                          ${BRAND_TAGLINE}
                        </div>
                      </td>
                    </tr>
                  </table>
                  <div style="margin-top:14px;">
                    ${renderBadge(input.eyebrow)}
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <div style="margin-top:-12px;padding:28px 22px;border-radius:28px;border:1px solid #eadcc3;background:#ffffff;box-shadow:0 22px 52px rgba(148, 113, 33, 0.12);">
            <h1 style="margin:0 0 14px 0;font-size:32px;line-height:1.1;letter-spacing:-0.04em;color:#0f172a;">
              ${input.title}
            </h1>
            ${greetingHtml}
            <p style="margin:0;font-size:16px;line-height:1.8;color:#475569;">
              ${input.lead}
            </p>

            ${actionsHtml}

            <div style="margin-top:26px;">
              ${input.sections}
            </div>

            ${closingHtml}
          </div>

          <div style="padding:20px 10px 8px 10px;text-align:center;color:#64748b;font-size:13px;line-height:1.8;">
            <div style="font-weight:800;color:#0f172a;margin-bottom:6px;">
              ${BRAND_NAME}
            </div>
            <div>${escapeHtml(BRAND_WEBSITE)}</div>
            <div>Destek: ${BRAND_SUPPORT_EMAIL} &nbsp;|&nbsp; Iletisim: ${BRAND_HELLO_EMAIL}</div>
            <div style="margin-top:8px;">Bu e-posta RiskNova sistem bildirimi olarak gonderilmistir.</div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendPasswordResetCodeEmail({
  to,
  code,
}: PasswordResetMailParams) {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Password reset code for", to, "=>", code);
      return;
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const html = renderEmailShell({
    eyebrow: "Guvenli erisim",
    title: "Sifre sifirlama kodunuz hazir",
    greeting: "Merhaba,",
    lead:
      "Hesabinizin guvenligini korumak icin sifre yenileme islemini tek kullanimlik bir dogrulama kodu ile tamamliyoruz.",
    primaryAction: {
      label: "Giris ekranina don",
      href: BRAND_WEBSITE,
    },
    sections:
      renderCredentialCard([
        { label: "Dogrulama kodu", value: code, emphasize: true },
        { label: "Gecerlilik suresi", value: "15 dakika" },
      ]) +
      renderInfoCard(
        "Guvenlik notu",
        "Bu kod tek kullanimliktir. Bu islemi siz baslatmadiysaniz sifrenizi degistirmeyin ve destek ekibimizle iletisime gecin.",
        "navy",
      ),
    closing:
      "Sifrenizi yeniledikten sonra hesabiniza kaldiginiz yerden devam edebilirsiniz.",
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: "RiskNova | Sifre sifirlama kodunuz",
    text:
      "Sifre sifirlama kodunuz: " +
      code +
      ". Bu kod 15 dakika gecerlidir. Destek: " +
      BRAND_SUPPORT_EMAIL,
    html,
  });
}

export async function sendPasswordResetLinkEmail({
  to,
  fullName,
  resetUrl,
  expiresInLabel = "60 dakika",
}: PasswordResetLinkMailParams) {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Password reset link for", to, "=>", resetUrl);
      return;
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const html = renderEmailShell({
    eyebrow: "Sifre yenileme",
    title: "Sifre yenileme baglantiniz hazir",
    greeting: `Merhaba ${escapeHtml(fullName || "Kullanici")},`,
    lead:
      "Hesabiniz icin sifre yenileme talebi aldik. Aasagidaki baglanti ile yeni sifrenizi guvenli sekilde belirleyebilirsiniz.",
    primaryAction: {
      label: "Sifremi yenile",
      href: resetUrl,
    },
    sections:
      renderCredentialCard([
        { label: "Baglanti gecerlilik suresi", value: expiresInLabel, emphasize: true },
        { label: "Guvenlik", value: "Tek kullanimlik yenileme baglantisi" },
      ]) +
      renderInfoCard(
        "Bilginiz disinda ise",
        "Bu talebi siz baslatmadiysaniz islemi tamamlamayin. Hesabinizda supheli bir hareket oldugunu dusunuyorsaniz destek ekibimize yazin.",
        "rose",
      ),
    closing:
      "Sifrenizi yeniledikten sonra RiskNova icindeki tum is akislariiniza guvenle devam edebilirsiniz.",
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: "RiskNova | Sifre yenileme baglantiniz hazir",
    text:
      `Merhaba ${fullName || "Kullanici"},\n\n` +
      `Sifre yenileme baglantiniz: ${resetUrl}\n` +
      `Bu baglanti ${expiresInLabel} gecerlidir.\n\n` +
      `Destek: ${BRAND_SUPPORT_EMAIL}`,
    html,
  });
}

export async function sendWelcomeAccountEmail({
  to,
  fullName,
  loginUrl,
  onboardingUrl,
}: WelcomeAccountMailParams) {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Welcome account email for", to);
      return;
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const html = renderEmailShell({
    eyebrow: "Yeni hesap",
    title: "RiskNova hesabin hazir",
    greeting: `Merhaba ${escapeHtml(fullName || "Kullanici")},`,
    lead:
      "Kaydiniz tamamlandi. Artik workspace yapinizi kurabilir, firma bazli calisma alanlarinizi acabilir ve RiskNova akislarini kullanmaya baslayabilirsiniz.",
    primaryAction: {
      label: "Hesabima giris yap",
      href: loginUrl,
    },
    secondaryAction: {
      label: "Workspace kurulumuna basla",
      href: onboardingUrl,
    },
    sections:
      renderInfoCard(
        "Ilk adim",
        "Ilk giriste sizi workspace kurulum ekranı karsilar. Her firma veya kurum icin ayri calisma alani kurgulayabilirsiniz.",
        "gold",
      ) +
      renderInfoCard(
        "Neleri kullanabilirsiniz?",
        "Risk analizi, dokumanlar, gorev akislari ve Nova yardimcisi tek platform icinde hazir.",
        "navy",
      ),
    closing:
      `Takildiginiz bir nokta olursa ${BRAND_SUPPORT_EMAIL} adresinden ekibimize ulasabilirsiniz.`,
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: "RiskNova | Hesabiniz hazir",
    text:
      `Merhaba ${fullName || "Kullanici"},\n\n` +
      `RiskNova hesabiniz hazir.\n` +
      `Giris: ${loginUrl}\n` +
      `Workspace kurulumu: ${onboardingUrl}\n\n` +
      `Destek: ${BRAND_SUPPORT_EMAIL}`,
    html,
  });
}

export async function sendGoogleConnectedWelcomeEmail({
  to,
  fullName,
  loginUrl,
  onboardingUrl,
}: GoogleConnectedMailParams) {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Google welcome email for", to);
      return;
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const html = renderEmailShell({
    eyebrow: "Google baglantisi",
    title: "Google ile erisiminiz aktif",
    greeting: `Merhaba ${escapeHtml(fullName || "Kullanici")},`,
    lead:
      "Google hesabinizi kullanarak RiskNova'ya baglandiniz. Artik ek sifre hatirlamadan hesabiniza hizli ve guvenli sekilde giris yapabilirsiniz.",
    primaryAction: {
      label: "RiskNova'ya don",
      href: loginUrl,
    },
    secondaryAction: {
      label: "Workspace akisini ac",
      href: onboardingUrl,
    },
    sections:
      renderInfoCard(
        "Baglanti durumu",
        "Google ile girisiniz dogrulandi. Sonraki oturumlarda ayni Google hesabi ile dogrudan devam edebilirsiniz.",
        "gold",
      ) +
      renderInfoCard(
        "Hazir akıs",
        "Bireysel, OSGB veya kurumsal yapiniza gore ilgili workspace ve operasyon akislarini kullanabilirsiniz.",
        "navy",
      ),
    closing:
      "Nova yardimcisi ve tum urun modulleri hesabinizin baglamina gore sizinle birlikte acilir.",
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: "RiskNova | Google ile girisiniz hazir",
    text:
      `Merhaba ${fullName || "Kullanici"},\n\n` +
      `Google ile RiskNova hesabiniza baglandiniz.\n` +
      `Giris: ${loginUrl}\n` +
      `Workspace: ${onboardingUrl}\n\n` +
      `Destek: ${BRAND_SUPPORT_EMAIL}`,
    html,
  });
}

export async function sendPasswordChangedEmail({
  to,
  fullName,
  loginUrl,
  changedAt,
}: PasswordChangedMailParams) {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Password changed email for", to);
      return;
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const html = renderEmailShell({
    eyebrow: "Guvenlik onayi",
    title: "Sifreniz basariyla guncellendi",
    greeting: `Merhaba ${escapeHtml(fullName || "Kullanici")},`,
    lead:
      "RiskNova hesabinizin sifresi basariyla degistirildi. Bu bildirim, hesabiniza ait guvenlik islemlerini sizinle seffaf bicimde paylasmak icin gonderilir.",
    primaryAction: {
      label: "Tekrar giris yap",
      href: loginUrl,
    },
    sections:
      renderCredentialCard([
        { label: "Degisim zamani", value: changedAt, emphasize: true },
        { label: "Durum", value: "Yeni sifre aktif" },
      ]) +
      renderInfoCard(
        "Bu islem size ait degilse",
        "Sifreniz bilginiz disinda degistirildiyse vakit kaybetmeden yeni sifre talebi baslatin ve destek ekibimizle iletisime gecin.",
        "rose",
      ),
    closing:
      "Guvenli bir hesap deneyimi icin giris ve sifre hareketleri tarafimizdan izlenir.",
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: "RiskNova | Sifreniz guncellendi",
    text:
      `Merhaba ${fullName || "Kullanici"},\n\n` +
      `Sifreniz ${changedAt} tarihinde basariyla guncellendi.\n` +
      `Giris: ${loginUrl}\n\n` +
      `Destek: ${BRAND_SUPPORT_EMAIL}`,
    html,
  });
}

export async function sendSuspiciousLoginEmail({
  to,
  deviceInfo,
  ipAddress,
  occurredAt,
}: SuspiciousLoginMailParams) {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Suspicious login for", to, { deviceInfo, ipAddress, occurredAt });
      return;
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const html = renderEmailShell({
    eyebrow: "Guvenlik uyarisi",
    title: "Hesabinizda yeni cihaz veya konum algilandi",
    greeting: "Merhaba,",
    lead:
      "RiskNova hesabiniz icin yeni bir oturum hareketi tespit ettik. Bu bildirim, olasi yetkisiz erisimleri erken fark etmeniz icin otomatik gonderilir.",
    primaryAction: {
      label: "Giris guvenligini kontrol et",
      href: BRAND_WEBSITE,
    },
    sections:
      renderCredentialCard([
        { label: "Cihaz", value: deviceInfo },
        { label: "IP adresi", value: ipAddress },
        { label: "Zaman", value: occurredAt },
      ]) +
      renderInfoCard(
        "Aksiyon onerisi",
        "Bu giris size ait degilse sifrenizi hemen degistirin, aktif oturumlarinizi kapatin ve destek ekibimize haber verin.",
        "rose",
      ),
    closing:
      "RiskNova, hesap guvenligi ve erisim izlerini sizin icin yakindan takip eder.",
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: "RiskNova | Yeni cihaz veya konum algilandi",
    text:
      "RiskNova hesabinizda yeni bir cihaz veya IP adresi ile giris algilandi. " +
      `Cihaz: ${deviceInfo}. IP: ${ipAddress}. Zaman: ${occurredAt}. Bu giris size ait degilse sifrenizi degistirin ve destek ekibiyle iletisime gecin.`,
    html,
  });
}

export async function sendDataDeletionConfirmationEmail({
  to,
  scheduledPurgeAt,
}: DataDeletionConfirmationMailParams) {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Data deletion request for", to, { scheduledPurgeAt });
      return;
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const formattedPurgeDate = formatEmailDateTime(scheduledPurgeAt);
  const html = renderEmailShell({
    eyebrow: "Veri yonetimi",
    title: "Veri silme talebiniz kaydedildi",
    greeting: "Merhaba,",
    lead:
      "Talebiniz sistemde isleme alindi. Bu surecte verileriniz soft delete olarak isaretlenir ve bekletme penceresi sona erdiginde kalici silme adimina gecilir.",
    sections:
      renderCredentialCard([
        { label: "Kalici silme tarihi", value: formattedPurgeDate, emphasize: true },
        { label: "Durum", value: "30 gunluk bekletme penceresi aktif" },
      ]) +
      renderInfoCard(
        "Durdurma hakki",
        "Bu tarihe kadar destek ekibimizle iletisime gecerek talebinizin durumunu sorgulayabilir veya idari surecte yeniden degerlendirilmesini isteyebilirsiniz.",
        "navy",
      ),
    closing:
      "Saklama ve imha surecimiz, yasal yukumlulukler ve guvenlik kayitlari dikkate alinarak yurutulur.",
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: "RiskNova | Veri silme talebiniz alindi",
    text:
      "Veri silme talebiniz kaydedildi. " +
      `Kalici silme tarihi: ${formattedPurgeDate}. Bu tarihe kadar destek ekibiyle iletisime gecebilirsiniz.`,
    html,
  });
}

export async function sendOsgbPersonnelInviteEmail({
  to,
  fullName,
  organizationName,
  companyName,
  professionalRole,
  loginEmail,
  temporaryPassword,
  loginUrl,
  resetPasswordUrl,
}: OsgbPersonnelInviteMailParams): Promise<OsgbPersonnelInviteDeliveryResult> {
  const preview: OsgbPersonnelInvitePreview = {
    loginEmail,
    temporaryPassword: temporaryPassword || null,
    loginUrl,
    resetPasswordUrl,
    note: temporaryPassword
      ? "Yeni kullanici icin gecici sifre uretildi. Ilk giristen sonra sifresini degistirmesi gerekir."
      : "Kullanici zaten mevcut. Mevcut sifresiyle giris yapabilir veya sifresini yenileyebilir.",
  };

  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] OSGB personnel invite", {
        to,
        fullName,
        organizationName,
        companyName,
        professionalRole,
        loginEmail,
        temporaryPassword,
        loginUrl,
        resetPasswordUrl,
      });
      return {
        delivered: false,
        mode: "preview",
        reason: "RESEND_API_KEY tanimli degil.",
        preview,
      };
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const credentialLabel = temporaryPassword ? "Gecici sifre" : "Giris notu";
  const credentialValue =
    temporaryPassword || "Mevcut sifrenizi kullanin veya sifre yenileme baglantisiyla yeni sifre belirleyin.";

  const html = renderEmailShell({
    eyebrow: "OSGB gorevlendirmesi",
    title: "RiskNova erisiminiz hazir",
    greeting: `Merhaba ${escapeHtml(fullName || "Kullanici")},`,
    lead:
      `${escapeHtml(organizationName)} sizi ${escapeHtml(companyName)} firmasi icin ${escapeHtml(professionalRole)} roluyla gorevlendirdi. ` +
      "Bu erisimle atandiginiz firma kapsaminda risk, dokuman ve operasyon akislarini tek panelden yonetebilirsiniz.",
    primaryAction: {
      label: "RiskNova'ya giris yap",
      href: loginUrl,
    },
    secondaryAction: {
      label: "Sifreyi yenile",
      href: resetPasswordUrl,
    },
    sections:
      renderCredentialCard([
        { label: "OSGB hesabi", value: organizationName },
        { label: "Firma", value: companyName },
        { label: "Profesyonel rol", value: professionalRole },
        { label: "Kullanici adi", value: loginEmail, emphasize: true },
        { label: credentialLabel, value: credentialValue, emphasize: Boolean(temporaryPassword) },
      ]) +
      renderInfoCard(
        "Ilk adim",
        "Ilk giristen sonra sifrenizi guncellemeniz gerekir. RiskNova, gorevlendirme, dokuman ve saha operasyonlarini tek akista toplayarak gunluk calismanizi hizlandirir.",
        "gold",
      ) +
      renderInfoCard(
        "Erisim kapsami",
        "Guvenlik geregi yalnizca atandiginiz workspace verilerine erisirsiniz. Yetki genisletme talepleri OSGB yoneticiniz tarafindan acilir.",
        "navy",
      ),
    closing:
      `Sorulariniz olursa ${BRAND_SUPPORT_EMAIL} adresine yazabilirsiniz.`,
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: `${organizationName} tarafindan RiskNova gorevlendirmesi`,
    text:
      `${fullName}, ${organizationName} sizi ${companyName} firmasi icin ${professionalRole} roluyla gorevlendirdi.\n\n` +
      `Kullanici adi: ${loginEmail}\n` +
      `${credentialLabel}: ${credentialValue}\n\n` +
      `Giris: ${loginUrl}\n` +
      `Sifre yenileme: ${resetPasswordUrl}\n\n` +
      `Destek: ${BRAND_SUPPORT_EMAIL}`,
    html,
  });

  return {
    delivered: true,
    mode: "resend",
  };
}

export async function sendDemoAccountProvisionEmail({
  to,
  fullName,
  organizationName,
  accountTypeLabel,
  locale = defaultLocale,
  loginEmail,
  temporaryPassword,
  loginUrl,
  resetPasswordUrl,
  accessExpiresAt,
}: DemoAccountProvisionMailParams): Promise<DemoAccountProvisionDeliveryResult> {
  const mailCopy = getLocalizedDemoMailCopy(locale);
  const formattedAccessExpiresAt = formatEmailDateTime(accessExpiresAt, locale);
  const preview: DemoAccountProvisionPreview = {
    loginEmail,
    temporaryPassword,
    loginUrl,
    resetPasswordUrl,
    note: `${mailCopy.previewNote} Demo erisimi ${formattedAccessExpiresAt} tarihine kadar aktif olacak.`,
  };

  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DEV] Demo account provision", {
        to,
        fullName,
        organizationName,
        accountTypeLabel,
        locale,
        loginEmail,
        temporaryPassword,
        loginUrl,
        resetPasswordUrl,
        accessExpiresAt,
      });
      return {
        delivered: false,
        mode: "preview",
        reason: "RESEND_API_KEY tanimli degil.",
        preview,
      };
    }

    throw new Error("RESEND_API_KEY tanimli degil.");
  }

  const html = renderEmailShell({
    eyebrow: "Demo erisimi",
    title: "RiskNova demo hesabin hazir",
    greeting: `${mailCopy.greeting} ${escapeHtml(fullName || "Kullanici")},`,
    lead:
      `${mailCopy.readyLine.replace("{accountType}", `<strong>${escapeHtml(accountTypeLabel)}</strong>`)} ` +
      "Bu demo, risk analizi, dokuman akisi, gorevlendirme ve Nova yardimcisini gercek urun hissiyle deneyebilmeniz icin hazirlandi.",
    primaryAction: {
      label: "Demoya giris yap",
      href: loginUrl,
    },
    secondaryAction: {
      label: "Sifreyi guncelle",
      href: resetPasswordUrl,
    },
    sections:
      renderCredentialCard([
        { label: mailCopy.accountLabel, value: organizationName },
        { label: mailCopy.usernameLabel, value: loginEmail, emphasize: true },
        { label: mailCopy.passwordLabel, value: temporaryPassword, emphasize: true },
      ]) +
      renderInfoCard(
        "Demo suresi",
        `Bu demo erisimi <strong>${escapeHtml(formattedAccessExpiresAt)}</strong> tarihine kadar aktif olacak. ` +
          "Sure bitimine yakin yeniden erisim isterseniz ekibimizden demo suresini uzatmasini isteyebilirsiniz.",
        "gold",
      ) +
      renderInfoCard(
        "Neleri deneyebilirsiniz?",
        "Workspace yapisini, dokuman akislarini, risk analiz mantigini ve Nova'nin operasyon yardimlarini tek oturumda gorebilirsiniz.",
        "navy",
      ) +
      renderInfoCard(
        "Iletisim",
        `Destek icin <strong>${BRAND_SUPPORT_EMAIL}</strong>, genel iletisim icin <strong>${BRAND_HELLO_EMAIL}</strong> adresine yazabilirsiniz.`,
        "gold",
      ),
    closing: mailCopy.passwordNote,
  });

  await resend.emails.send({
    from: resolveFromEmail(),
    replyTo: BRAND_SUPPORT_EMAIL,
    to,
    subject: mailCopy.subject,
    text:
      `${fullName || mailCopy.greeting}, ${mailCopy.readyLine.replace("{accountType}", accountTypeLabel)}\n\n` +
      `${mailCopy.accountLabel}: ${organizationName}\n` +
      `${mailCopy.usernameLabel}: ${loginEmail}\n` +
      `${mailCopy.passwordLabel}: ${temporaryPassword}\n` +
      `Demo erisimi bitisi: ${formattedAccessExpiresAt}\n\n` +
      `${mailCopy.loginLabel}: ${loginUrl}\n` +
      `${mailCopy.resetLabel}: ${resetPasswordUrl}\n\n` +
      `${mailCopy.passwordNote}\n` +
      `Destek: ${BRAND_SUPPORT_EMAIL}\n` +
      `Iletisim: ${BRAND_HELLO_EMAIL}`,
    html,
  });

  return {
    delivered: true,
    mode: "resend",
  };
}
