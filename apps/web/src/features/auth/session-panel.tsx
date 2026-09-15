"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCurrentSession, logoutSession } from "@/lib/auth-api";

export const sessionQueryKey = ["auth", "session"] as const;

export function SessionPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentSession });
  const logout = useMutation({
    mutationFn: logoutSession,
    onSuccess: () => {
      queryClient.setQueryData(sessionQueryKey, null);
      router.push("/");
      router.refresh();
    },
  });

  if (session.isPending || (!session.data && !session.isError)) return null;
  if (session.isError) return <p role="alert" className="mx-auto mb-6 max-w-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">We could not check your session. You can still choose a workspace and sign in.</p>;
  if (!session.data) return null;

  const roleLabel = session.data.role === "inspector" ? "Inspector" : session.data.role[0]!.toUpperCase() + session.data.role.slice(1);
  return (
    <section aria-label="Current session" className="mx-auto mb-8 flex max-w-3xl flex-col gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0" aria-hidden="true" /><span>Signed in as <strong>{session.data.name}</strong> · {roleLabel}</span></p>
      <Button type="button" variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending} aria-busy={logout.isPending}><LogOut aria-hidden="true" /> {logout.isPending ? "Signing out…" : "Sign out"}</Button>
      {logout.isError && <p role="alert">Sign out failed. Please try again.</p>}
    </section>
  );
}
