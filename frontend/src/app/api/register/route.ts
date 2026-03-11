import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(64),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Kayit bilgileri gecersiz." },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const exists = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (exists) {
      return NextResponse.json(
        { ok: false, message: "Bu e-posta zaten kayitli." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Hesap olusturuldu.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Kayit islemi basarisiz." },
      { status: 500 }
    );
  }
}