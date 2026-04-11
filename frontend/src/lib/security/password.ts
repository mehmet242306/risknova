const PASSWORD_RULES = {
  minLength: 12,
  lowercase: /[a-z]/,
  uppercase: /[A-Z]/,
  digit: /\d/,
  symbol: /[^A-Za-z0-9]/,
} as const;

export function validateStrongPassword(password: string) {
  if (password.length < PASSWORD_RULES.minLength) {
    return "Sifre en az 12 karakter olmali.";
  }

  if (!PASSWORD_RULES.lowercase.test(password)) {
    return "Sifre en az bir kucuk harf icermeli.";
  }

  if (!PASSWORD_RULES.uppercase.test(password)) {
    return "Sifre en az bir buyuk harf icermeli.";
  }

  if (!PASSWORD_RULES.digit.test(password)) {
    return "Sifre en az bir rakam icermeli.";
  }

  if (!PASSWORD_RULES.symbol.test(password)) {
    return "Sifre en az bir sembol icermeli.";
  }

  return null;
}
