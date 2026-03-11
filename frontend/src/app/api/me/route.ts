import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().max(30).optional().nullable(),
  smsNotificationsEnabled: z.boolean(),
  recoveryPhoneEnabled: z.boolean(),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, message: "Yetkisiz." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerifiedAt: true,
      smsNotificationsEnabled: true,
      recoveryPhoneEnabled: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: false, message: "Kullanici bulunamadi." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, message: "Yetkisiz." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Gecersiz veri." }, { status: 400 });
    }

    const data = parsed.data;

    const updated = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        name: data.name,
        phone: data.phone?.trim() ? data.phone.trim() : null,
        smsNotificationsEnabled: data.smsNotificationsEnabled,
        recoveryPhoneEnabled: data.recoveryPhoneEnabled,
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerifiedAt: true,
        smsNotificationsEnabled: true,
        recoveryPhoneEnabled: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated, message: "Profil guncellendi." });
  } catch {
    return NextResponse.json({ ok: false, message: "Profil guncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, message: "Yetkisiz." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const confirmText = String(body.confirmText || "");

    if (!currentPassword || confirmText !== "HESABIMI SIL") {
      return NextResponse.json(
        { ok: false, message: "Sifre ve onay metni zorunludur." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ ok: false, message: "Kullanici bulunamadi." }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          ok: false,
          message: "Sosyal giris hesaplari icin once sifre belirleme akisinin eklenmesi gerekir.",
        },
        { status: 400 }
      );
    }

    const passwordOk = await compare(currentPassword, user.passwordHash);

    if (!passwordOk) {
      return NextResponse.json({ ok: false, message: "Mevcut sifre hatali." }, { status: 401 });
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    return NextResponse.json({ ok: true, message: "Hesap silindi." });
  } catch {
    return NextResponse.json({ ok: false, message: "Hesap silinemedi." }, { status: 500 });
  }
}