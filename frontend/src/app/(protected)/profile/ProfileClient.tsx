"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

type ProfileUser = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  smsNotificationsEnabled: boolean;
  recoveryPhoneEnabled: boolean;
  role: string;
  createdAt: string;
};

export default function ProfileClient({ initialUser }: { initialUser: ProfileUser }) {
  const [name, setName] = useState(initialUser.name || "");
  const [phone, setPhone] = useState(initialUser.phone || "");
  const [smsNotificationsEnabled, setSmsNotificationsEnabled] = useState(
    initialUser.smsNotificationsEnabled
  );
  const [recoveryPhoneEnabled, setRecoveryPhoneEnabled] = useState(
    initialUser.recoveryPhoneEnabled
  );
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          smsNotificationsEnabled,
          recoveryPhoneEnabled,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.message || "Profil guncellenemedi.");
        setLoading(false);
        return;
      }

      setMessage(data.message || "Profil guncellendi.");
    } catch {
      setMessage("Baglanti hatasi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 18,
          padding: 18,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Profil Bilgileri</div>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ad Soyad"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <input
            value={initialUser.email || ""}
            readOnly
            placeholder="Email"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", background: "#fafafa" }}
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefon (opsiyonel)"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={smsNotificationsEnabled}
              onChange={(e) => setSmsNotificationsEnabled(e.target.checked)}
            />
            SMS bildirimlerini aktif et
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={recoveryPhoneEnabled}
              onChange={(e) => setRecoveryPhoneEnabled(e.target.checked)}
            />
            Telefonu hesap kurtarma icin kullan
          </label>

          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #eee",
              background: "#fafafa",
              lineHeight: 1.7,
              fontSize: 14,
            }}
          >
            Rol: {initialUser.role}
            <br />
            Hesap olusturma: {new Date(initialUser.createdAt).toLocaleString("tr-TR")}
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#fafafa",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Kaydediliyor..." : "Profili Kaydet"}
          </button>

          {message ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid #eee",
                background: "#fafafa",
              }}
            >
              {message}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 18,
          padding: 18,
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>Oturum</div>

        <button
          onClick={handleLogout}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fafafa",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Oturumu Kapat
        </button>
      </div>
    </div>
  );
}