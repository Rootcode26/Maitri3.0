"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useLanguage } from "@/components/providers/language-provider";
import type { TranslationKey } from "@/i18n/language/en";
import { formatDate } from "@/i18n/format";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from "@/features/notifications/notification-api";

const messageKey: Record<NotificationType, TranslationKey> = {
  submission_received: "notification.submission_received",
  clarification_requested: "notification.clarification_requested",
  clarification_answered: "notification.clarification_answered",
  approval_decided: "notification.approval_decided",
  certificate_issued: "notification.certificate_issued",
};

export function NotificationBell({
  workspace,
}: {
  workspace: "applicant" | "inspector";
}) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const feed = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
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

  const hrefFor = (notification: AppNotification) =>
    notification.projectId
      ? `/${workspace}/applications/${notification.projectId}`
      : `/${workspace}/dashboard`;

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        aria-label={t("dashboard.notifications")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-card focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid min-h-4.5 min-w-4.5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg duration-200 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between border-b border-[#efece4] px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {t("notification.title")}
              </p>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline"
                >
                  <CheckCheck className="size-3.5" aria-hidden="true" />
                  {t("notification.markAllRead")}
                </button>
              ) : null}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t("notification.empty")}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <Link
                        href={hrefFor(notification)}
                        onClick={() => {
                          if (!notification.read) markRead.mutate(notification.id);
                          setOpen(false);
                        }}
                        className={`flex gap-3 px-4 py-3 transition-colors hover:bg-muted ${
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
        </>
      ) : null}
    </div>
  );
}
