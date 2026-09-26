"use client";

import { languages, type Language } from "@/i18n/config";
import { useLanguage } from "@/components/providers/language-provider";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  return <label className="flex items-center gap-2 text-sm font-medium"><span className="sr-only">{t("language.label")}</span><select aria-label={t("language.label")} value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="rounded-sm border border-current/40 bg-transparent px-2 py-1.5 text-current focus-visible:outline-2">{languages.map((item) => <option key={item.code} value={item.code} className="text-slate-900">{item.label}</option>)}</select></label>;
}
