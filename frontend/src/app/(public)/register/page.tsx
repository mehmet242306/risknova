"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Kayit basarisiz.");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setMessage("Hesap olustu. Simdi giris yap.");
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setMessage("Baglanti hatasi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "calc(100vh - 120px)", display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, border: "1px solid #eee", borderRadius: 20, padding: 24, background: "#fff" }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Kayit Ol</h1>
        <p style={{ opacity: 0.75, lineHeight: 1.7, marginBottom: 18 }}>
          Yeni hesabini olustur. Telefon ve SMS ayarlarini daha sonra profilinden ekleyebileceksin.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ad Soyad"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />
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
            placeholder="Sifre (en az 8 karakter)"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <button
            onClick={handleRegister}
            disabled={loading}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #ddd", background: "#fafafa", fontWeight: 700, cursor: "pointer" }}
          >
            {loading ? "Kaydediliyor..." : "Hesap Olustur"}
          </button>
        </div>

        {message ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
            {message}
          </div>
        ) : null}

        <div style={{ marginTop: 18, opacity: 0.8 }}>
          Zaten hesabin var mi? <Link href="/login">Giris yap</Link>
        </div>
      </div>
    </div>
  );
}