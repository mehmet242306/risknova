export default function Page() {
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Saha Denetimi</h1>
      <p style={{ opacity: 0.8, lineHeight: 1.6 }}>Saha taramasinda tespit edilen risklerin, checklist'lerin ve saha denetim formlarinin toplandigi alan.</p>

      <div style={{ marginTop: 16, padding: 14, border: "1px solid #eee", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Yakında</div>
        <ul style={{ lineHeight: 1.8, opacity: 0.85 }}>
          <li>Saha taramasi ile bulunan risklerin tek ekranda listelenmesi</li>
          <li>Saha denetimi icin checklist ve form olusturma akisi</li>
          <li>Kayit, gozden gecirme ve raporlama omurgasi</li>
        </ul>
      </div>
    </div>
  );
}
