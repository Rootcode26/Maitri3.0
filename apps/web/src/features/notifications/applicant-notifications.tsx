"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/components/providers/language-provider";
import { formatDate } from "@/i18n/format";
import type { TranslationKey } from "@/i18n/language/en";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationType,
} from "@/features/notifications/notification-api";

const messageKey: Record<NotificationType, TranslationKey> = {
  submission_received: "notification.submission_received",
  clarification_requested: "notification.clarification_requested",
  clarification_answered: "notification.clarification_answered",
  approval_decided: "notification.approval_decided",
  certificate_issued: "notification.certificate_issued",
};

export function ApplicantNotifications() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const feed = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    refetchInterval: 30_000,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = feed.data?.notifications ?? [];
  const unread = feed.data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-9">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {t("notification.title")}
        </h1>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            {t("notification.markAllRead")}
          </button>
        ) : null}
      </header>

      <div className="mt-6">
        {feed.isPending ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-card p-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" /> {t("common.loading")}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-16 text-center">
            <Bell className="size-10 text-slate-300" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("notification.empty")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={
                    notification.projectId
                      ? `/applicant/applications/${notification.projectId}`
                      : "/applicant/dashboard"
                  }
                  onClick={() => {
                    if (!notification.read) markRead.mutate(notification.id);
                  }}
                  className={`flex gap-3 px-5 py-4 transition-colors hover:bg-muted ${
                    notification.read ? "" : "bg-primary/5"
                  }`}
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      notification.read ? "bg-transparent" : "bg-primary"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">
                      {t(messageKey[notification.type], notification.data)}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDate(notification.createdAt, language)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
