import { Router } from 'express';

import { requireAuthentication } from '../auth/auth.middleware.js';
import type { NotificationController } from './notification.controller.js';

/** Notifications are per-user; any authenticated user reads their own. */
export const createNotificationRouter = (controller: NotificationController): Router => {
  const router = Router();
  router.use(requireAuthentication);
  router.get('/', controller.list);
  router.get('/unread-count', controller.unreadCount);
  router.post('/read-all', controller.markAllRead);
  router.post('/:notificationId/read', controller.markRead);
  return router;
};
