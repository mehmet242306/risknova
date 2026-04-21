export default function OsgbAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          OSGB Duyurular
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          İç iletişim ve operasyon notları
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          OSGB yöneticisi hesap geneli veya firma hedefli duyurular yayınlar. Bu
          yapı saha ekiplerine bildirim, belge hatırlatma ve kritik aksiyon çağrısı
          göndermek için kullanılmalıdır.
        </p>
      </div>
    </div>
  );
}
