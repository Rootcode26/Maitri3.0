import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { checkRedisHealth, type RedisHealth } from './cache/redis.js';
import { logger } from './config/logger.js';
import { HealthController } from './controllers/health.controller.js';
import { checkDatabaseHealth, type DatabaseHealth } from './database/database.js';
import { errorHandler } from './middleware/error-handler.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { OtpService } from './modules/auth/otp.service.js';
import { otpProvider } from './modules/auth/otp-provider.js';
import { notFoundHandler } from './middleware/not-found.js';
import { HealthRepository } from './repositories/health.repository.js';
import { createV1Router } from './routes/v1/index.js';
import { HealthService } from './services/health.service.js';

interface AppOptions {
  isReady?: () => boolean;
  checkDatabase?: () => Promise<DatabaseHealth>;
  checkRedis?: () => Promise<RedisHealth>;
}

export const createApp = ({
  isReady = () => true,
  checkDatabase = checkDatabaseHealth,
  checkRedis = checkRedisHealth,
}: AppOptions = {}): Express => {
  const app = express();
  const healthRepository = new HealthRepository(checkDatabase, checkRedis);
  const healthService = new HealthService(healthRepository, isReady);
  const healthController = new HealthController(healthService);
  const authController = new AuthController(
    new AuthService(new AuthRepository(), new OtpService(otpProvider)),
  );

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api/v1', createV1Router(healthController, authController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
