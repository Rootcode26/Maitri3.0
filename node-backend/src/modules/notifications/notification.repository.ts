import { query } from '../../database/database.js';
import type { Notification, NotificationType } from './notification.types.js';

interface NotificationRow {
  id: string;
  type: NotificationType;
  data: Record<string, string>;
  project_id: string | null;
  read_at: Date | null;
  created_at: Date;
}

const mapNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  type: row.type,
  data: row.data ?? {},
  projectId: row.project_id,
  read: row.read_at !== null,
  createdAt: row.created_at.toISOString(),
});

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  data?: Record<string, string>;
  projectId?: string | null;
}

export class NotificationRepository {
  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    if (inputs.length === 0) return;
    const values: unknown[] = [];
    const rows = inputs.map((input, index) => {
      const base = index * 4;
      values.push(
        input.userId,
        input.type,
        JSON.stringify(input.data ?? {}),
        input.projectId ?? null,
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, $${base + 4})`;
    });
    await query(
      `INSERT INTO notifications (user_id, type, data, project_id) VALUES ${rows.join(', ')}`,
      values,
    );
  }

  /** Notify the inspector who raised a clarification that the applicant replied. */
  async createClarificationAnswered(clarificationId: string): Promise<void> {
    await query(
      `INSERT INTO notifications (user_id, type, data, project_id)
       SELECT cr.inspector_id, 'clarification_answered',
              jsonb_build_object('enterpriseName', p.enterprise_name, 'approvalTitle', pa.title),
              cr.project_id
         FROM clarification_requests cr
         JOIN projects p ON p.id = cr.project_id
         JOIN project_approvals pa ON pa.id = cr.approval_id
        WHERE cr.id = $1 AND cr.inspector_id IS NOT NULL`,
      [clarificationId],
    );
  }

  /** Fan-out: notify every inspector in any department that reviews this project. */
  async createForProjectDepartments(input: {
    projectId: string;
    type: NotificationType;
    data?: Record<string, string>;
  }): Promise<void> {
    await query(
      `INSERT INTO notifications (user_id, type, data, project_id)
       SELECT DISTINCT u.id, $2::notification_type, $3::jsonb, $1
         FROM project_approvals pa
         JOIN users u ON u.department_id = pa.department_id AND u.role = 'inspector'
        WHERE pa.project_id = $1`,
      [input.projectId, input.type, JSON.stringify(input.data ?? {})],
    );
  }

  async listForUser(userId: string, limit: number): Promise<Notification[]> {
    const result = await query<NotificationRow>(
      `SELECT id, type, data, project_id, read_at, created_at
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(mapNotification);
  }

  async unreadCount(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await query(
      `UPDATE notifications SET read_at = NOW()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [notificationId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async markAllRead(userId: string): Promise<void> {
    await query(`UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [
      userId,
    ]);
  }
}
