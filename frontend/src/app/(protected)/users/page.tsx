export default function Page() {
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Kullanıcılar & Roller</h1>
      <p style={{ opacity: 0.8, lineHeight: 1.6 }}>Uzman / Hekim / DSP rolleri ve yetki matrisi.</p>

      <div style={{ marginTop: 16, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Yakında</div>
        <ul style={{ lineHeight: 1.8, opacity: 0.85 }}>
          <li>Bu modülün UI taslağı</li>
          <li>İş akışı (create → review → export)</li>
          <li>Veri modeli ve kayıt/versiyonlama</li>
        </ul>
      </div>
    </div>
  );
}
