import { z } from 'zod';

export const notificationParamsSchema = z.object({ notificationId: z.uuid() });
