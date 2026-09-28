import { logger } from '../../config/logger.js';
import type { NotificationRepository } from './notification.repository.js';
import type { Notification } from './notification.types.js';

const LIST_LIMIT = 30;

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async list(userId: string): Promise<Notification[]> {
    return this.repository.listForUser(userId, LIST_LIMIT);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repository.unreadCount(userId);
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.repository.markRead(userId, notificationId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repository.markAllRead(userId);
  }

  // ── Emit helpers ─────────────────────────────────────────────────────────
  // These never throw: a notification failure must not disrupt the action that
  // triggered it.

  private async safely(label: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      logger.error({ err: error }, `Failed to create ${label} notification`);
    }
  }

  /** A submitted application reaches the inspectors of its departments. */
  async notifySubmission(projectId: string, enterpriseName: string): Promise<void> {
    await this.safely('submission', () =>
      this.repository.createForProjectDepartments({
        projectId,
        type: 'submission_received',
        data: { enterpriseName },
      }),
    );
  }

  async notifyClarificationRequested(
    applicantUserId: string,
    projectId: string,
    approvalTitle: string,
  ): Promise<void> {
    await this.safely('clarification-requested', () =>
      this.repository.createMany([
        {
          userId: applicantUserId,
          type: 'clarification_requested',
          data: { approvalTitle },
          projectId,
        },
      ]),
    );
  }

  async notifyClarificationAnswered(clarificationId: string): Promise<void> {
    await this.safely('clarification-answered', () =>
      this.repository.createClarificationAnswered(clarificationId),
    );
  }

  async notifyApprovalDecided(
    applicantUserId: string,
    projectId: string,
    data: { approvalTitle: string; decision: string },
  ): Promise<void> {
    await this.safely('approval-decided', () =>
      this.repository.createMany([
        { userId: applicantUserId, type: 'approval_decided', data, projectId },
      ]),
    );
  }

  async notifyCertificateIssued(
    applicantUserId: string,
    projectId: string,
    certificateNumber: string,
  ): Promise<void> {
    await this.safely('certificate-issued', () =>
      this.repository.createMany([
        {
          userId: applicantUserId,
          type: 'certificate_issued',
          data: { certificateNumber },
          projectId,
        },
      ]),
    );
  }
}
