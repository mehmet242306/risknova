import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
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
    redirect("/login");
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Profil ve Hesap</h1>
        <p style={{ opacity: 0.8, lineHeight: 1.7, maxWidth: 980 }}>
          Bu alanda profil bilgilerini guncelleyebilir ve oturumunu kapatabilirsin.
        </p>
      </div>

      <ProfileClient
        initialUser={{
          ...user,
          emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
          phoneVerifiedAt: user.phoneVerifiedAt ? user.phoneVerifiedAt.toISOString() : null,
          createdAt: user.createdAt.toISOString(),
        }}
      />
    </div>
  );
}