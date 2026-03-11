import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import LinkedInProvider from "next-auth/providers/linkedin";
import AppleProvider from "next-auth/providers/apple";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const signInSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(6),
});

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email ve Sifre",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Sifre", type: "password" },
    },
    async authorize(credentials) {
      const parsed = signInSchema.safeParse(credentials);

      if (!parsed.success) {
        return null;
      }

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user?.passwordHash) {
        return null;
      }

      const ok = await compare(password, user.passwordHash);

      if (!ok) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerifiedAt: user.phoneVerifiedAt,
      } as any;
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

if (process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET) {
  providers.push(
    LinkedInProvider({
      clientId: process.env.AUTH_LINKEDIN_ID,
      clientSecret: process.env.AUTH_LINKEDIN_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(
    AppleProvider({
      clientId: process.env.AUTH_APPLE_ID,
      clientSecret: process.env.AUTH_APPLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role ?? "USER";
        token.emailVerified = !!(user as any).emailVerified;
        token.phoneVerified = !!(user as any).phoneVerifiedAt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role;
        (session.user as any).emailVerified = token.emailVerified;
        (session.user as any).phoneVerified = token.phoneVerified;
      }
      return session;
    },
  },
};