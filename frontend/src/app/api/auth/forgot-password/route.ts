import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetCodeEmail } from "@/lib/mailer";

const GENERIC_MESSAGE =
  "Eger bu e-posta ile kayitli bir hesap varsa sifre sifirlama kodu gonderildi.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    const code = String(randomInt(100000, 1000000));
    const codeHash = await hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetCode.deleteMany({
      where: { email },
    });

    await prisma.passwordResetCode.create({
      data: {
        email,
        codeHash,
        expiresAt,
      },
    });

    await sendPasswordResetCodeEmail({
      to: email,
      code,
    });

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }
}