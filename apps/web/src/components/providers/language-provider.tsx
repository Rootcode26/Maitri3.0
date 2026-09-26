"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { defaultLanguage, isLanguage, type Language } from "@/i18n/config";
import { messages } from "@/i18n";
import type { TranslationKey } from "@/i18n/language/en";

export type TranslationValues = Record<string, string | number | Date>;
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey, values?: TranslationValues) => string };
function translate(language: Language, key: TranslationKey, values?: TranslationValues) {
  const localized = messages[language][key];
  if (!localized && process.env.NODE_ENV === "development") {
    console.warn(`[i18n] Missing ${language} translation for ${key}; using English.`);
  }
  const message = localized ?? messages.en[key] ?? key;
  return message.replace(/{{(\w+)}}/g, (token, name) => values?.[name] == null ? token : String(values[name]));
}
const fallbackLanguageContext: LanguageContextValue = {
  language: defaultLanguage,
  setLanguage: () => undefined,
  t: (key, values) => translate(defaultLanguage, key, values),
};
const LanguageContext = createContext<LanguageContextValue>(fallbackLanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(defaultLanguage);
  useEffect(() => {
    const saved = window.localStorage.getItem("language");
    if (isLanguage(saved)) queueMicrotask(() => setLanguage(saved));
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("language", language);
  }, [language]);
  const t = (key: TranslationKey, values?: TranslationValues) => translate(language, key, values);
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
