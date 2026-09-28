export type NotificationType =
  | 'submission_received'
  | 'clarification_requested'
  | 'clarification_answered'
  | 'approval_decided'
  | 'certificate_issued';

/** A single in-app notification for one recipient. */
export interface Notification {
  id: string;
  type: NotificationType;
  data: Record<string, string>;
  projectId: string | null;
  read: boolean;
  createdAt: string;
}
