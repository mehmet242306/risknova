"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setMessage(data.message || "Kod gonderim islemi tamamlandi.");
    } catch {
      setMessage("Islem su anda tamamlanamadi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "calc(100vh - 120px)", display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, border: "1px solid #eee", borderRadius: 20, padding: 24, background: "#fff" }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Sifremi Unuttum</h1>
        <p style={{ opacity: 0.75, lineHeight: 1.7, marginBottom: 18 }}>
          E-posta adresinizi girin. Hesabiniz varsa sifre sifirlama kodu gonderilecektir.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fafafa", fontWeight: 700, cursor: "pointer" }}
          >
            {loading ? "Kod gonderiliyor..." : "Kodu Gonder"}
          </button>
        </div>

        {message ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
            {message}
          </div>
        ) : null}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/reset-password">Kodum var, sifreyi yenile</Link>
          <Link href="/login">Giris sayfasina don</Link>
        </div>
      </div>
    </div>
  );
}