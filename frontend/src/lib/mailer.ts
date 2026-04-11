import { Resend } from "resend";

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

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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

  const from = process.env.RESEND_FROM_EMAIL || "noreply@example.com";

  await resend.emails.send({
    from,
    to,
    subject: "Sifre sifirlama kodunuz",
    text:
      "Sifre sifirlama kodunuz: " +
      code +
      ". Bu kod 15 dakika gecerlidir.",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111827;">
        <h2>Sifre sifirlama kodunuz</h2>
        <p>Asagidaki kodu kullanarak sifrenizi yenileyebilirsiniz:</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; margin: 20px 0;">
          ${code}
        </div>
        <p>Bu kod 15 dakika gecerlidir ve tek kullanimliktir.</p>
      </div>
    `,
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

  const from = process.env.RESEND_FROM_EMAIL || "noreply@example.com";

  await resend.emails.send({
    from,
    to,
    subject: "Hesabinizda yeni cihaz veya konum algilandi",
    text:
      "RiskNova hesabinizda yeni bir cihaz veya IP adresi ile giris algilandi. " +
      `Cihaz: ${deviceInfo}. IP: ${ipAddress}. Zaman: ${occurredAt}. Bu giris size ait degilse sifrenizi degistirin ve tum cihazlardan cikis yapin.`,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #111827;">
        <h2>Yeni cihaz veya konum algilandi</h2>
        <p>RiskNova hesabinizda yeni bir cihaz veya IP adresi ile giris algilandi.</p>
        <ul>
          <li><strong>Cihaz:</strong> ${deviceInfo}</li>
          <li><strong>IP:</strong> ${ipAddress}</li>
          <li><strong>Zaman:</strong> ${occurredAt}</li>
        </ul>
        <p>Bu giris size ait degilse sifrenizi hemen degistirin ve tum cihazlardan cikis yapin.</p>
      </div>
    `,
  });
}
