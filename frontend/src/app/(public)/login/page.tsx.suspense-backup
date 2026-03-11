"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "1";
const linkedinEnabled = process.env.NEXT_PUBLIC_AUTH_LINKEDIN_ENABLED === "1";
const appleEnabled = process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "1";
const REMEMBER_EMAIL_KEY = "guvenligimcepte_remembered_email";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.2-5.9 6.8l6.2 5.2C39.1 36.7 44 31 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.23c.02 2.48 2.18 3.3 2.2 3.31-.02.06-.34 1.18-1.12 2.34-.68 1-1.39 1.99-2.5 2.01-1.09.02-1.44-.64-2.68-.64-1.24 0-1.63.62-2.66.66-1.07.04-1.89-1.07-2.57-2.06-1.39-2.01-2.45-5.69-1.03-8.16.7-1.22 1.96-1.99 3.33-2.01 1.04-.02 2.03.7 2.68.7.66 0 1.89-.86 3.18-.73.54.02 2.05.22 3.02 1.64-.08.05-1.8 1.05-1.78 2.94zM14.7 4.89c.57-.69.95-1.65.84-2.61-.82.03-1.81.54-2.4 1.23-.53.62-.99 1.6-.86 2.54.91.07 1.85-.47 2.42-1.16z"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="#0A66C2">
      <path d="M6.94 8.5H3.56V20h3.38V8.5zM5.25 3A1.97 1.97 0 0 0 3.28 4.97c0 1.08.88 1.97 1.97 1.97 1.08 0 1.97-.89 1.97-1.97A1.98 1.98 0 0 0 5.25 3zM20.44 13.01c0-3.2-1.71-4.69-4-4.69-1.84 0-2.66 1.01-3.12 1.72V8.5H9.94c.04 1.02 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.68.13-.92.27-.68.88-1.38 1.9-1.38 1.34 0 1.88 1.02 1.88 2.52V20h3.38v-6.99z"/>
    </svg>
  );
}

function SocialButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #ddd",
        background: "#fff",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextUrl = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);

    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberEmail(true);
    }
  }, []);

  async function handleCredentialsLogin() {
    setLoading(true);
    setMessage("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: nextUrl,
    });

    setLoading(false);

    if (result?.error) {
      setMessage("Giris basarisiz. Bilgileri kontrol et.");
      return;
    }

    if (rememberEmail) {
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    window.location.href = nextUrl;
  }

  async function handleSocial(provider: "google" | "linkedin" | "apple") {
    await signIn(provider, { callbackUrl: nextUrl });
  }

  return (
    <div style={{ minHeight: "calc(100vh - 120px)", display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, border: "1px solid #eee", borderRadius: 20, padding: 24, background: "#fff" }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Giris</h1>
        <p style={{ opacity: 0.75, lineHeight: 1.7, marginBottom: 18 }}>
          Email, sifre veya sosyal hesap ile giris yap.
        </p>

        <div style={{ display: "grid", gap: 12, marginBottom: 10 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sifre"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
            />
            E-postami hatirla
          </label>

          <button
            onClick={handleCredentialsLogin}
            disabled={loading}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fafafa", fontWeight: 700, cursor: "pointer" }}
          >
            {loading ? "Giris yapiliyor..." : "Giris"}
          </button>
        </div>

        <div style={{ marginBottom: 18, textAlign: "right" }}>
          <Link href="/forgot-password">Sifremi unuttum</Link>
        </div>

        {googleEnabled || appleEnabled || linkedinEnabled ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 18px" }}>
              <div style={{ height: 1, background: "#e5e7eb", flex: 1 }} />
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>VEYA</span>
              <div style={{ height: 1, background: "#e5e7eb", flex: 1 }} />
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {googleEnabled ? (
                <SocialButton label="Google ile Giris" onClick={() => handleSocial("google")}>
                  <GoogleIcon />
                </SocialButton>
              ) : null}

              {appleEnabled ? (
                <SocialButton label="Apple ile Giris" onClick={() => handleSocial("apple")}>
                  <AppleIcon />
                </SocialButton>
              ) : null}

              {linkedinEnabled ? (
                <SocialButton label="LinkedIn ile Giris" onClick={() => handleSocial("linkedin")}>
                  <LinkedInIcon />
                </SocialButton>
              ) : null}
            </div>
          </>
        ) : null}

        {message ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
            {message}
          </div>
        ) : null}

        <div style={{ marginTop: 18, opacity: 0.8 }}>
          Hesabin yok mu? <Link href="/register">Kayit ol</Link>
        </div>
      </div>
    </div>
  );
}