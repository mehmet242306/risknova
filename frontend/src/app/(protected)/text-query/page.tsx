export default function Page() {
  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Mevzuat Asistanı</h1>
      <p style={{ opacity: 0.8, lineHeight: 1.7 }}>Mevzuat, rehber ve uygulama mantığına dayalı soru-cevap ve resmi metin önerileri bu modülde sunulur.</p>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid #eee", borderRadius: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Bu modülde olacaklar</div>
        <ul style={{ lineHeight: 1.9, opacity: 0.85 }}>
          <li>Temel ekran yerleşimi</li>
          <li>İş akışı adımları</li>
          <li>Veri alanları</li>
          <li>AI destek noktaları</li>
        </ul>
      </div>
    </div>
  );
}
