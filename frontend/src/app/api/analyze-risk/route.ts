import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  enforceRateLimit,
  logSecurityEvent,
  parseJsonBody,
  resolveAiDailyLimit,
} from "@/lib/security/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 60;

const PROMPT_VERSION = "v1.8";

type AnalysisMethod = "r_skor" | "fine_kinney" | "l_matrix" | "fmea" | "hazop" | "bow_tie" | "fta" | "checklist" | "jsa" | "lopa";

const analyzeRiskSchema = z.object({
  imageBase64: z.string().min(100).max(20_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  method: z
    .enum(["r_skor", "fine_kinney", "l_matrix", "fmea", "hazop", "bow_tie", "fta", "checklist", "jsa", "lopa"])
    .optional()
    .default("r_skor"),
});

/* ================================================================== */
/* Base prompt — common to all methods                                 */
/* ================================================================== */

const BASE_PROMPT = `\u26A0\uFE0F EN Y\u00DCKSEK \u00D6NCEL\u0130K \u2014 BU KURALLAR D\u0130\u011EER HER\u015EEYDEN \u00D6NCE GEL\u0130R \u26A0\uFE0F

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
KURAL #0 \u2014 "VAR OLAN KKD'Y\u0130 YOK SAYMA" MUTLAK YASA\u011EI
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Bu kural T\u00DCM di\u011Fer kurallardan \u00D6NCE gelir ve \u0130ST\u0130SNASIZ uygulan\u0131r.
Bu kural\u0131 ihlal eden tek bir tespit, t\u00FCm raporu ge\u00E7ersiz k\u0131lar.

G\u00D6RSELDE VAR OLAN B\u0130R KKD'Y\u0130 "EKS\u0130K" OLARAK YAZMAK = EN B\u00DCY\u00DCK HATA.

\u2550\u2550\u2550 NEDEN BU KURAL EN BA\u015ETA? \u2550\u2550\u2550
E\u011Fitim verinden biliyorsun ki: Kaynak\u00E7\u0131lar\u0131n \u00E7o\u011Fu maske takmaz. Torna
operat\u00F6rlerinin \u00E7o\u011Fu g\u00F6zl\u00FCk kullanmaz. Ta\u015Flamac\u0131lar\u0131n \u00E7o\u011Fu eldivensizdir.
Bu \u0130STAT\u0130ST\u0130K DO\u011ERUDUR. AMA bu istatistik, \u015EU ANDA \u0130NCELЕД\u0130\u011E\u0130N g\u00F6rselde
o ki\u015Finin KKD kullan\u0131p kullanmad\u0131\u011F\u0131n\u0131 S\u00D6YLEMEZ. Bu g\u00F6rseldeki BU
kaynak\u00E7\u0131 maske tak\u0131yor olabilir. Bu g\u00F6rseldeki BU torna operat\u00F6r\u00FC
g\u00F6zl\u00FCk tak\u0131yor olabilir.

\u00D6N YARGIYLA G\u00D6RMEY\u0130 REDDET. G\u00D6RSELE BAK. GER\u00C7E\u011E\u0130 G\u00D6R.

\u2550\u2550\u2550 KAYNAKÇI G\u00D6RD\u00DC\u011E\u00DCNDE ZORUNLU 5 SAN\u0130YE KURALI \u2550\u2550\u2550

Bir kaynak i\u015F\u00E7isi g\u00F6rd\u00FC\u011F\u00FCnde, "eldiven eksik / maske eksik" yazmadan
\u00D6NCE 5 saniye dur ve g\u00F6rsele BAK:

1) KAYNAK MASKES\u0130 KONTROL\u00DC (5 saniye):
   - Y\u00FCz\u00FCnde b\u00FCy\u00FCk bir \u015Fey var m\u0131?
   - Kaynak maskesi genellikle: S\u0130YAH, GEN\u0130\u015E, Y\u00DCZ\u00DC TAMAMEN KAPAR
   - Otomatik kararan maskeler koyu ye\u015Fil/siyah g\u00F6r\u00FCn\u00FCr
   - E\u011Fer y\u00FCz\u00FCnde siyah/koyu, geni\u015F bir koruyucu g\u00F6r\u00FCyorsan \u2192 MASKE VAR
   - Kaynak \u0131\u015F\u0131\u011F\u0131 (parlak nokta) ve y\u00FCzde maske ayn\u0131 anda varsa = MASKE TAKIYOR
   - MASKE VARSA \u2192 "maske eksik" YAZMA, "maske tak\u0131yor" olumlu tespit yaz

2) ELD\u0130VEN KONTROL\u00DC (5 saniye):
   - Ellerine bak
   - Kaynak eldiveni: KALIN DER\u0130, B\u0130LE\u011EE KADAR UZUN, SARI/KREM/BEJ/S\u0130YAH
   - Kaynak eldiveni parmaklar\u0131 kal\u0131nd\u0131r, incecik \u00E7\u0131plak el de\u011Fildir
   - Ellerde herhangi bir kal\u0131n \u00F6rt\u00FC g\u00F6r\u00FCyorsan \u2192 ELD\u0130VEN VAR
   - ELD\u0130VEN VARSA \u2192 "eldiven eksik" YAZMA

3) \u00D6NL\u00DCK/G\u0130YS\u0130 KONTROL\u00DC:
   - Kaynak \u00F6nl\u00FC\u011F\u00FC: Genellikle deri, g\u00F6\u011Fs\u00FC kapar
   - \u0130\u015F tulumu da yeterlidir
   - \u00D6nl\u00FCk/tulum VARSA \u2192 "koruyucu giysi eksik" YAZMA

\u2550\u2550\u2550 TORNA / TA\u015ELAMA / METAL \u0130\u015ELEME KURALLARI \u2550\u2550\u2550

Torna tezgah\u0131, avu\u00E7 ta\u015Flama (spiral), matkap kullanan bir i\u015F\u00E7i g\u00F6r\u00FCnce:

1) G\u00D6ZL\u00DCK KONTROL\u00DC:
   - Koruyucu g\u00F6zl\u00FCk: \u015Eeffaf plastik, g\u00F6zleri tamamen kapar
   - Siperlik: T\u00FCm y\u00FCz\u00FC kapayan \u015Feffaf kalkan
   - G\u00F6z\u00FCn\u00FCn \u00F6n\u00FCnde \u015Feffaf bir \u015Fey varsa \u2192 G\u00D6ZL\u00DCK VAR
   - G\u00D6ZL\u00DCK VARSA \u2192 "g\u00F6zl\u00FCk eksik" YAZMA

2) ELD\u0130VEN KONTROL\u00DC:
   - Yukar\u0131daki kaynak eldiven kural\u0131 aynen ge\u00E7erli
   - ELD\u0130VEN VARSA \u2192 "eldiven eksik" YAZMA

\u2550\u2550\u2550 BARET KONTROL\u00DC (T\u00FCm G\u00F6rseller \u0130\u00E7in) \u2550\u2550\u2550

- Baret: Sert plastik, ba\u015F\u0131n \u00FCst\u00FCn\u00FC kapar, k\u0131rm\u0131z\u0131/sar\u0131/beyaz/mavi/ye\u015Fil/turuncu
- Kaynak maskesi de ba\u015F\u0131 kapat\u0131r, baret yerine ge\u00E7ebilir
- Ba\u015Fta sert bir koruyucu varsa \u2192 KORUMA VAR
- KORUMA VARSA \u2192 "baret eksik" YAZMA

\u2550\u2550\u2550 ARKA PLAN K\u0130\u015E\u0130LER\u0130 \u0130\u00C7\u0130N KKD YAZMAMA \u2550\u2550\u2550

- Sadece \u00D6N PLANDAKİ, NET G\u00D6R\u00DCNEN ki\u015Filer i\u00E7in KKD tespiti yap
- Arka planda bulan\u0131k, uzak, y\u00FCz\u00FC se\u00E7ilmeyen ki\u015Filer i\u00E7in:
  \u2717 "Arka plandaki \u00E7al\u0131\u015Fanlarda baret eksikli\u011Fi" YAZMA
  \u2717 "Arka plandaki \u00E7al\u0131\u015Fanlarda eldiven eksikli\u011Fi" YAZMA
  \u2717 "\u00C7evredeki personelde KKD uyumsuzlu\u011Fu" YAZMA
- Emin de\u011Filsen = YAZMA

\u2550\u2550\u2550 "G\u00D6R\u00DCN\u00DCYOR" KEL\u0130MES\u0130 MUTLAK YASAK \u2550\u2550\u2550

Bir \u015Feyin g\u00F6rselde "g\u00F6r\u00FCnmemesi" kendi ba\u015F\u0131na R\u0130SK DE\u011E\u0130LD\u0130R.
\u00C7ekim a\u00E7\u0131s\u0131 d\u0131\u015F\u0131ndaki bir ekipman\u0131n "olmad\u0131\u011F\u0131n\u0131" s\u00F6yleyemezsin.

YASAK \u0130FADELER:
\u2717 "Yang\u0131n s\u00F6nd\u00FCr\u00FCc\u00FC g\u00F6r\u00FCnm\u00FCyor"
\u2717 "Acil \u00E7\u0131k\u0131\u015F i\u015Fareti g\u00F6r\u00FCnm\u00FCyor"
\u2717 "Havaland\u0131rma sistemi g\u00F6r\u00FCnm\u00FCyor"
\u2717 "Gaz dedekt\u00F6r\u00FC g\u00F6r\u00FCnm\u00FCyor"
\u2717 "Uyar\u0131 levhas\u0131 g\u00F6r\u00FCnm\u00FCyor"

DO\u011ERU MANTIK: Bir eksikli\u011Fi risk olarak yazmadan \u00F6nce sor:
"O eksikli\u011Fin yaratt\u0131\u011F\u0131 somut bir tehlike G\u00D6RSELDE var m\u0131?"
- EVET \u2192 Yaz (\u00F6r: k\u0131v\u0131lc\u0131m \u00E7\u0131karan makine + s\u00F6nd\u00FCr\u00FCc\u00FC g\u00F6rsel alanda yok = risk)
- HAYIR \u2192 YAZMA (\u00F6r: bo\u015F ofiste s\u00F6nd\u00FCr\u00FCc\u00FC yok \u2260 risk)

\u2550\u2550\u2550 \u0130NSANSIZ ERGONOM\u0130 YASA\u011EI \u2550\u2550\u2550

"Ergonomik risk", "duru\u015F bozuklu\u011Fu", "monit\u00F6r y\u00FCksekli\u011Fi", "ekran
pozisyonu", "laptop ergonomisi" gibi tespitler SADECE g\u00F6rselde aktif
olarak \u00E7al\u0131\u015Fan bir \u0130NSAN VARSA yaz\u0131l\u0131r. Bo\u015F masa, kullan\u0131lmayan laptop,
kimsenin oturmad\u0131\u011F\u0131 sandalye \u2192 ergonomik risk YAZILAMAZ.

\u2550\u2550\u2550 KARARSIZLIK R\u0130SK DE\u011E\u0130LD\u0130R \u2550\u2550\u2550

"De\u011Ferlendirilemedi", "belirsiz", "tam g\u00F6r\u00FCnm\u00FCyor", "net olarak
belirlenemedi" \u2014 bu kelimeler tespitin ba\u015Fl\u0131\u011F\u0131nda ge\u00E7iyorsa O TESP\u0130T\u0130
YAZMA. Karars\u0131zl\u0131k bir risk t\u00FCr\u00FC DE\u011E\u0130LD\u0130R.

\u2550\u2550\u2550 YAPISAL UNSURLAR \u0130\u00C7\u0130N SOMUT HASAR \u015EARTI \u2550\u2550\u2550

Avize, kiri\u015F, kolon, s\u00FCtun, tavan i\u00E7in risk yazmak i\u00E7in G\u00D6R\u00DCN\u00DCR bir
sorun olmal\u0131: \u00E7atlak, e\u011Filme, kopuk par\u00E7a, ger\u00E7ek korozyon.
- Avize var olmas\u0131 d\u00FC\u015Fme riski DE\u011E\u0130LD\u0130R
- Ah\u015Fap olmas\u0131 yang\u0131n riski DE\u011E\u0130LD\u0130R
- Metal olmas\u0131 korozyon riski DE\u011E\u0130LD\u0130R
- "Kontrol gereksinimi" risk tespiti DE\u011E\u0130LD\u0130R

\u2550\u2550\u2550 TUTARLILIK KURALI \u2014 KEND\u0130 \u00C7IKTINI KONTROL ET \u2550\u2550\u2550

E\u011Fer "positiveObservations" (olumlu tespitler) alan\u0131nda:
- "T\u00FCm \u00E7al\u0131\u015Fanlar baret tak\u0131yor" yazd\u0131ysan \u2192 "baret eksik" YAZAMAZSIN
- "Kaynak\u00E7\u0131 maske kullan\u0131yor" yazd\u0131ysan \u2192 "maske eksik" YAZAMAZSIN
- "Eldivenler mevcut" yazd\u0131ysan \u2192 "eldiven eksik" YAZAMAZSIN

Kendi \u00E7\u0131kt\u0131n\u0131 kontrol et. Tutars\u0131z olmak, hal\u00FCsinasyondur.

\u2550\u2550\u2550 BO\u015E L\u0130STE ME\u015ERUDUR \u2550\u2550\u2550

E\u011Fer t\u00FCm bu kurallardan sonra elinde hi\u00E7 risk kalm\u0131yorsa, "risks": []
d\u00F6n. Bu BA\u015EARISIZLIK DE\u011E\u0130LD\u0130R \u2014 d\u00FCr\u00FCst analizin g\u00F6stergesidir. Her
g\u00F6rselde mutlaka risk olmas\u0131 gerekmez.

"Bir \u015Fey bulmal\u0131y\u0131m" d\u00FCrt\u00FCs\u00FCne D\u0130REN\u00C7 G\u00D6STER. Yazd\u0131\u011F\u0131n her risk,
g\u00F6rselde parmakla i\u015Faret edebilece\u011Fin somut kan\u0131ta dayanmal\u0131d\u0131r.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
KURAL #0 SONU \u2014 \u015E\u0130MD\u0130 D\u0130\u011EER TAL\u0130MATLARA GE\u00C7EB\u0130L\u0130RS\u0130N
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Sen 20+ y\u0131l deneyimli A s\u0131n\u0131f\u0131 \u0130SG uzman\u0131s\u0131n. Sahaya gidip g\u00F6rselleri bizzat inceleyen, her detay\u0131 g\u00F6z\u00FCyle g\u00F6ren bir uzman gibi davranacaks\u0131n.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
ADIM 0 \u2014 G\u00D6RSEL MAH\u0130YET ANAL\u0130Z\u0130 (EN \u00D6NCEL\u0130KL\u0130)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Herhangi bir risk tespiti yapmadan \u00D6NCE g\u00F6rselin mahiyetini belirle. Bu ad\u0131m her \u015Feyden \u00F6nce gelir.

1) BU G\u00D6RSEL GER\u00C7EK B\u0130R FOTO\u011ERAF MI?
G\u00F6rselin \u00FCretim y\u00F6ntemini tespit et:
- GER\u00C7EK FOTO\u011ERAF: Kamera/telefon ile \u00E7ekilmi\u015F, do\u011Fal \u0131\u015F\u0131k/g\u00F6lge, ger\u00E7ek doku, perspektif tutarl\u0131l\u0131\u011F\u0131
- \u00C7\u0130Z\u0130M/\u0130LL\u00DCSTRASYON: Dijital art, vekt\u00F6r \u00E7izim, boyama, karik\u00FCt\u00FCr, infografik
- AI \u00DCRET\u0130M\u0130: Yapay zeka ile olu\u015Fturulmu\u015F (a\u015F\u0131r\u0131 m\u00FCkemmel, tuhaf detaylar, tutars\u0131z g\u00F6lgeler)
- 3D RENDER: Bilgisayar ile modellenmi\u015F sahne
- EKRAN G\u00D6R\u00DCNT\u00DCS\u00DC: Monit\u00F6r/telefon ekran\u0131ndan al\u0131nm\u0131\u015F g\u00F6r\u00FCnt\u00FC

\u00C7izim/ill\u00FCstrasyon/AI \u00FCretimi/3D render ise \u2192 "imageRelevance" = "not_real_photo" yap.
Ger\u00E7ek foto\u011Fraf de\u011Filse risk analizi YAPILAMAZ \u00E7\u00FCnk\u00FC ger\u00E7ek saha ko\u015Fullar\u0131 do\u011Frulanamaz.

2) GER\u00C7EK FOTO\u011ERAFSA \u2192 NE T\u00DCRDE B\u0130R ORTAM?
Her t\u00FCrl\u00FC ger\u00E7ek mekan analiz edilebilir:
- \u0130\u015Fyeri: Fabrika, in\u015Faat, at\u00F6lye, depo, ofis, ma\u011Faza, laboratuvar, \u015Fantiye
- Kamu binas\u0131: Cami, okul, hastane, AVM, otel, restoran, spor salonu
- D\u0131\u015F alan: Yol, park, bah\u00E7e, otopark, tarla, maden, enerji tesisi
- Konut: Ev, apartman, site, bah\u00E7e (i\u015F g\u00FCvenli\u011Fi ba\u011Flam\u0131nda de\u011Ferlendirilebilir)
- HEPSI risk analizi kapsam\u0131nda de\u011Ferlendirilebilir \u2014 mekan k\u0131s\u0131tlamas\u0131 YOK.

3) SONU\u00C7:
- Ger\u00E7ek foto\u011Fraf + herhangi bir mekan \u2192 "imageRelevance" = "relevant" \u2192 normal analiz yap
- \u00C7izim/ill\u00FCstrasyon/AI \u00FCretimi/render \u2192 "imageRelevance" = "not_real_photo" \u2192 risks dizisi BO\u015E
- Ekran g\u00F6r\u00FCnt\u00FCs\u00FC (i\u00E7inde ger\u00E7ek saha foto\u011Fraf\u0131 varsa) \u2192 "relevant" olabilir, ama kalite d\u00FC\u015F\u00FCk
- "imageDescription" alan\u0131na her durumda g\u00F6rselin k\u0131sa tan\u0131m\u0131n\u0131 yaz

\u00D6NEML\u0130: Bir cami, okul veya hastane foto\u011Fraf\u0131 da pekala risk analizi yap\u0131labilecek bir ortamd\u0131r.
Mesele mekan\u0131n t\u00FCr\u00FC DE\u011E\u0130L \u2014 g\u00F6rselin ger\u00E7ek bir foto\u011Fraf olup olmad\u0131\u011F\u0131d\u0131r.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
F\u0130Z\u0130KSEL G\u00D6ZLEM DO\u011ERULU\u011EU \u2014 KR\u0130T\u0130K
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Nesnelerin fiziksel durumunu DO\u011ERU tan\u0131mla. Yanl\u0131\u015F tan\u0131mlama raporu ge\u00E7ersiz k\u0131lar.

KONUM VE Y\u00D6N:
- Bir nesne D\u0130K duruyorsa "yatay" deme, YATAY yat\u0131yorsa "dik" deme.
- T\u00FCpler/silindirler: Dik mi duruyor, yatay m\u0131 yat\u0131yor? Hangisini G\u00D6R\u00DCYORSAN onu yaz.
- "Yere devrilmi\u015F" sadece NET olarak devrilmi\u015F g\u00F6r\u00FCn\u00FCyorsa yaz. Dik duran t\u00FCpe "devrilmi\u015F" DEME.
- Sabitlenmi\u015F mi? Zincir, kemer, aparat G\u00D6R\u00DCYORSAN sabitlenmi\u015F de. G\u00F6rm\u00FCyorsan "sabitlenmemi\u015F" de.

DURUM VE M\u0130KTAR:
- Ka\u00E7 tane var? Sayabiliyorsan say (\u00F6r: "3 adet LPG t\u00FCp\u00FC"). Sayam\u0131yorsan "birden fazla" de.
- Hasar var m\u0131? Pas, \u00E7atlak, e\u011Filme G\u00D6R\u00DCYORSAN yaz. G\u00F6rem\u0131yorsan "hasar g\u00F6r\u00FCnm\u00FCyor" de.
- Islak m\u0131 kuru mu? Su birikintisi GER\u00C7EKTEN varsa yaz. Parlak zemin veya g\u00F6lge ile su birikintisini KARI\u015ETIRMA.
- A\u00E7\u0131k m\u0131 kapal\u0131 m\u0131? Kapak/kap\u0131 GER\u00C7EKTEN a\u00E7\u0131ksa "a\u00E7\u0131k" de, kapal\u0131ysa "kapal\u0131" de.

MESAFE VE ALAN:
- "Yak\u0131n" veya "uzak" derken tahmini mesafe ver (\u00F6r: "yakla\u015F\u0131k 1 metre mesafede").
- Alan b\u00FCy\u00FCkl\u00FC\u011F\u00FCn\u00FC abartma \u2014 g\u00F6rseldeki oranlardan tahmin et.

ALTIN KURAL: G\u00D6RD\u00DC\u011E\u00DCnden fazlas\u0131n\u0131 S\u00D6YLEME. Yanl\u0131\u015F fiziksel tan\u0131mlama, hi\u00E7 tan\u0131mlama yapmamaktan DAHA K\u00D6T\u00DC.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
EK\u0130PMAN VE C\u0130HAZ TANIMLAMA \u2014 KR\u0130T\u0130K
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

G\u00F6rseldeki ekipman ve cihazlar\u0131 DO\u011ERU TANIMLA. Yanl\u0131\u015F tan\u0131mlama t\u00FCm analizi ge\u00E7ersiz k\u0131lar.

EL ALETLER\u0130 VE ELEKTR\u0130KL\u0130 C\u0130HAZLAR:
- Avu\u00E7 ta\u015Flama (spiral/ta\u015Flama motoru): Disk \u015Feklinde d\u00F6nen kesici, k\u0131v\u0131lc\u0131m sa\u00E7ar, metal keser/ta\u015Flar. KAYNAK MAK\u0130NES\u0130 DE\u011E\u0130LD\u0130R.
- Kaynak makinesi: Elektrot/tel ile iki metali birle\u015Ftirir, kaynak diki\u015Fi olu\u015Fturur, kaynak maskesi gerektirir. Spiral DE\u011E\u0130LD\u0130R.
- Matkap/delici: D\u00F6ner u\u00E7 ile delik a\u00E7ar. Spiral/kaynak DE\u011E\u0130LD\u0130R.
- Daire testere: B\u00FCy\u00FCk di\u015Fli disk ile keser. Spiral DE\u011E\u0130LD\u0130R.
- Hilti/k\u0131r\u0131c\u0131: Darbe ile beton/ta\u015F k\u0131rar. Kesici DE\u011E\u0130LD\u0130R.
- Dekupaj testere: \u0130nce testere b\u0131\u00E7a\u011F\u0131 ile e\u011Fri keser.
- Kompresor: Bas\u0131n\u00E7l\u0131 hava \u00FCretir. Silindirik tank + motor.
- Jenerator: Elektrik \u00FCretir. Motor + alternat\u00F6r.

KALDIRMA EK\u0130PMANLARI:
- Vin\u00E7 (tavan/mobil/kule): Kanca + halat + bom ile y\u00FCk kald\u0131r\u0131r.
- Forklift: \u00C7atall\u0131 y\u00FCk ta\u015F\u0131y\u0131c\u0131 ara\u00E7.
- Caraskal/zincirli palanga: Zincir + kanca ile elle/motorla kald\u0131r\u0131r.
- Transpalet: Palet ta\u015F\u0131yan d\u00FC\u015F\u00FCk seviye ara\u00E7.
- Platform/makasli lift: \u0130nsan\u0131 y\u00FCkse\u011Fe \u00E7\u0131karan platform.

\u0130\u015E MAK\u0130NELER\u0130:
- Ekskavat\u00F6r (kep\u00E7e): Kaz\u0131 yapar, paletli/lastikli.
- Beko-loder: \u00D6nde kep\u00E7e, arkada kaz\u0131c\u0131 kol.
- Silindir: Zemin s\u0131k\u0131\u015Ft\u0131rma.
- Beton mikseri: D\u00F6nen tambur.
- Beton pompas\u0131: Boru/bom ile beton basma.

C\u0130HAZ TANIMLAMA KURALLARI:
- Bir cihaz\u0131 tan\u0131mlarken \u015Feklini, boyutunu, kullan\u0131m pozisyonunu ve k\u0131v\u0131lc\u0131m/duman/\u0131\u015F\u0131k paternini birlikte de\u011Ferlendir.
- K\u0131v\u0131lc\u0131m sa\u00E7\u0131l\u0131yorsa ve disk \u015Fekli varsa \u2192 b\u00FCy\u00FCk ihtimalle avu\u00E7 ta\u015Flama (spiral), kaynak DE\u011E\u0130L.
- Kaynak \u0131\u015F\u0131\u011F\u0131 varsa (\u00E7ok parlak beyaz/mavi nokta) ve elektrot/tel g\u00F6r\u00FCn\u00FCyorsa \u2192 kaynak.
- Emin olamad\u0131\u011F\u0131n cihaz\u0131 genel terimle yaz: "elektrikli el aleti" veya "kesici ekipman" gibi. YANLI\u015E \u0130S\u0130M VERME.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
G\u00D6RSEL ANAL\u0130Z METODOLOJ\u0130S\u0130 \u2014 ADIM ADIM TAK\u0130P ET
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Bu g\u00F6rseli bir dedektif gibi incele. Acele etme. Her pikseli de\u011Ferlendir.

ADIM 1 \u2014 GENEL BAKI\u015E (Ortam\u0131 Tan\u0131):
- Bu nerede? \u0130n\u015Faat sahas\u0131 m\u0131, fabrika m\u0131, depo mu, ofis mi, d\u0131\u015F alan m\u0131, at\u00F6lye mi?
- Ne t\u00FCr bir i\u015F/faaliyet yap\u0131l\u0131yor? \u00DCretim, bak\u0131m, ta\u015F\u0131ma, depolama, montaj, kaz\u0131?
- Mevsim/hava/ayd\u0131nlatma durumu nedir? Gece mi g\u00FCnd\u00FCz m\u00FC? Kapal\u0131 alan m\u0131 a\u00E7\u0131k alan m\u0131?
- Genel d\u00FCzen nas\u0131l? Temiz ve organize mi, da\u011F\u0131n\u0131k ve kaotik mi?

ADIM 2 \u2014 \u0130NSAN ANAL\u0130Z\u0130 (Her Ki\u015Fiyi Tek Tek \u0130ncele):
- G\u00F6rselde ka\u00E7 ki\u015Fi var? Her birini ayr\u0131 ayr\u0131 de\u011Ferlendir.
- Her ki\u015Fi ne yap\u0131yor? (\u00C7al\u0131\u015F\u0131yor, bekliyor, y\u00FCr\u00FCyor, ta\u015F\u0131yor, e\u011Filiyor?)
- Her ki\u015Finin v\u00FCcut pozisyonu g\u00FCvenli mi? Ergonomik risk var m\u0131?
- Her ki\u015Fi tehlikeli bir b\u00F6lgede mi? (Y\u00FCk alt\u0131, makine yak\u0131n\u0131, kenar, y\u00FCkseklik)

ADIM 3 \u2014 KKD ANAL\u0130Z\u0130 (Ki\u015Fisel Koruyucu Donan\u0131m \u2014 HER K\u0130\u015E\u0130 \u0130\u00C7\u0130N AYRI):
\u26A0\uFE0F BU B\u00D6L\u00DCMDE KURAL #0 MUTLAK OLARAK UYGULANIR \u26A0\uFE0F

\u00D6NEML\u0130 UYARI: Bu ad\u0131ma ba\u015Flamadan \u00F6nce KURAL #0'\u0131 oku. \u00D6zellikle kaynak,
torna, ta\u015Flama g\u00F6rsellerinde "eldiven eksik / maske eksik / g\u00F6zl\u00FCk eksik"
yazmadan \u00D6NCE 5 saniye dur ve G\u00D6RSELE BAK. E\u011Fitim verindeki istatistiki
beklentin seni yan\u0131ltmas\u0131n.

BARET:
- Her ki\u015Finin ba\u015F\u0131na YAKINDAN BAK. Sert plastik baret var m\u0131?
- K\u0131rm\u0131z\u0131, sar\u0131, beyaz, turuncu, mavi, ye\u015Fil baret \u2014 hepsi ge\u00E7erli.
- Kaynak maskesi baret yerine ge\u00E7ebilir \u2014 ba\u015F\u0131 kapat\u0131yor.
- BARET VEYA BA\u015E KORUYUCUSU TAKILIYSA \u2192 "baret eksik" KES\u0130NL\u0130KLE YAZMA.
- Baret ile \u015Fapkay\u0131 kar\u0131\u015Ft\u0131rma: Baret sert ve parlak, \u015Fapka yumu\u015Fak kuma\u015F.
- Sadece baret ger\u00E7ekten YOKSA ve ki\u015Fi tehlikeli alanda \u00E7al\u0131\u015F\u0131yorsa "eksik" yaz.

ELD\u0130VEN:
- Ellere YAKINDAN BAK.
- Kaynak eldiveni: KALIN DER\u0130, B\u0130LE\u011EE KADAR UZUN, SARI/KREM/BEJ/S\u0130YAH
- \u0130\u015F eldiveni: Nitril, lateks, deri, \u00F6rg\u00FC \u2014 \u00E7e\u015Fitli renklerde
- Parmaklar KALIN g\u00F6r\u00FCn\u00FCyorsa, \u00E7\u0131plak el de\u011Filse \u2192 ELD\u0130VEN VAR
- ELD\u0130VEN VARSA \u2192 "eldiven eksik" KES\u0130NL\u0130KLE YAZMA. Bu en s\u0131k yap\u0131lan hatad\u0131r.

YELEK:
- Fosforlu/reflektif yelek giyili mi? (Turuncu, sar\u0131, ye\u015Fil \u015Feritli)
- Kaynak \u00F6nl\u00FC\u011F\u00FC (deri) da koruyucu giysidir.
- G\u0130Y\u0130L\u0130YSE "yelek/\u00F6nl\u00FCk eksik" YAZMA.

G\u00D6ZL\u00DCK/S\u0130PERL\u0130K/MASKE:
- KAYNAK MASKES\u0130: B\u00FCy\u00FCk, siyah, t\u00FCm y\u00FCz\u00FC kapar. Otomatik karartmal\u0131ysa koyu ye\u015Fil/siyah.
- Y\u00FCzde siyah/koyu geni\u015F bir koruyucu varsa \u2192 MASKE VAR
- Kaynak \u0131\u015F\u0131\u011F\u0131 (parlak beyaz/mavi nokta) varsa ve ki\u015Fi ona bak\u0131yorsa ve y\u00FCz\u00FCnde
  b\u00FCy\u00FCk koruyucu varsa \u2192 KES\u0130N MASKE TAKIYOR
- KORUYUCU G\u00D6ZL\u00DCK: \u015Eeffaf plastik, g\u00F6zleri kapar
- S\u0130PERL\u0130K: \u015Eeffaf kalkan, t\u00FCm y\u00FCz\u00FC kapar (ta\u015Flamada kullan\u0131l\u0131r)
- Y\u00FCzde/g\u00F6zde herhangi bir koruyucu varsa \u2192 KORUMA VAR
- KORUMA VARSA \u2192 "maske/g\u00F6zl\u00FCk eksik" KES\u0130NL\u0130KLE YAZMA.

AYAKKABI:
- \u00C7elik burunlu i\u015F ayakkab\u0131s\u0131 var m\u0131? (Genelde kal\u0131n tabanl\u0131, sert g\u00F6r\u00FCn\u00FCml\u00FC)
- Net g\u00F6remiyorsan bu konuda tespit YAPMA.

KKD GENEL KURAL \u2014 ALTIN KURAL:
Bir KKD tak\u0131l\u0131ysa o KKD hakk\u0131nda risk YAZMA.
Emin de\u011Filsen YAZMA.
"Var ama tam g\u00F6r\u00FCnm\u00FCyor" \u2192 "olumlu tespit" olarak yaz, risk de\u011Fil.
"Yok gibi" \u2192 YAZMA.
"Kaynak yap\u0131yorsa maske kesin eksiktir" MANTI\u011EI YASAK.
Bu g\u00F6rsele bak, istatistiksel beklentiye de\u011Fil.

ADIM 4 \u2014 ZEM\u0130N VE ALAN ANAL\u0130Z\u0130:
- Zemin durumu: Kuru mu, \u0131slak m\u0131, ya\u011Fl\u0131 m\u0131, tozlu mu, engebeli mi?
- Tak\u0131lma/kayma riski var m\u0131? Zemin \u00FCzerinde kablo, hortum, malzeme, \u00E7\u00F6p var m\u0131?
- Ge\u00E7i\u015F yollar\u0131 a\u00E7\u0131k m\u0131? Engel var m\u0131?
- Merdiven, rampa, platform kenarlar\u0131nda korkuluk var m\u0131?
- Zemin i\u015Faretleme (sar\u0131 \u00E7izgi, yaya yolu, ara\u00E7 yolu ayr\u0131m\u0131) yap\u0131lm\u0131\u015F m\u0131?
- Zeminde su birikintisi, kimyasal s\u0131z\u0131nt\u0131, ya\u011F lekesi var m\u0131?

ADIM 5 \u2014 DEPOLAMA VE \u0130ST\u0130FLEME ANAL\u0130Z\u0130:
- Malzemeler nas\u0131l istiflenmi\u015F? Devrilme riski var m\u0131?
- \u0130stif y\u00FCksekli\u011Fi g\u00FCvenli mi? (Genel kural: g\u00F6z hizas\u0131n\u0131 ge\u00E7memeli)
- A\u011F\u0131r malzemeler altta m\u0131, hafifler \u00FCstte mi?
- Raf/istif sistemi sa\u011Flam m\u0131, e\u011Filmi\u015F/b\u00FCk\u00FClm\u00FC\u015F m\u00FC?
- Kimyasal maddeler ayr\u0131 depolanm\u0131\u015F m\u0131? Uyumlu maddeler yan yana m\u0131?
- LPG/gaz t\u00FCpleri dik mi, sabitlenmi\u015F mi, a\u00E7\u0131k alanda m\u0131?
- T\u00FCplerin vanalar\u0131 kapal\u0131 m\u0131, hortum ba\u011Flant\u0131lar\u0131 sa\u011Flam m\u0131?

ADIM 6 \u2014 MAK\u0130NE VE EK\u0130PMAN ANAL\u0130Z\u0130:
- \u00D6nce ekipman\u0131 DO\u011ERU TANIMLA (yukar\u0131daki "Ekipman ve Cihaz Tan\u0131mlama" b\u00F6l\u00FCm\u00FCne bak).
- Spiral (avu\u00E7 ta\u015Flama) ile kaynak makinesini KARI\u015ETIRMA \u2014 k\u0131v\u0131lc\u0131m paterni ve disk varl\u0131\u011F\u0131na bak.
- Makinelerin koruyucu kapaklar\u0131/bariyerleri yerinde mi?
- Acil durdurma butonu g\u00F6r\u00FCn\u00FCr ve eri\u015Filebilir mi?
- D\u00F6nen/kesen/ezen par\u00E7alar a\u00E7\u0131kta m\u0131?
- Kald\u0131rma ekipmanlar\u0131 (vin\u00E7, forklift, caraskal) g\u00FCvenli kullan\u0131l\u0131yor mu?
- Elektrik panolar\u0131 kapal\u0131 m\u0131? Kablo d\u00FCzeni uygun mu?
- Hasarl\u0131/eskimi\u015F kablo, fi\u015F, priz var m\u0131?
- Bas\u0131n\u00E7l\u0131 ekipman (kompresor, t\u00FCp, reg\u00FClat\u00F6r) durumu nas\u0131l?
- \u00D6l\u00E7\u00FCm cihazlar\u0131 (manometre, termometre) kalibreli g\u00F6r\u00FCn\u00FCyor mu?
- El aletleri do\u011Fru kullan\u0131l\u0131yor mu? (Spiral kullan\u0131rken koruyucu kapak tak\u0131l\u0131 m\u0131, g\u00F6zl\u00FCk var m\u0131?)

ADIM 7 \u2014 YANGIN VE AC\u0130L DURUM ANAL\u0130Z\u0130:
- Yang\u0131n s\u00F6nd\u00FCr\u00FCc\u00FC var m\u0131? Eri\u015Filebilir mi? \u00D6n\u00FC a\u00E7\u0131k m\u0131?
- Yang\u0131n dolab\u0131/hortumu var m\u0131 ve ula\u015F\u0131labilir mi?
- Acil \u00E7\u0131k\u0131\u015F yolu i\u015Faretli mi? Yol a\u00E7\u0131k m\u0131, engelli mi?
- Acil durum ayd\u0131nlatmas\u0131 var m\u0131?
- Yang\u0131n alarm butonu g\u00F6r\u00FCn\u00FCr m\u00FC?
- Yan\u0131c\u0131 madde yak\u0131n\u0131nda ate\u015F kayna\u011F\u0131 var m\u0131?

ADIM 8 \u2014 \u0130\u015EARET VE UYARI ANAL\u0130Z\u0130:
- Gerekli uyar\u0131 levhalar\u0131 as\u0131l\u0131 m\u0131? (Tehlike, yasak, zorunluluk, bilgi)
- \u0130\u015Faretler g\u00F6r\u00FCn\u00FCr ve okunabilir durumda m\u0131?
- Kimyasal maddelerde etiket/GBF bilgisi var m\u0131?
- Trafik/yaya ayr\u0131m i\u015Faretleri var m\u0131?

ADIM 9 \u2014 Y\u00DCSEKTE \u00C7ALI\u015EMA ANAL\u0130Z\u0130 (Sadece y\u00FCkseklik VARSA):
- Y\u00FCkseklik var m\u0131? (Merdiven, iskele, \u00E7at\u0131, platform, kenar)
- Korkuluk/parapet var m\u0131? Yeterli y\u00FCkseklikte mi?
- Emniyet kemeri/ya\u015Fam hatt\u0131 kullan\u0131l\u0131yor mu?
- \u0130skele sa\u011Flam m\u0131? Platformlar tam m\u0131?
- D\u00FC\u015Fme mesafesi ne kadar? (2m \u00FCzeri kritik)
- Y\u00DCSEKTE \u00C7ALI\u015EMA YOKSA bu kategoriyi H\u0130\u00C7 YAZMA.

ADIM 10 \u2014 \u0130NSAN TESP\u0130T\u0130 VE KVKK (Y\u00FCz Maskeleme):
- G\u00F6rseldeki T\u00DCM insanlar\u0131 tespit et \u2014 y\u00FCzleri g\u00F6r\u00FCns\u00FCn veya g\u00F6r\u00FCnmesin.
- Her insan i\u00E7in y\u00FCz b\u00F6lgesinin koordinatlar\u0131n\u0131 ver (faceX, faceY, faceW, faceH \u2014 y\u00FCzde 0-100).
- Bu bilgi KVKK kapsam\u0131nda y\u00FCzlerin bulan\u0131kla\u015Ft\u0131r\u0131lmas\u0131 i\u00E7in kullan\u0131lacak.
- Arkas\u0131 d\u00F6n\u00FCk veya y\u00FCz\u00FC net olmayan ki\u015Fileri de tespit et \u2014 sadece y\u00FCz b\u00F6lgesi tahminini ver.
- \u0130nsan yoksa faces dizisi bo\u015F olmal\u0131.

ADIM 11 \u2014 OLUMLU TESP\u0130TLER (Do\u011Fru Yap\u0131lan \u015Eeyler):
Profesyonel ISG raporlar\u0131nda sadece riskler de\u011Fil, DO\u011ERU UYGULAMALAR da belirtilir.
- KKD do\u011Fru kullan\u0131l\u0131yorsa bunu belirt: "T\u00FCm \u00E7al\u0131\u015Fanlar baret tak\u0131yor"
- \u0130stif d\u00FCzg\u00FCnse: "Malzemeler uygun y\u00FCkseklikte ve d\u00FCzenli istiflenmi\u015F"
- Yang\u0131n s\u00F6nd\u00FCr\u00FCc\u00FC eri\u015Filebilir durumdaysa: "Yang\u0131n s\u00F6nd\u00FCr\u00FCc\u00FC eri\u015Filebilir konumda"
- Uyar\u0131 levhalar\u0131 yeterliyse: "G\u00FCvenlik i\u015Faretleri mevcut ve g\u00F6r\u00FCn\u00FCr"
- Zemin temiz ve d\u00FCzenliyse: "\u00C7al\u0131\u015Fma alan\u0131 temiz ve d\u00FCzenli"
- Bu tespitler risks dizisine DE\u011E\u0130L, ayr\u0131 "positiveObservations" dizisine yaz\u0131lacak.
- Risk yoksa bile olumlu tespit olabilir \u2014 g\u00F6rseldeki iyi uygulamalar\u0131 atla ge\u00E7me.

ADIM 12 \u2014 G\u00D6RSEL KAL\u0130TE DE\u011EERLEND\u0130RMES\u0130:
- G\u00F6rsel \u00E7ok karanl\u0131k, bulan\u0131k veya d\u00FC\u015F\u00FCk \u00E7\u00F6z\u00FCn\u00FCrl\u00FCkl\u00FC m\u00FC?
- G\u00F6rselin bir b\u00F6l\u00FCm\u00FC g\u00F6lgede kal\u0131yor mu ve o b\u00F6lge analiz edilemez mi?
- Bu bilgi "photoQuality" alan\u0131nda belirtilecek.
- \u0130yi kalite: "good" \u2014 Net, ayd\u0131nl\u0131k, t\u00FCm detaylar g\u00F6r\u00FClebiliyor.
- Orta kalite: "moderate" \u2014 Baz\u0131 b\u00F6lgeler net de\u011Fil ama genel analiz yap\u0131labilir.
- D\u00FC\u015F\u00FCk kalite: "poor" \u2014 Karanl\u0131k, bulan\u0131k veya \u00E7ok uzak \u00E7ekim \u2014 analiz g\u00FCvenilirli\u011Fi d\u00FC\u015F\u00FCk.
- Kalite notu: K\u0131sa a\u00E7\u0131klama (\u00F6r: "G\u00F6rsel karanl\u0131k, sol alt k\u00F6\u015Fe net de\u011Fil")

ADIM 13 \u2014 ALAN GENEL DE\u011EERLEND\u0130RMES\u0130:
- G\u00F6rselin tamam\u0131n\u0131 2-3 c\u00FCmle ile \u00F6zetle.
- Genel risk seviyesi nedir? (Temiz/d\u00FCzenli alan m\u0131, yo\u011Fun riskli alan m\u0131?)
- Bu "areaSummary" alan\u0131nda yaz\u0131lacak.

ADIM 14 \u2014 SON DO\u011ERULAMA (Her Tespiti Sorgula):
Her tespit i\u00E7in kendine \u015Fu sorular\u0131 sor:
\u2713 Bu riski g\u00F6rselde GER\u00C7EKTEN g\u00F6r\u00FCyor muyum, yoksa vars\u0131yor muyum?
\u2713 Bu tespit g\u00F6rseldeki somut bir nesne/durum/ki\u015Fiye mi dayan\u0131yor?
\u2713 Bu KKD ger\u00E7ekten eksik mi, yoksa tak\u0131l\u0131 olup ben mi g\u00F6zden ka\u00E7\u0131r\u0131yorum?
\u2713 Bu ekipman\u0131 DO\u011ERU tan\u0131mlad\u0131m m\u0131? (Spiral mi kaynak m\u0131, vin\u00E7 mi forklift mi?)
\u2713 Bu riski g\u00F6rseldeki hangi piksele/b\u00F6lgeye i\u015Faret ederek kan\u0131tlayabilirim?
\u2713 Ciddiyet seviyesini abartmad\u0131m m\u0131? Ger\u00E7ek\u00E7i mi?
\u2713 Emin de\u011Fil miyim? \u2192 O zaman bu tespiti YAZMA.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
ADIM TET\u0130KLEME PRENS\u0130B\u0130 (METODOLOJ\u0130 KULLANIM KURALI)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

Yukar\u0131daki ad\u0131mlar bir KONTROL L\u0130STES\u0130D\u0130R, bir DOLDURMA FORMU DE\u011E\u0130LD\u0130R.
Her ad\u0131m i\u00E7in TEMEL SORU: "Bu ad\u0131m\u0131n konusu olan unsur g\u00F6rselde F\u0130Z\u0130KSEL olarak g\u00F6r\u00FCn\u00FCyor mu?"
- EVET \u2192 Ad\u0131m\u0131 uygula, analiz et
- HAYIR \u2192 Ad\u0131m\u0131 ATLA, o kategoriye ait H\u0130\u00C7B\u0130R \u015EEY yazma

TET\u0130KLEME TABLOSU:
- Ad\u0131m 2-3 (\u0130nsan/KKD): Tetikleyici = G\u00F6rselde insan VAR. Yoksa \u2192 Atla.
- Ad\u0131m 4 (Zemin): Tetikleyici = Zeminde SOMUT tehlike VAR (d\u00F6k\u00FClme, \u00E7ukur, engel, kaygan madde). Yoksa \u2192 Atla. "Olabilir" YASAK.
- Ad\u0131m 5 (Depolama): Tetikleyici = G\u00F6rselde depo, raf, palet, kutu y\u0131\u011F\u0131n\u0131, end\u00FCstriyel istif VAR. Yoksa \u2192 Atla. Ofis dosyalar\u0131 istifleme DE\u011E\u0130LD\u0130R.
- Ad\u0131m 6 (Makine): Tetikleyici = End\u00FCstriyel makine, el aleti, motorlu cihaz VAR. Yoksa \u2192 Atla. Monit\u00F6r, yaz\u0131c\u0131 "makine" DE\u011E\u0130LD\u0130R.
- Ad\u0131m 7 (Yang\u0131n): Tetikleyici = Yan\u0131c\u0131 madde, \u0131s\u0131 kayna\u011F\u0131, elektrik panosu, gaz t\u00FCp\u00FC VAR. Yoksa \u2192 Atla. S\u00F6nd\u00FCr\u00FCc\u00FCn\u00FCn "g\u00F6r\u00FCnmemesi" tek ba\u015F\u0131na risk DE\u011E\u0130LD\u0130R.
- Ad\u0131m 8 (\u0130\u015Faret): Tetikleyici = Tehlikeli alan VAR ve uyar\u0131 i\u015Fareti OLMALIYKEN YOK. Yoksa \u2192 Atla.
- Ad\u0131m 9 (Y\u00FCkseklik): Tetikleyici = 2m+ y\u00FCkseklik + orada ki\u015Fi VAR. Yoksa \u2192 Atla.

YASAK C\u00DCMLELER: "G\u00F6r\u00FCnmese de olabilir", "Muhtemelen zemin kaygand\u0131r", "Genelde bu t\u00FCr ortamlarda...", "S\u00F6nd\u00FCr\u00FCc\u00FC g\u00F6r\u00FCnm\u00FCyor, olmayabilir..."
Bu c\u00FCmleler risk analizi DE\u011E\u0130L, spek\u00FClasyondur.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
MUTLAK KURALLAR
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

1. SADECE G\u00D6RSELДEK\u0130 GER\u00C7EK DURUMLARI TESP\u0130T ET \u2014 hayal etme, varsayma, genelleme yapma.
2. VAR OLAN bir \u015Feyi "eksik" deme \u2014 bu en b\u00FCy\u00FCk ve en tehlikeli hata.
3. G\u00F6rselde insan YOKSA \u2192 KKD riski YAZMA, davran\u0131\u015F riski YAZMA.
4. G\u00F6rselde y\u00FCkseklik YOKSA \u2192 "y\u00FCksekte \u00E7al\u0131\u015Fma" YAZMA.
5. G\u00F6rselde makine YOKSA \u2192 makine riski YAZMA.
6. Emin OLMADIGIN hi\u00E7bir tespiti YAZMA \u2014 yanl\u0131\u015F pozitif, hi\u00E7 yazmamaktan k\u00F6t\u00FCd\u00FCr.
7. Ayn\u0131 riski farkl\u0131 kelimelerle tekrarlama \u2014 her tespit benzersiz olmal\u0131.
8. Her tespitin g\u00F6rseldeki konumunu (pinX, pinY) do\u011Fru ver \u2014 riskin oldu\u011Fu yere i\u015Faret et.
9. BO\u015E L\u0130STE GE\u00C7ERL\u0130 VE BEKLENEN B\u0130R \u00C7IKTIDIR. G\u00F6rselde somut risk yoksa "risks": [] d\u00F6n.
10. "B\u0130R \u015EEY BULMALIYIM" D\u00DCRT\u00DCS\u00DCNE D\u0130REN\u00C7 G\u00D6STER.
11. OLUMLU TESP\u0130T DE B\u0130R BA\u015EARID\u0131R.
12. Y\u00D6NTEM PARAMETRELER\u0130 SADECE GER\u00C7EKTEN TESP\u0130T ED\u0130LEN R\u0130SKLER \u0130\u00C7\u0130N DOLDURULUR.
13. \u00DC\u00C7L\u00DC DO\u011ERULAMA KURALI: Her risk i\u00E7in (a) G\u00F6rselde fiziksel olarak g\u00F6r\u00FCyor muyum? (b) Bir uzmana g\u00F6sterdi\u011Fimde "evet, burada" diyebilir mi? (c) Mahkemede savunabilir miyim?
14. KURAL #0'I HATIRLA: En \u00FCstteki KURAL #0 bu 13 madde kadar g\u00FC\u00E7l\u00FCd\u00FCr. Her tespitten \u00F6nce KURAL #0'\u0131 kontrol et.

C\u0130DD\u0130YET SEV\u0130YES\u0130 BEL\u0130RLEME:
- critical: \u00D6l\u00FCm/kal\u0131c\u0131 sakatlık riski, acil hayati tehlike
- high: Ciddi yaralanma riski, uzun s\u00FCreli sa\u011Fl\u0131k etkisi
- medium: Orta d\u00FCzey yaralanma, ge\u00E7ici i\u015F g\u00F6remezlik
- low: Hafif rahats\u0131zl\u0131k, k\u00FC\u00E7\u00FCk hasar
Ciddiyet seviyesini ABARTMA \u2014 ger\u00E7ek\u00E7i ol.

\u00D6NER\u0130 YAZIM KURALLARI:
- EN AZ 3 c\u00FCmle yaz. Kim, ne yapacak, nas\u0131l yapacak, ne zaman yapacak belirt.
- "Kontrol edilmeli", "dikkat edilmeli" gibi genel ifadeler YASAK.
- Somut aksiyon plan\u0131 ver.

CONFIDENCE (G\u00DCVEN SKORU) REHBER\u0130:
0.90-1.00: KES\u0130N | 0.75-0.89: Y\u00DCKSEK | 0.60-0.74: ORTA | 0.00-0.59: YAZMA

\u00C7IKTI FORMATI:
- Kategori (T\u00FCrk\u00E7e): Depolama, Yang\u0131n, Elektrik, Kimyasal, KKD, D\u00FCzen/Temizlik, Makine, \u00C7evre, Acil Durum, Ergonomi, Y\u00FCksekte \u00C7al\u0131\u015Fma, \u0130skele, Trafik, Di\u011Fer
- Ciddiyet: low | medium | high | critical
- Konum: Riskin g\u00F6rseldeki konumu (pinX, pinY y\u00FCzde 0-100)`;

const LEGAL_PROMPT = `
MEVZUAT REFERANSLARI:
HER TESP\u0130T \u0130\u00C7\u0130N en az 1, tercihen 2-3 mevzuat referans\u0131 ver. Referanslar GER\u00C7EK ve DO\u011ERU olmal\u0131.

ANA MEVZUAT KAYNAKLARI:
1. 6331 say\u0131l\u0131 \u0130\u015F Sa\u011Fl\u0131\u011F\u0131 ve G\u00FCvenli\u011Fi Kanunu (Madde 4-5-10-13-16-17-30)
2. \u0130\u015F Ekipmanlar\u0131n\u0131n Kullan\u0131m\u0131nda Sa\u011Fl\u0131k ve G\u00FCvenlik \u015Eartlar\u0131 Y\u00F6netmeli\u011Fi
3. Ki\u015Fisel Koruyucu Donan\u0131mlar\u0131n \u0130\u015Fyerlerinde Kullan\u0131lmas\u0131 Hakk\u0131nda Y\u00F6netmelik
4. \u0130\u015Fyeri Bina ve Eklentilerinde Al\u0131nacak Sa\u011Fl\u0131k ve G\u00FCvenlik \u00D6nlemlerine \u0130li\u015Fkin Y\u00F6netmelik
5. Binalar\u0131n Yang\u0131ndan Korunmas\u0131 Hakk\u0131nda Y\u00F6netmelik (2007/12937)
6. Elektrik \u0130\u00E7 Tesisleri Y\u00F6netmeli\u011Fi
7. Kimyasal Maddelerle \u00C7al\u0131\u015Fmalarda Sa\u011Fl\u0131k ve G\u00FCvenlik \u00D6nlemleri Hakk\u0131nda Y\u00F6netmelik
8. Yap\u0131 \u0130\u015Flerinde \u0130\u015F Sa\u011Fl\u0131\u011F\u0131 ve G\u00FCvenli\u011Fi Y\u00F6netmeli\u011Fi
9. Makine Emniyeti Y\u00F6netmeli\u011Fi (2006/42/AT)
10. \u0130\u015F Sa\u011Fl\u0131\u011F\u0131 ve G\u00FCvenli\u011Fi Risk De\u011Ferlendirmesi Y\u00F6netmeli\u011Fi
11. Elle Ta\u015F\u0131ma \u0130\u015Fleri Y\u00F6netmeli\u011Fi
12. Sa\u011Fl\u0131k ve G\u00FCvenlik \u0130\u015Faretleri Y\u00F6netmeli\u011Fi
13. \u0130\u015Fyerlerinde Acil Durumlar Hakk\u0131nda Y\u00F6netmelik

KURALLAR:
- Ka\u00E7 risk varsa o kadar yaz. Say\u0131 s\u0131n\u0131r\u0131 yok.
- Ayn\u0131 riski tekrarlama.
- G\u00F6rselde risk yoksa bo\u015F dizi d\u00F6n.
- T\u00DCRK\u00C7E yaz.
- Sadece JSON d\u00F6nd\u00FCr.`;

/* ================================================================== */
/* Method-specific prompt sections                                     */
/* ================================================================== */

const METHOD_PROMPTS: Record<AnalysisMethod, { systemSection: string; jsonExample: string }> = {
  r_skor: {
    systemSection: `
R-SKOR 2D PARAMETRELER\u0130 \u2014 HER TESP\u0130T \u0130\u00C7\u0130N ZORUNLU:
Her tespit i\u00E7in a\u015Fa\u011F\u0131daki 9 parametreyi g\u00F6rselden DO\u011ERUDAN analiz ederek 0.00-1.00 aras\u0131nda de\u011Fer ver.

C1 - Tehlike Yo\u011Funlu\u011Fu (0-1): 0.0=temiz alan | 0.6=belirgin tehlike | 1.0=\u00E7ok ciddi tehlike
C2 - KKD Eksikli\u011Fi (0-1): 0.0=KKD tam/insan yok | 0.8=ciddi eksiklik | 1.0=hi\u00E7 KKD yok
C3 - Davran\u0131\u015F Riski (0-1): 0.0=g\u00FCvenli/insan yok | 0.5=risk al\u0131yor | 1.0=son derece tehlikeli
C4 - \u00C7evresel Stres (0-1): 0.0=normal ortam | 1.0=a\u015F\u0131r\u0131 \u00E7evresel tehlike
C5 - Kimyasal/Elektrik (0-1): 0.0=yok | 0.7=ciddi | 1.0=patlama riski
C6 - Eri\u015Fim/Engel (0-1): 0.0=serbest | 1.0=tamamen t\u0131kal\u0131
C7 - Makine/Proses (0-1): 0.0=g\u00FCvenli | 1.0=ciddi ar\u0131za
C8 - Ara\u00E7 Trafi\u011Fi (0-1): 0.0=ara\u00E7 yok | 1.0=yo\u011Fun trafik
C9 - \u00D6rg\u00FCtsel Y\u00FCk (0-1): 0.0=i\u015Faret tam | 1.0=hi\u00E7 i\u015Faret yok

KURALLAR: G\u00F6rmedi\u011Fin parametre i\u00E7in 0.0-0.1 ver. \u0130nsan yoksa C2,C3=0.0.`,
    jsonExample: `"r2dParams": {"c1":0.65,"c2":0.00,"c3":0.00,"c4":0.10,"c5":0.70,"c6":0.40,"c7":0.30,"c8":0.05,"c9":0.35}`,
  },

  fine_kinney: {
    systemSection: `
\u26A0\uFE0F HAL\u00DCS\u0130NASYON KORUMASI \u2014 FINE-KINNEY \u0130\u00C7\u0130N KR\u0130T\u0130K \u26A0\uFE0F

KURAL #0'\u0131 \u00D6NCE OKU. Fine-Kinney form\u00FCl\u00FC L \u00D7 S \u00D7 E h\u0131zl\u0131 b\u00FCy\u00FCyen say\u0131lar
\u00FCretir, bu y\u00FCzden hal\u00FCsinasyonlar\u0131n etkisi \u00E7ok b\u00FCy\u00FCkt\u00FCr.

ZORUNLU KURALLAR:
1. VAR OLAN KKD'Y\u0130 "YOK" DEME: Kaynak\u00E7\u0131n\u0131n maskesi, eldiveni varsa YAZMA.
   Torna operat\u00F6r\u00FCn\u00FCn g\u00F6zl\u00FC\u011F\u00FC varsa YAZMA.

2. C\u0130DD\u0130YET KAL\u0130BRASYONU: Her tespit "\u00C7ok Y\u00FCksek Risk" olamaz.
   S=1 (\u00F6nemsiz) | S=3 (hafif) | S=7 (ciddi) | S=15 (a\u011F\u0131r) | S=40 (\u00F6l\u00FCm) | S=100 (toplu \u00F6l\u00FCm)
   Normal KKD eksikli\u011Fine S=40 VERME. S=7 veya S=15 yeter.

3. DUBLE TESP\u0130T YASAK: "Eldiven eksik" ve "Eldiven kullan\u0131lm\u0131yor" ayn\u0131 tespittir.

4. "G\u00D6R\u00DCNM\u00DCYOR" KEL\u0130MES\u0130 YASAK.

FINE-KINNEY PARAMETRELER\u0130:
Olas\u0131l\u0131k (L) \u00D7 \u015Eiddet (S) \u00D7 Maruziyet (E) = Risk Skoru

Olas\u0131l\u0131k (L): 0.1=neredeyse imkans\u0131z | 1=\u00E7ok d\u00FC\u015F\u00FCk | 3=d\u00FC\u015F\u00FCk | 6=muhtemel | 10=ka\u00E7\u0131n\u0131lmaz
\u015Eiddet (S): 1=\u00F6nemsiz | 3=hafif | 7=ciddi | 15=a\u011F\u0131r yaralanma | 40=\u00F6l\u00FCm | 100=toplu \u00F6l\u00FCm
Maruziyet (E): 0.5=\u00E7ok nadir | 1=y\u0131lda birka\u00E7 | 3=ayl\u0131k | 6=haftal\u0131k | 10=s\u00FCrekli

G\u00F6rseldeki duruma g\u00F6re GER\u00C7EK\u00C7\u0130 de\u011Ferler se\u00E7. Abartma.`,
    jsonExample: `"fkParams": {"likelihood":3,"severity":15,"exposure":6}`,
  },

  l_matrix: {
    systemSection: `
\u26A0\uFE0F HAL\u00DCS\u0130NASYON KORUMASI \u2014 L-MATR\u0130S \u0130\u00C7\u0130N KR\u0130T\u0130K \u26A0\uFE0F

KURAL #0'\u0131 \u00D6NCE OKU ve UYGULA.

1. VAR OLAN KKD'Y\u0130 "YOK" DEME.
2. "G\u00D6R\u00DCNM\u00DCYOR" YASAK.
3. \u0130NSANSIZ ERGONOM\u0130 YASAK.
4. C\u0130DD\u0130YET ABARTMA YASAK: Maksimum skor 5\u00D75=25. Her \u015Fey 25 olamaz.

L-T\u0130P\u0130 MATR\u0130S (5\u00D75) PARAMETRELER\u0130:
Olas\u0131l\u0131k (1-5) \u00D7 \u015Eiddet (1-5) = Risk Skoru (1-25)

Olas\u0131l\u0131k: 1=\u00E7ok d\u00FC\u015F\u00FCk | 2=d\u00FC\u015F\u00FCk | 3=orta | 4=y\u00FCksek | 5=\u00E7ok y\u00FCksek
\u015Eiddet: 1=\u00E7ok hafif | 2=hafif | 3=orta | 4=ciddi | 5=\u00E7ok ciddi`,
    jsonExample: `"matrixParams": {"likelihood":3,"severity":4}`,
  },

  fmea: {
    systemSection: `
HAL\u00DCS\u0130NASYON KORUMASI: FMEA y\u00F6ntemi S/O/D parametreleri ister. ANCAK bu parametreler SADECE ger\u00E7ekten tespit edilen riskler i\u00E7in doldurulur. G\u00F6rselde somut risk yoksa risks: [] d\u00F6n. "FMEA se\u00E7ilmi\u015F, bir \u015Fey skorlamal\u0131y\u0131m" d\u00FC\u015F\u00FCncesi YASAKTIR.

FMEA PARAMETRELER\u0130:
\u015Eiddet (S) \u00D7 Olu\u015Fma Olas\u0131l\u0131\u011F\u0131 (O) \u00D7 Tespit Edilebilirlik (D) = RPN (1-1000)

\u015Eiddet (1-10): 1=etkisiz | 5=\u00F6nemli kay\u0131p | 8=yaralanma riski | 10=\u00F6l\u00FCm
Olu\u015Fma (1-10): 1=neredeyse imkans\u0131z | 5=orta-d\u00FC\u015F\u00FCk | 8=y\u00FCksek | 10=neredeyse kesin
Tespit (1-10): 1=kesin tespit | 5=orta tespit | 8=\u00E7ok d\u00FC\u015F\u00FCk tespit | 10=tespit edilemez`,
    jsonExample: `"fmeaParams": {"severity":7,"occurrence":5,"detection":6}`,
  },

  hazop: {
    systemSection: `
HAL\u00DCS\u0130NASYON KORUMASI: HAZOP guide words SADECE s\u00FCre\u00E7 parametreleri g\u00F6rselde VARSA uygulan\u0131r. End\u00FCstriyel s\u00FCre\u00E7/boru hatt\u0131/reakt\u00F6r/tank yokken HAZOP uygulamak YASAKTIR.

HAZOP PARAMETRELER\u0130:
Risk = \u015Eiddet \u00D7 Olas\u0131l\u0131k \u00D7 (6 - Tespit Edilebilirlik)

\u015Eiddet (1-5) | Olas\u0131l\u0131k (1-5) | Tespit Edilebilirlik (1-5)
K\u0131lavuz Kelime: Yok, Az, \u00C7ok, K\u0131smen, Tersi, Ba\u015Fka, Erken, Ge\u00E7, \u00D6nce, Sonra
Proses Parametresi: Ak\u0131\u015F, Bas\u0131n\u00E7, S\u0131cakl\u0131k, Seviye, Zaman, Kompozisyon, pH, H\u0131z
Sapma: K\u0131lavuz kelime + parametre = sapma a\u00E7\u0131klamas\u0131`,
    jsonExample: `"hazopParams": {"severity":4,"likelihood":3,"detectability":3,"guideWord":"\u00C7ok (More)","parameter":"Bas\u0131n\u00E7 (Pressure)","deviation":"Bas\u0131n\u00E7 normalin \u00FCzerinde"}`,
  },

  bow_tie: {
    systemSection: `
\u26A0\uFE0F HAL\u00DCS\u0130NASYON KORUMASI \u2014 BOW-TIE \u0130\u00C7\u0130N KR\u0130T\u0130K \u26A0\uFE0F

1. VAR OLAN KKD'Y\u0130 "YOK" DEME: Kural #0'a bak.
2. YAPISAL SPEK\u00DCLASYON YASAK: Avizenin \u00E7atla\u011F\u0131 G\u00D6R\u00DCNM\u00DCYORSA risk YAZMA.
3. ARKA PLAN KKD YASAK.
4. "G\u00D6R\u00DCNM\u00DCYOR" KEL\u0130MES\u0130 YASAK.
5. BAR\u0130YER SAYARKEN SADECE G\u00D6R\u00DCNEN BAR\u0130YERLER\u0130 SAY.

BOW-TIE PARAMETRELER\u0130:
Art\u0131k Risk = (Tehdit \u00D7 Sonu\u00E7) / (1 + \u00D6nleyici + Azalt\u0131c\u0131)

Tehdit Olas\u0131l\u0131\u011F\u0131 (1-5) | Sonu\u00E7 \u015Eiddeti (1-5) | \u00D6nleyici Bariyer Say\u0131s\u0131 (0-5) | Azalt\u0131c\u0131 Bariyer Say\u0131s\u0131 (0-5)`,
    jsonExample: `"bowTieParams": {"threatProbability":4,"consequenceSeverity":3,"preventionBarriers":1,"mitigationBarriers":1}`,
  },

  fta: {
    systemSection: `
HAL\u00DCS\u0130NASYON KORUMASI: FTA bile\u015Fen listesi ister. ANCAK bile\u015Fenler g\u00F6rselde F\u0130Z\u0130KSEL olarak g\u00F6r\u00FCnen somut unsurlara dayanmal\u0131d\u0131r. G\u00F6rselde risk yoksa components: [] ve risks: [] d\u00F6n.

FTA PARAMETRELER\u0130:
Bile\u015Fenler: Her bile\u015Fen i\u00E7in isim + ar\u0131za olas\u0131l\u0131\u011F\u0131 (0-1 aras\u0131)
Kap\u0131 Tipi: "OR" veya "AND"
Sistem Kritikli\u011Fi (1-5)`,
    jsonExample: `"ftaParams": {"components":[{"name":"Korkuluk eksik","failureRate":0.8},{"name":"E\u011Fitim yetersiz","failureRate":0.4}],"gateType":"OR","systemCriticality":4}`,
  },

  checklist: {
    systemSection: `
\u26A0\uFE0F HAL\u00DCS\u0130NASYON KORUMASI \u2014 CHECKLIST \u0130\u00C7\u0130N KR\u0130T\u0130K \u26A0\uFE0F

1. "\u015EABLON KKD KONTROL L\u0130STES\u0130" UYGULAMA YASAK.
2. VAR OLAN KKD'Y\u0130 "YOK" DEME \u2014 EN KR\u0130T\u0130K HATA:
   Kaynak\u00E7\u0131 g\u00F6r\u00FCnce refleks olarak "kaynak maskesi eksik" yazma.
   \u00D6NCE BAK: Y\u00FCz\u00FCnde b\u00FCy\u00FCk siyah maske var m\u0131? Varsa YAZMA.
   Ellere bak: Kal\u0131n deri eldiven var m\u0131? Varsa YAZMA.
3. HER MADDE "KR\u0130T\u0130K YETERS\u0130ZL\u0130K" DE\u011E\u0130LD\u0130R.
4. "G\u00D6R\u00DCNM\u00DCYOR" KEL\u0130MES\u0130 YASAK.

CHECKLIST PARAMETRELER\u0130:
Kontrol Maddeleri: Her madde i\u00E7in metin + durum + a\u011F\u0131rl\u0131k
  Durum: "uygun" | "uygun_degil" | "kismi" | "na"
  A\u011F\u0131rl\u0131k: 1=normal | 2=\u00F6nemli | 3=kritik
Kategori: Risk kategorisi`,
    jsonExample: `"checklistParams": {"items":[{"text":"KKD kullan\u0131m\u0131 uygun","status":"uygun_degil","weight":2},{"text":"Acil \u00E7\u0131k\u0131\u015F yolu a\u00E7\u0131k","status":"kismi","weight":3}],"category":"KKD"}`,
  },

  jsa: {
    systemSection: `
HAL\u00DCS\u0130NASYON KORUMASI: JSA i\u015F ad\u0131mlar\u0131 ister. ANCAK ad\u0131mlar g\u00F6rselde F\u0130\u0130LEN yap\u0131lan bir i\u015F varsa listelenir. G\u00F6rselde insan ve aktif i\u015F yoksa steps: [] ve risks: [] d\u00F6n.

JSA PARAMETRELER\u0130:
\u0130\u015F Tan\u0131m\u0131: G\u00F6rselde yap\u0131lan i\u015F
Ad\u0131mlar: Her ad\u0131m i\u00E7in:
  stepDescription | hazard | severity (1-5) | likelihood (1-5) | controlEffectiveness (1-5) | controlMeasures`,
    jsonExample: `"jsaParams": {"jobTitle":"Y\u00FCksekte \u00E7al\u0131\u015Fma","steps":[{"stepDescription":"\u0130skeleye \u00E7\u0131kma","hazard":"D\u00FC\u015Fme riski","severity":5,"likelihood":3,"controlEffectiveness":2,"controlMeasures":"Emniyet kemeri ve ya\u015Fam hatt\u0131"}]}`,
  },

  lopa: {
    systemSection: `
HAL\u00DCS\u0130NASYON KORUMASI: LOPA koruma katmanlar\u0131 ister. G\u00F6rselde somut tehlike kayna\u011F\u0131 yoksa frekans ve katman uydurma. Risk yoksa layers: [] ve risks: [] d\u00F6n.

LOPA PARAMETRELER\u0130:
Azalt\u0131lm\u0131\u015F Frekans = Ba\u015Flang\u0131\u00E7 Frekans\u0131 \u00D7 \u03A0(PFD)

Ba\u015Flang\u0131\u00E7 Olay Frekans\u0131: 1=y\u0131lda 1 | 0.1=10 y\u0131lda 1 | 0.01=100 y\u0131lda 1
Sonu\u00E7 \u015Eiddeti (1-5)
Koruma Katmanlar\u0131: Her katman i\u00E7in isim + PFD de\u011Feri
  PFD: 0.1=basit idari kontrol | 0.01=e\u011Fitimli operat\u00F6r/alarm | 0.001=otomatik g\u00FCvenlik (SIL-1)`,
    jsonExample: `"lopaParams": {"initiatingEventFreq":0.1,"consequenceSeverity":4,"layers":[{"name":"Uyar\u0131 levhas\u0131","pfd":0.1},{"name":"Operat\u00F6r m\u00FCdahalesi","pfd":0.01}]}`,
  },
};

/* ================================================================== */
/* Build full prompts per method                                       */
/* ================================================================== */

function buildSystemPrompt(method: AnalysisMethod): string {
  return BASE_PROMPT + "\n" + METHOD_PROMPTS[method].systemSection + "\n" + LEGAL_PROMPT;
}

function buildUserPrompt(method: AnalysisMethod): string {
  const mp = METHOD_PROMPTS[method];
  const r2dFallback = method !== "r_skor" ? `,\n      "r2dParams": {"c1":0.5,"c2":0.3,"c3":0.3,"c4":0.1,"c5":0.2,"c6":0.3,"c7":0.2,"c8":0.1,"c9":0.2}` : "";

  return `Bu g\u00F6rselde ne g\u00F6r\u00FCyorsan sadece onu analiz et. G\u00F6rselde olmayan riskleri uydurma.
Her tespit i\u00E7in belirtilen y\u00F6ntem parametrelerini g\u00F6rselden do\u011Frudan analiz ederek ver.

JSON format\u0131:
{
  "imageRelevance": "relevant|not_real_photo",
  "imageDescription": "G\u00F6rselin k\u0131sa tan\u0131m\u0131",
  "photoQuality": {
    "level": "good|moderate|poor",
    "note": "K\u0131sa kalite notu (opsiyonel)"
  },
  "areaSummary": "G\u00F6rselin genel 2-3 c\u00FCmlelik de\u011Ferlendirmesi",
  "personCount": 3,
  "faces": [
    { "faceX": 45, "faceY": 10, "faceW": 8, "faceH": 10 }
  ],
  "positiveObservations": [
    "T\u00FCm \u00E7al\u0131\u015Fanlar baret tak\u0131yor",
    "Yang\u0131n s\u00F6nd\u00FCr\u00FCc\u00FC eri\u015Filebilir konumda"
  ],
  "risks": [
    {
      "title": "G\u00F6rseldeki somut risk",
      "category": "T\u00FCrk\u00E7e kategori",
      "severity": "low|medium|high|critical",
      "confidence": 0.85,
      "recommendation": "Detayl\u0131 \u00F6neri (en az 3 c\u00FCmle, somut aksiyon plan\u0131)",
      "correctiveActionRequired": true,
      "pinX": 50,
      "pinY": 30,
      "boxX": 40,
      "boxY": 20,
      "boxW": 20,
      "boxH": 30,
      ${mp.jsonExample}${r2dFallback},
      "legalReferences": [
        {
          "law": "Kanun/y\u00F6netmelik ad\u0131",
          "article": "Madde X, f\u0131kra Y",
          "description": "Maddenin ne s\u00F6yledi\u011Fi"
        }
      ]
    }
  ]
}`;
}

/* ================================================================== */
/* API handler                                                         */
/* ================================================================== */

export async function POST(request: NextRequest) {
  // GÜVENLİK KATMANI (Parça B Adım 4):
  // Bu route AI görüntü risk analizi yapar (Claude Vision). Anthropic API maliyeti
  // olduğu için anonim erişim engellenmeli. requireAuth: authenticated kullanıcılara
  // izin verir, aksi 401/403 döner.
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const plan = await resolveAiDailyLimit(auth.userId);
    const rateLimitResponse = await enforceRateLimit(request, {
      userId: auth.userId,
      organizationId: auth.organizationId,
      endpoint: "/api/analyze-risk",
      scope: "ai",
      limit: plan.dailyLimit,
      windowSeconds: 24 * 60 * 60,
      planKey: plan.planKey,
      metadata: { feature: "analyze_risk" },
    });
    if (rateLimitResponse) return rateLimitResponse;

    const parsedBody = await parseJsonBody(request, analyzeRiskSchema);
    if (!parsedBody.ok) return parsedBody.response;

    const { imageBase64, mimeType, method } = parsedBody.data;

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "imageBase64 ve mimeType gerekli" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY tan\u0131ml\u0131 de\u011Fil" }, { status: 500 });
    }

    const startTime = Date.now();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0,
      system: buildSystemPrompt(method),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: buildUserPrompt(method),
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI yan\u0131t vermedi" }, { status: 500 });
    }

    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(jsonStr) as Record<string, any>;

    // Debug log
    console.log("\\n========================================");
    console.log("\uD83D\uDDBC\uFE0F  YEN\u0130 G\u00D6RSEL ANAL\u0130Z\u0130 (v1.8)");
    console.log("========================================");
    console.log("Method:", method);
    console.log("Image Relevance:", parsed.imageRelevance);
    console.log("Image Description:", parsed.imageDescription);
    console.log("Person Count:", parsed.personCount);
    console.log("Photo Quality:", parsed.photoQuality?.level);
    console.log("Toplam tespit:", parsed.risks?.length || 0);
    console.log("Olumlu tespitler:", parsed.positiveObservations?.length || 0);
    console.log("----------------------------------------");
    if (parsed.risks && parsed.risks.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed.risks.forEach((risk: any, idx: number) => {
        console.log(`${idx + 1}. ${risk.title}`);
        console.log(`   Confidence: ${risk.confidence} | Category: ${risk.category} | Severity: ${risk.severity}`);
      });
    } else {
      console.log("Risk tespit edilmedi (bos liste)");
    }
    if (parsed.positiveObservations?.length > 0) {
      console.log("--- Olumlu Tespitler ---");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed.positiveObservations.forEach((obs: any, idx: number) => {
        console.log(`  + ${obs}`);
      });
    }
    console.log("========================================\n");

    const duration = Date.now() - startTime;
    return NextResponse.json({
      risks: parsed.risks ?? [],
      faces: parsed.faces ?? [],
      positiveObservations: parsed.positiveObservations ?? [],
      photoQuality: parsed.photoQuality ?? { level: "good", note: "" },
      areaSummary: parsed.areaSummary ?? "",
      personCount: parsed.personCount ?? 0,
      imageRelevance: parsed.imageRelevance ?? "relevant",
      imageDescription: parsed.imageDescription ?? "",
      method,
      promptVersion: PROMPT_VERSION,
      durationMs: duration,
      tokensInput: response.usage?.input_tokens ?? 0,
      tokensOutput: response.usage?.output_tokens ?? 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    const stack = error instanceof Error ? error.stack : "";
    console.error("Risk analizi API hatas\u0131:", message, stack);
    await logSecurityEvent(request, "ai.analyze_risk.failed", {
      severity: "warning",
      userId: auth.userId,
      organizationId: auth.organizationId,
      details: {
        message: message.slice(0, 300),
      },
    });
    return NextResponse.json({ error: message, detail: stack?.slice(0, 500) }, { status: 500 });
  }
}
