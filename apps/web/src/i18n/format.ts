import type { Language } from "@/i18n/config";

const localeByLanguage: Record<Language, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN"};

export function localeFor(language: Language) {
  return localeByLanguage[language];
}

export function formatDate(value: Date | string | number, language: Language) {
  return new Intl.DateTimeFormat(localeFor(language), { dateStyle: "medium" }).format(new Date(value));
}

export function formatNumber(value: number, language: Language) {
  return new Intl.NumberFormat(localeFor(language)).format(value);
}

export function formatPercent(value: number, language: Language) {
  return new Intl.NumberFormat(localeFor(language), { style: "percent" }).format(value);
}

export function formatCurrency(value: number, language: Language, currency = "INR") {
  return new Intl.NumberFormat(localeFor(language), { style: "currency", currency }).format(value);
}
