import { Router } from 'express';

import { env } from '../../config/env.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import type { AuthController } from './auth.controller.js';
import { requireAuthentication } from './auth.middleware.js';

export const createAuthRouter = (controller: AuthController): Router => {
  const router = Router();
  const authRateLimiter = createRateLimiter({
    name: 'auth',
    limit: env.AUTH_RATE_LIMIT,
    windowSeconds: env.AUTH_RATE_WINDOW_SECONDS,
  });
  router.post('/register', controller.register);
  router.post('/otp/verify', controller.verifyOtp);
  router.post('/otp/resend', controller.resendOtp);
  router.post('/login', authRateLimiter, controller.login);
  router.post('/password/forgot', authRateLimiter, controller.forgotPassword);
  router.post('/password/reset', authRateLimiter, controller.resetPassword);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuthentication, controller.me);
  return router;
};
