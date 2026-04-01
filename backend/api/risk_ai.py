from __future__ import annotations

from collections import Counter
from typing import Any

FACTOR_LABELS: dict[str, str] = {
    "c1": "ortam karmaşıklığı",
    "c2": "görev kritikliği",
    "c3": "ekipman sağlığı",
    "c4": "davranışsal riskler",
    "c5": "iş gücü yorgunluğu",
    "c6": "çevresel koşullar",
    "c7": "kimyasal veya biyolojik maruziyet",
    "c8": "süreç istikrarsızlığı",
    "c9": "acil erişim ve kontrol zafiyeti",
}

RISK_INTROS: dict[str, str] = {
    "low": "Risk seviyesi düşük.",
    "medium": "Risk seviyesi kontrol altında tutulmalıdır.",
    "significant": "Risk seviyesi dikkat gerektiriyor.",
    "high": "Risk seviyesi yüksek.",
    "critical": "Risk seviyesi kritik.",
}

GENERAL_ACTIONS: dict[str, list[str]] = {
    "low": [
        "Mevcut kontroller korunmalı ve periyodik olarak gözden geçirilmelidir.",
    ],
    "medium": [
        "Mevcut kontroller kısa vadede doğrulanmalı ve saha uygulaması izlenmelidir.",
        "Çalışan farkındalığı artırılmalıdır.",
    ],
    "significant": [
        "İdari ve teknik kontroller birlikte güçlendirilmelidir.",
        "Saha uygulaması için sorumlu ve termin atanmalıdır.",
    ],
    "high": [
        "Düzeltici faaliyetler öncelikli aksiyon planına alınmalıdır.",
        "Uygulama sahada doğrulanana kadar risk takibi sıklaştırılmalıdır.",
    ],
    "critical": [
        "Faaliyet başlamadan veya sürdürülmeden önce kontrol önlemleri yeniden değerlendirilmelidir.",
        "Yüksek öncelikli düzeltici faaliyet ve yönetici onayı süreci işletilmelidir.",
    ],
}

KEYWORD_ACTIONS: dict[str, list[str]] = {
    "elle taşıma": [
        "Yük ağırlık sınırları ve taşıma kuralları yeniden tanımlanmalıdır.",
        "Mekanik yardımcı ekipman kullanımı artırılmalıdır.",
        "Çalışanlara uygulamalı kaldırma ve taşıma eğitimi verilmelidir.",
    ],
    "kaldırma": [
        "Kaldırma yardımcıları ve ergonomik ekipman uygunluğu kontrol edilmelidir.",
    ],
    "elektrik": [
        "Enerji izolasyonu ve yetkili personel kontrolü güçlendirilmelidir.",
        "Elektrik ekipmanlarının periyodik kontrol kayıtları doğrulanmalıdır.",
    ],
    "yangın": [
        "Yangın yükü ve tutuşturucu kaynaklar yeniden değerlendirilmelidir.",
        "Söndürme ekipmanı ve acil durum erişimi sahada doğrulanmalıdır.",
    ],
    "kimyasal": [
        "MSDS, maruziyet sınırları ve uygun KKD birlikte gözden geçirilmelidir.",
        "Depolama, etiketleme ve havalandırma koşulları doğrulanmalıdır.",
    ],
    "makine": [
        "Makine koruyucuları ve güvenlik interlock yapıları kontrol edilmelidir.",
        "Bakım/onarım öncesi enerji kesme prosedürü uygulanmalıdır.",
    ],
    "ekipman": [
        "Ekipman uygunluğu ve bakım kayıtları güncel tutulmalıdır.",
    ],
    "yüksekte çalışma": [
        "Kenar koruma, yaşam hattı ve düşüş durdurma sistemleri yeniden doğrulanmalıdır.",
        "Çalışma izin süreci ve kurtarma planı sahada hazır tutulmalıdır.",
    ],
    "düşme": [
        "Kayma, takılma ve düşme kaynakları için saha düzeni iyileştirilmelidir.",
    ],
    "kayma": [
        "Zemin, geçiş yolları ve temizlik disiplini iyileştirilmelidir.",
    ],
    "kapalı alan": [
        "Gaz ölçüm, havalandırma ve kurtarma ekipmanları iş öncesi doğrulanmalıdır.",
    ],
}


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def build_item_ai_output(
    *,
    hazard_title: str,
    hazard_description: str,
    current_controls: str | None,
    risk_level: str,
    normalized_score: float,
    dominant_factors: list[dict[str, Any]],
) -> dict[str, Any]:
    intro = RISK_INTROS.get(risk_level, "Risk seviyesi değerlendirilmiştir.")

    factor_names = [
        FACTOR_LABELS.get(str(item.get("code")), str(item.get("code")))
        for item in dominant_factors
        if item.get("code")
    ]
    factor_sentence = ""
    if factor_names:
        factor_sentence = (
            " Etkiyi özellikle " + ", ".join(factor_names[:3]) + " artırmaktadır."
        )

    controls_sentence = (
        " Mevcut kontrollerin sahadaki etkinliği doğrulanmalıdır."
        if current_controls
        else " Mevcut kontrol seti sınırlı göründüğünden ek önlemler hızla planlanmalıdır."
    )

    comment = (
        f"{intro} Skor {normalized_score:.1f} olarak hesaplandı."
        f"{factor_sentence}{controls_sentence}"
    )

    combined_text = f"{hazard_title} {hazard_description}".lower()
    actions = list(GENERAL_ACTIONS.get(risk_level, []))

    for keyword, keyword_actions in KEYWORD_ACTIONS.items():
        if keyword in combined_text:
            actions.extend(keyword_actions)

    if not current_controls:
        actions.append(
            "Sahadaki mevcut kontroller yazılı ve görsel olarak standardize edilmelidir."
        )

    actions = _dedupe(actions)[:5]

    return {
        "ai_comment": comment,
        "ai_actions": actions,
    }


def build_assessment_ai_summary(
    *,
    title: str,
    item_results: list[dict[str, Any]],
    overall_risk_level: str,
) -> str:
    if not item_results:
        return f"{title} için henüz risk kalemi bulunmamaktadır."

    counts = Counter(str(item.get("risk_level", "low")) for item in item_results)

    severity_parts: list[str] = []
    for level in ("critical", "high", "significant", "medium", "low"):
        count = counts.get(level, 0)
        if count:
            severity_parts.append(f"{count} adet {level}")

    summary_body = ", ".join(severity_parts)
    return (
        f"Analiz tamamlandı. Genel risk seviyesi {overall_risk_level}. "
        f"Dağılım: {summary_body}. Öncelik, en yüksek riskli kalemlerin kısa vadeli kontrol planına alınmasıdır."
    )
