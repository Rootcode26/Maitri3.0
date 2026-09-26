import type { Language } from "@/i18n/config";
import en, { type DisplayPhrase } from "@/i18n/display/en";
import hi from "@/i18n/display/hi";
import mr from "@/i18n/display/mr";

const displayMessages: Record<Language, Record<DisplayPhrase, string>> = {
  en,
  hi,
  mr,
};

export type DisplayValues = Record<string, string | number>;

export function translateDisplayText(
  language: Language,
  source: string,
  values?: DisplayValues,
) {
  const localized =
    displayMessages[language][source as DisplayPhrase] ??
    displayMessages.en[source as DisplayPhrase] ??
    source;

  return localized.replace(/{{(\w+)}}/g, (token, name) =>
    values?.[name] == null ? token : String(values[name]),
  );
}
