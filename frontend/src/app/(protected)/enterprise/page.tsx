import Link from "next/link";

export default function EnterprisePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-[2rem] border border-border bg-card p-8 shadow-[var(--shadow-elevated)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Kurumsal Çözüm
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          Talebinizi aldık
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Enterprise akışı şu aşamada self-service açılmıyor. Ekibimiz kurum yapınızı,
          lokasyon sayınızı ve özel ihtiyaçlarınızı değerlendirip size dönüş yapacak.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          title="Çok lokasyon"
          description="Birden fazla saha, işletme veya organizasyon yapısı için özel modelleme."
        />
        <InfoCard
          title="Özel entegrasyon"
          description="BIM, dijital ikiz, mevzuat ve kurum içi veri akışları için uyarlanabilir kurulum."
        />
        <InfoCard
          title="Özel fiyatlama"
          description="Sabit self-service paket yerine kurum yapısına göre teklif hazırlanır."
        />
      </div>

      <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-foreground">Sonraki adım</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          İstersen bu sırada mevcut ürün yüzeylerini inceleyebilir ya da ekibinle paylaşmak için yönetim paneline dönebilirsin.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/companies"
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Firmalar ekranı
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground"
          >
            Panele dön
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
