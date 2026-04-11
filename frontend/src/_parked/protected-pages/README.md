# Parked Protected Pages

Bu klasor, canli urunde menude veya aktif route aginda yer almamasi gereken ancak ileride yeniden degerlendirilebilecek korumali sayfalari tutar.

## Park etme kurali

- Sayfa aktif `app/(protected)` altindan cikartilir.
- Kod silinmez; bu klasorde korunur.
- Geri alinacaksa once veri kaynagi, tema uyumu ve urun rolu netlestirilir.

## Park edilen moduller

| Modul | Durum | Park nedeni | Onerilen geri donus yolu |
| --- | --- | --- | --- |
| `actions` | Konsept | Mock veri ve eski inline stil dili | `tasks` ile birlestir veya yeni gorev merkezi olarak yeniden kur |
| `archives` | Konsept | Uygulama kabugundan kopuk, urun rolu belirsiz | `documents` veya `reports` altinda arsiv gorunumu olarak ele al |
| `calendar` | Konsept | Mock veri, eski tema | `planner` icine moduler takvim olarak tasin |
| `deadline-tracking` | Placeholder | Urunlesmemis basit sayfa | `tasks` veya `planner` icine deadline paneli olarak ekle |
| `document-create` | Placeholder | Ayrik akis, `documents` ile cakisma riski | `documents/new` akisi icinde erit |
| `emergency` | Konsept | Mock veri ve ayri gorunus dili | Acil durum modulune veri modeliyle yeniden alin |
| `field-audit` | Konsept | Mock veri, temadan kopuk | `findings` ve `photo-findings` ile tek denetim modulu olarak birlestir |
| `findings` | Placeholder | Tek basina zayif, urun akisi net degil | `incidents` veya denetim modulu altina tasin |
| `hazard-library` | Placeholder | Erken asama bilgi mimarisi | Risk kutuphanesi olarak `risk-analysis` altina tasin |
| `locations` | Placeholder | Veri modeli/rolu belirsiz | `companies` veya operasyon ayarlari altina tasin |
| `medical-schedule` | Placeholder | Ayrik ama zayif akis | `health` modulu icine planlama ekrani olarak tasin |
| `r-skor-2d` | Placeholder | Tekil sayfa, urun butunlugune oturmuyor | `reports` veya `score-history` icinde eritmeyi degerlendir |
| `rham` | Placeholder | Erken asama/tek ekran | `risk-analysis` altinda ozel metodoloji sekmesi olarak ele al |
| `templates` | Konsept | Mock veri, eski arayuz | `documents` ve `training` ile ortak sablon merkezi olarak yeniden kur |
| `trend` | Placeholder | Tek ekran, analitik butunlugune bagli degil | `reports` veya `executive-summary` altina tasin |
| `workflow` | Konsept | Mock veri, eski tasarim | Gorev/approval motoru olarak ayri backlog maddesi yap |

## Canliya donus kontrol listesi

- Gercek veri kaynagi Supabase veya server tarafinda net olsun
- Mevcut tema tokenlari ve shell yapisi kullanilsin
- Mobil/tablet kirilimlari kontrol edilsin
- Aktif modullerle cakisma varsa birlestirme karari verilsin
- Menuye girmeden once rol ve yetki kapsami netlestirilsin
