import { Resend } from "resend";

type PasswordResetMailParams = {
  to: string;
  code: string;
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