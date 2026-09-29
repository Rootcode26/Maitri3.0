"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/components/providers/language-provider";

export function AuthCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const { text } = useLanguage();
  return (
    <Card className="mx-auto w-full max-w-xl rounded-md border border-border bg-card py-0 shadow-[0_16px_45px_rgba(20,43,69,0.08)] ring-0">
      <CardHeader className="gap-1 border-b border-border px-5 py-4 sm:px-7 sm:py-5">
        <p className="text-sm font-semibold text-primary">{text(eyebrow)}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{text(title)}</h2>
      </CardHeader>
      <CardContent className="px-5 py-4 sm:px-7 sm:py-5">{children}</CardContent>
    </Card>
  );
}
