export const languages = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
] as const;

export type Language = (typeof languages)[number]["code"];

export const defaultLanguage: Language = "en";

export function isLanguage(value: string | null): value is Language {
  return languages.some((language) => language.code === value);
}
