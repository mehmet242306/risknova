import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").trim();
    const password = String(body?.password ?? "");
    const confirmPassword = String(body?.confirmPassword ?? "");

    if (!email || !code || !password || !confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "Tum alanlar zorunludur." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, message: "Yeni sifre en az 8 karakter olmalidir." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { ok: false, message: "Sifreler birbiriyle uyusmuyor." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Kod gecersiz veya suresi dolmus." },
        { status: 400 }
      );
    }

    const candidates = await prisma.passwordResetCode.findMany({
      where: {
        email,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    let matchedCode: null | { id: string } = null;

    for (const item of candidates) {
      const ok = await compare(code, item.codeHash);
      if (ok) {
        matchedCode = { id: item.id };
        break;
      }
    }

    if (!matchedCode) {
      return NextResponse.json(
        { ok: false, message: "Kod gecersiz veya suresi dolmus." },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { email },
        data: { passwordHash },
      }),
      prisma.passwordResetCode.update({
        where: { id: matchedCode.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetCode.deleteMany({
        where: {
          email,
          id: { not: matchedCode.id },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Sifre basariyla yenilendi. Simdi giris yapabilirsiniz.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Sifre yenilenemedi." },
      { status: 500 }
    );
  }
}