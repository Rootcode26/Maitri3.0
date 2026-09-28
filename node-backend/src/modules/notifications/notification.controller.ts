import type { RequestHandler } from 'express';

import { notificationParamsSchema } from './notification.schemas.js';
import type { NotificationService } from './notification.service.js';

export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  readonly list: RequestHandler = async (request, response) => {
    const [notifications, unreadCount] = await Promise.all([
      this.service.list(request.user!.userId),
      this.service.unreadCount(request.user!.userId),
    ]);
    response.status(200).json({ status: 'success', data: { notifications, unreadCount } });
  };

  readonly unreadCount: RequestHandler = async (request, response) => {
    const unreadCount = await this.service.unreadCount(request.user!.userId);
    response.status(200).json({ status: 'success', data: { unreadCount } });
  };

  readonly markRead: RequestHandler = async (request, response) => {
    const { notificationId } = notificationParamsSchema.parse(request.params);
    await this.service.markRead(request.user!.userId, notificationId);
    response.status(200).json({ status: 'success', data: { ok: true } });
  };

  readonly markAllRead: RequestHandler = async (request, response) => {
    await this.service.markAllRead(request.user!.userId);
    response.status(200).json({ status: 'success', data: { ok: true } });
  };
}
