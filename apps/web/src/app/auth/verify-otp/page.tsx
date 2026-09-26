import { Suspense } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { AuthCard } from "@/features/auth/auth-card";
import { OtpForm } from "@/features/auth/otp-form";
import { LocalizedLoading } from "@/features/auth/localized-loading";

export default function VerifyOtpPage() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader actionLabel="Change workspace" />
      <main id="main-content" className="mx-auto flex w-full max-w-2xl justify-center px-5 py-10 sm:px-8 md:py-14">
        <AuthCard eyebrow="Mobile verification" title="Enter the verification code">
          <Suspense fallback={<LocalizedLoading className="h-56 animate-pulse rounded-md bg-slate-100" label="Loading verification form" />}>
            <OtpForm />
          </Suspense>
        </AuthCard>
      </main>
    </div>
  );
}
