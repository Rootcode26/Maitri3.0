import { describe, expect, it, vi } from 'vitest';

import type { NotificationRepository } from '../src/modules/notifications/notification.repository.js';
import { NotificationService } from '../src/modules/notifications/notification.service.js';

const makeService = (repository: Partial<NotificationRepository>) =>
  new NotificationService(repository as NotificationRepository);

describe('NotificationService', () => {
  it('lists and counts a user’s notifications', async () => {
    const listForUser = vi.fn().mockResolvedValue([]);
    const unreadCount = vi.fn().mockResolvedValue(3);
    const service = makeService({ listForUser, unreadCount });

    await service.list('user-1');
    expect(listForUser).toHaveBeenCalledWith('user-1', 30);

    expect(await service.unreadCount('user-1')).toBe(3);
  });

  it('marks one and all as read', async () => {
    const markRead = vi.fn().mockResolvedValue(true);
    const markAllRead = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ markRead, markAllRead });

    await service.markRead('user-1', 'notif-1');
    expect(markRead).toHaveBeenCalledWith('user-1', 'notif-1');

    await service.markAllRead('user-1');
    expect(markAllRead).toHaveBeenCalledWith('user-1');
  });

  it('fans a submission out to the project’s department inspectors', async () => {
    const createForProjectDepartments = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ createForProjectDepartments });

    await service.notifySubmission('project-1', 'Steel Works');
    expect(createForProjectDepartments).toHaveBeenCalledWith({
      projectId: 'project-1',
      type: 'submission_received',
      data: { enterpriseName: 'Steel Works' },
    });
  });

  it('notifies the applicant when an approval is decided', async () => {
    const createMany = vi.fn().mockResolvedValue(undefined);
    const service = makeService({ createMany });

    await service.notifyApprovalDecided('applicant-1', 'project-1', {
      approvalTitle: 'Factory registration',
      decision: 'approved',
    });
    expect(createMany).toHaveBeenCalledWith([
      {
        userId: 'applicant-1',
        type: 'approval_decided',
        data: { approvalTitle: 'Factory registration', decision: 'approved' },
        projectId: 'project-1',
      },
    ]);
  });

  it('never throws when a notification insert fails', async () => {
    const service = makeService({
      createForProjectDepartments: vi.fn().mockRejectedValue(new Error('db down')),
      createMany: vi.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(service.notifySubmission('p', 'E')).resolves.toBeUndefined();
    await expect(
      service.notifyCertificateIssued('u', 'p', 'MH-CLR-2026-000001'),
    ).resolves.toBeUndefined();
  });
});
