import type { Language } from "@/i18n/config";
import type { TranslationKey } from "@/i18n/language/en";
import en from "@/i18n/language/en";
import hi from "@/i18n/language/hi";
import mr from "@/i18n/language/mr";

export const messages: Record<Language, Partial<Record<TranslationKey, string>>> = {
  en,
  hi,
  mr,
};
