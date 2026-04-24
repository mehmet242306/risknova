export function normalizeNovaRequestText(message: string) {
  return message
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

export function isNovaOperationalCommandQuery(message: string) {
  const normalized = normalizeNovaRequestText(message);
  return /(olustur|planla|ekle|kaydet|ac|git|yonlendir|create|plan|open|navigate|schedule|start|baslat|uygula)/.test(
    normalized,
  );
}

export function isNovaRegulationQuery(message: string) {
  const normalized = normalizeNovaRequestText(message);
  return /(mevzuat|yonetmelik|kanun|madde|regulation|law|article|legal|gesetz|verordnung|ley|leyes|loi|reglement|reglamento|normativa|isg uzmani|is guvenligi uzmani|isyeri hekimi|diger saglik personeli|dsp|tehlike sinifi|cok tehlikeli|az tehlikeli|tehlikeli sinif|calisan sayisi|personel sayisi|kac kisi|kac personel|ayda kac saat|bildirim suresi|zorunlu mu|gerekli mi|yasal|yukumluluk|sorumluluk)/.test(
    normalized,
  );
}

export function resolveNovaRequestMode(message: string): "read" | "agent" {
  return isNovaOperationalCommandQuery(message) ? "agent" : "read";
}

export function resolveNovaApiEndpoint(message: string) {
  return resolveNovaRequestMode(message) === "read"
    ? "/api/nova/legal-chat"
    : "/api/nova/chat";
}
