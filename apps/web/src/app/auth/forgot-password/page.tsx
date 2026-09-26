import { Suspense } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { AuthCard } from "@/features/auth/auth-card";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { LocalizedLoading } from "@/features/auth/localized-loading";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader actionLabel="Change workspace" />
      <main className="mx-auto flex w-full max-w-2xl justify-center px-5 py-10 sm:px-8 md:py-14">
        <AuthCard eyebrow="Account recovery" title="Reset your password">
          <Suspense fallback={<LocalizedLoading className="h-48 animate-pulse rounded-md bg-slate-100" label="Loading recovery form" />}><ForgotPasswordForm /></Suspense>
        </AuthCard>
      </main>
    </div>
  );
}
