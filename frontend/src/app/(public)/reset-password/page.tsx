"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Sifre yenilenemedi.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setMessage(data.message || "Sifre basariyla yenilendi.");
    } catch {
      setMessage("Islem su anda tamamlanamadi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "calc(100vh - 120px)", display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, border: "1px solid #eee", borderRadius: 20, padding: 24, background: "#fff" }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Sifre Yenile</h1>
        <p style={{ opacity: 0.75, lineHeight: 1.7, marginBottom: 18 }}>
          Email adresinizi, mail ile gelen kodu ve yeni sifrenizi girin.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Mail ile gelen kod"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Yeni sifre"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Yeni sifre tekrar"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fafafa", fontWeight: 700, cursor: "pointer" }}
          >
            {loading ? "Sifre yenileniyor..." : "Sifreyi Yenile"}
          </button>
        </div>

        {message ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #eee", background: success ? "#f0fdf4" : "#fafafa" }}>
            {message}
          </div>
        ) : null}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/forgot-password">Kod gonder</Link>
          <Link href="/login">Giris sayfasina don</Link>
        </div>
      </div>
    </div>
  );
}