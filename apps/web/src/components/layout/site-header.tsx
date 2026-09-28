"use client";

import Image from "next/image";
import Link from "next/link";
import { LanguageSelector } from "@/components/layout/language-selector";
import { useLanguage } from "@/components/providers/language-provider";

export function PortalBrand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const light = tone === "light";

  return (
    <span
      className={`inline-flex items-center gap-3 ${light ? "text-white" : "text-[#17345a]"}`}
      translate="no"
    >
      <Image
        src="/images/udyogsetu-emblem.svg"
        alt=""
        width={64}
        height={64}
        aria-hidden="true"
        className={`size-12 shrink-0 sm:size-16 ${light ? "brightness-110" : ""}`}
      />
      <span className="text-xl font-bold tracking-tight sm:text-3xl">
        UdyogSetu
      </span>
    </span>
  );
}

export function SiteHeader({ actionLabel = "Return home", actionHref = "/" }) {
  const { t } = useLanguage();
  return (
    <header className="border-b border-white/10 bg-[#142b45] text-white">
      <div className="mx-auto flex min-h-20 w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3 sm:flex-nowrap sm:px-8 sm:py-4 lg:px-10">
        <Link
          href="/"
          className="rounded-sm focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <PortalBrand tone="light" />
          <span className="block text-sm font-medium text-slate-200 sm:text-base">
            {t("header.portal")}
          </span>
        </Link>
        <div className="flex w-full items-center justify-between gap-2 border-t border-white/10 pt-2 sm:w-auto sm:justify-end sm:gap-3 sm:border-0 sm:pt-0">
          <LanguageSelector />
          <Link
            href={actionHref}
            className="inline-flex min-h-11 items-center rounded-sm px-2 py-2 text-sm font-medium underline underline-offset-4 hover:text-slate-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
          >
            {actionLabel === "Return home" ? t("header.returnHome") : actionLabel === "Change workspace" ? t("header.changeWorkspace") : actionLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
