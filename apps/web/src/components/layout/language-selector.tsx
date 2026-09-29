"use client";

import { languages, type Language } from "@/i18n/config";
import { useLanguage } from "@/components/providers/language-provider";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <span className="sr-only">{t("language.label")}</span>
      <select
        aria-label={t("language.label")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="min-h-10 cursor-pointer rounded-md border border-current/40 bg-transparent px-3 py-2 text-current transition-colors hover:bg-current/5 focus-visible:outline-3 focus-visible:outline-offset-2"
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code} className="text-foreground">
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
