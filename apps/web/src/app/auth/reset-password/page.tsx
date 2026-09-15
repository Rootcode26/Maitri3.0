import { Suspense } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { AuthCard } from "@/features/auth/auth-card";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader actionLabel="Change workspace" />
      <main className="mx-auto flex w-full max-w-2xl justify-center px-5 py-10 sm:px-8 md:py-14">
        <AuthCard eyebrow="Account recovery" title="Choose a new password">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-slate-100" aria-label="Loading password form" />}><ResetPasswordForm /></Suspense>
        </AuthCard>
      </main>
    </div>
  );
}
