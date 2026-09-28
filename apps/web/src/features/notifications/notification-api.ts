import { localPreviewEnabled } from "@/lib/local-preview";
import { apiFetch } from "@/lib/api-fetch";

export type NotificationType =
  | "submission_received"
  | "clarification_requested"
  | "clarification_answered"
  | "approval_decided"
  | "certificate_issued";

export interface AppNotification {
  id: string;
  type: NotificationType;
  data: Record<string, string>;
  projectId: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationFeed {
  notifications: AppNotification[];
  unreadCount: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/v1/notifications${path}`, {
    ...init,
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as { data?: T };
  if (!response.ok || !body.data) {
    throw new Error("Could not load notifications.");
  }
  return body.data;
}

export function listNotifications() {
  if (localPreviewEnabled) {
    return Promise.resolve({ notifications: [], unreadCount: 0 });
  }
  return request<NotificationFeed>("/");
}

export function markNotificationRead(id: string) {
  return request<{ ok: boolean }>(`/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return request<{ ok: boolean }>("/read-all", { method: "POST" });
}
