"use client";

import { useLanguage } from "@/components/providers/language-provider";

export function LocalizedLoading({ label, className }: { label: string; className: string }) {
  const { text } = useLanguage();
  return <div className={className} aria-label={text(label)} />;
}
