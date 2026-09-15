import { Router } from 'express';

import type { AuthController } from './auth.controller.js';
import { requireAuthentication } from './auth.middleware.js';

export const createAuthRouter = (controller: AuthController): Router => {
  const router = Router();
  router.post('/register', controller.register);
  router.post('/otp/verify', controller.verifyOtp);
  router.post('/otp/resend', controller.resendOtp);
  router.post('/login', controller.login);
  router.post('/password/forgot', controller.forgotPassword);
  router.post('/password/reset', controller.resetPassword);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuthentication, controller.me);
  return router;
};
