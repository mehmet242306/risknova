"use client";

import { useState } from "react";
import {
  BookOpen, ChevronDown, ChevronUp, GitBranch, HelpCircle, Network, Link as LinkIcon,
  Target, Building2, Activity, AlertCircle, CheckCircle2, Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Yöntem rehber metaları                                             */
/* ------------------------------------------------------------------ */

interface MethodGuide {
  key: string;
  label: string;
  icon: typeof GitBranch;
  color: string;
  bestFor: string;
  example: string;
  badge?: string;
}

const METHOD_GUIDES: MethodGuide[] = [
  {
    key: "r2d_rca",
    label: "R₂D-RCA",
    icon: Activity,
    color: "#e05a7a",
    badge: "RiskNova Özel · Önerilen",
    bestFor: "Sayısal, tekrarlanabilir ölçüm. AI destekli skorlama. Sürekli izleme & dijital ikiz entegrasyonu.",
    example: "Bir tezgahta 6 ay boyunca operatör müdahaleleri artıyor; risk profili hangi boyutta bozulmuş? AI 9 boyutta t₀/t₁ üretip karşılaştırır, override eşiğini geçen birincil kök nedeni bulur.",
  },
  {
    key: "ishikawa",
    label: "Ishikawa (Balık Kılçığı)",
    icon: GitBranch,
    color: "#d4a017",
    bestFor: "Çok faktörlü olaylar, ekip beyin fırtınası, görsel sınıflandırma (6M).",
    example: "Üretim hattında ürün hatası artmış; insan/makine/metot/malzeme/ölçüm/çevre kategorilerinde olası nedenleri görselleştirip ekiple tartışmak.",
  },
  {
    key: "five_why",
    label: "5 Neden (5 Why)",
    icon: HelpCircle,
    color: "#5a9ee0",
    bestFor: "Tek odaklı, hızlı kök neden tespiti. Basit nedensel zincirler.",
    example: "Hidrolik pres yağı sızdırıyor → Neden? Conta yıpranmış → Neden? Periyodik bakım yapılmamış → Neden? Bakım planı eksik → Kök neden: Bakım yönetim sistemi yok.",
  },
  {
    key: "fault_tree",
    label: "Hata Ağacı (FTA)",
    icon: Network,
    color: "#5ae0a0",
    bestFor: "Karmaşık sistemler, mantıksal koşullar (VE/VEYA), olasılık analizi.",
    example: "Patlama riski analizi: 'Yangın olur' üst olayı için VE/VEYA kapılarıyla 'Kıvılcım kaynağı', 'Yanıcı atmosfer', 'Havalandırma yok' gibi temel olayları haritalamak.",
  },
  {
    key: "scat",
    label: "SCAT (Bird Modeli)",
    icon: LinkIcon,
    color: "#e0a05a",
    bestFor: "Klasik İSG kaza soruşturması. Anlık → temel → sistemik neden zinciri.",
    example: "İş kazası sonrası: anlık olay (düşme), anlık nedenler (kaygan zemin), temel nedenler (eğitim eksikliği), kontrol eksiklikleri (denetim prosedürü yok).",
  },
  {
    key: "bow_tie",
    label: "Bow-Tie (Kelebek)",
    icon: Target,
    color: "#5ae0e0",
    bestFor: "Tehlike + bariyer odaklı analiz. Yüksek riskli iş, proses güvenliği.",
    example: "Kimyasal sızıntı için: tehditler (vana arızası, basınç), önleyici bariyerler (alarm, vana periyodik testi), sonuçlar (yaralanma, yangın), hafifletici bariyerler (acil müdahale, sprinkler).",
  },
  {
    key: "mort",
    label: "MORT",
    icon: Building2,
    color: "#a05ae0",
    bestFor: "Yönetim sistemi zafiyetleri. Büyük olay sonrası organizasyonel analiz.",
    example: "Büyük çaplı kaza sonrası: yönetim gözetim eksikliği, politika boşlukları, denetim sistemi başarısızlıkları ve çıkarılan dersleri kategorize eder.",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface RcaIntroPanelProps {
  /** Başlangıçta açık mı? */
  defaultOpen?: boolean;
}

export function RcaIntroPanel({ defaultOpen = false }: RcaIntroPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card aria-label="Kök neden analizi rehber paneli">
      <CardHeader
        className="cursor-pointer pb-3 transition-colors hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <BookOpen className="size-4 text-amber-700 dark:text-amber-400" />
            </span>
            <div>
              <CardTitle className="text-sm">Kök neden analizi rehberi</CardTitle>
              <CardDescription className="text-xs">
                Yöntemlerin ne işe yaradığını, ne zaman seçeceğinizi ve örnek senaryoları gözden geçirin
              </CardDescription>
            </div>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground"
            aria-label={open ? "Rehberi kapat" : "Rehberi aç"}
          >
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-5 border-t border-border pt-4">
          {/* 1. Tanım */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-600" />
              <h4 className="text-sm font-semibold text-foreground">Kök Neden Analizi Nedir?</h4>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Olayın <strong className="text-foreground">yüzeysel sebebini</strong> değil, gerçekleşmesini tetikleyen
              <strong className="text-foreground"> yapısal/sistemik nedenleri</strong> bulmaya yönelik sistematik bir
              tekniktir. Doğru uygulandığında <em>aynı tip olayın tekrarını önler</em>, yalnızca semptomu değil hastalığı
              tedavi eder. ISG'de 6331 sayılı Kanun ve ISO 45001 her olay için kök neden çalışmasını zorunlu kılar.
            </p>
          </section>

          {/* 2. Ne zaman kullanılır */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="size-4 text-orange-600" />
              <h4 className="text-sm font-semibold text-foreground">Ne Zaman Kullanılır?</h4>
            </div>
            <ul className="ml-4 space-y-1.5 text-sm leading-6 text-muted-foreground">
              <li>• <strong className="text-foreground">İş kazası</strong> veya <strong className="text-foreground">ramak kala</strong> sonrası — yasal zorunluluk</li>
              <li>• <strong className="text-foreground">Tekrarlayan uygunsuzluklar</strong> — aynı sorun ısrarla geri geliyor</li>
              <li>• <strong className="text-foreground">Yüksek riskli süreçlerin</strong> proaktif değerlendirmesi (yangın, kimyasal, yüksekte çalışma)</li>
              <li>• <strong className="text-foreground">Denetim/müşteri geri bildirimi</strong> sonrası sistemik düzeltme</li>
              <li>• <strong className="text-foreground">Meslek hastalığı</strong> şüphesi — uzun vadeli maruziyet zinciri</li>
            </ul>
          </section>

          {/* 3. Yöntem karşılaştırma */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-foreground">7 Yöntem · Hangi Durumda Hangisi?</h4>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {METHOD_GUIDES.map((g) => {
                const Icon = g.icon;
                return (
                  <div
                    key={g.key}
                    className="rounded-xl border border-border p-3 transition-colors hover:bg-muted/30"
                    style={{ borderLeftWidth: 3, borderLeftColor: g.color }}
                  >
                    <div className="mb-1.5 flex items-start gap-2">
                      <span
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${g.color}20` }}
                      >
                        <Icon className="size-3.5" style={{ color: g.color }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h5 className="text-sm font-semibold text-foreground">{g.label}</h5>
                          {g.badge && (
                            <Badge variant="warning" className="text-[9px]">
                              {g.badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
                      <strong className="text-foreground">En iyi:</strong> {g.bestFor}
                    </p>
                    <p className="mt-1.5 rounded-lg bg-muted/40 p-2 text-[11px] leading-5 text-muted-foreground">
                      <strong className="text-foreground">Örnek:</strong> {g.example}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. Karar yardımı */}
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb className="size-4 text-amber-700" />
              <h4 className="text-sm font-semibold text-foreground">Karar İpuçları</h4>
            </div>
            <ul className="ml-4 space-y-1.5 text-[12px] leading-5 text-muted-foreground">
              <li>• <strong className="text-foreground">Hızlı tespit istiyorsan</strong> → 5 Neden veya R₂D-RCA</li>
              <li>• <strong className="text-foreground">Ekip beyin fırtınası yapacaksan</strong> → Ishikawa</li>
              <li>• <strong className="text-foreground">Karmaşık nedensel ilişki var</strong> (VE/VEYA, koşullar) → FTA</li>
              <li>• <strong className="text-foreground">Klasik İSG kazası</strong> (düşme, çarpma) → SCAT</li>
              <li>• <strong className="text-foreground">Yüksek riskli iş + bariyer analizi</strong> → Bow-Tie</li>
              <li>• <strong className="text-foreground">Büyük olay + organizasyonel analiz</strong> → MORT</li>
              <li>• <strong className="text-foreground">Sürekli izleme + sayısal karşılaştırma</strong> → R₂D-RCA (RiskNova özel)</li>
            </ul>
          </section>

          {/* 5. Süreç */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Network className="size-4 text-blue-600" />
              <h4 className="text-sm font-semibold text-foreground">Tipik Süreç</h4>
            </div>
            <ol className="ml-4 space-y-1.5 text-sm leading-6 text-muted-foreground">
              <li><strong className="text-foreground">1.</strong> Olayı net tanımla (firma, lokasyon, tarih, kim/ne/nerede/nasıl)</li>
              <li><strong className="text-foreground">2.</strong> Uygun yöntemi seç (yukarıdaki ipuçlarını kullan)</li>
              <li><strong className="text-foreground">3.</strong> AI ile ilk taslağı üret veya manuel doldur</li>
              <li><strong className="text-foreground">4.</strong> Ekiple gözden geçir, eksikleri ekle</li>
              <li><strong className="text-foreground">5.</strong> Kök nedeni netleştir → DÖF (Düzeltici/Önleyici Faaliyet) planını oluştur</li>
              <li><strong className="text-foreground">6.</strong> PDF rapor üret, paylaş (QR kod ile mobil erişim)</li>
              <li><strong className="text-foreground">7.</strong> Takip et: aksiyonların kapanma süresi + tekrarın önlenmesi</li>
            </ol>
          </section>
        </CardContent>
      )}
    </Card>
  );
}
