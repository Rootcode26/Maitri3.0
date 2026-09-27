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
import { DocumentController } from './modules/documents/document.controller.js';
import { DocumentRepository } from './modules/documents/document.repository.js';
import { DocumentService } from './modules/documents/document.service.js';
import { createValidationClient } from './modules/documents/document.validation-client.js';
import { ProjectController } from './modules/projects/project.controller.js';
import { ProjectRepository } from './modules/projects/project.repository.js';
import { createRulesEngineClient } from './modules/projects/project.rules-client.js';
import { ProjectService } from './modules/projects/project.service.js';
import { InspectorController } from './modules/inspector/inspector.controller.js';
import { InspectorRepository } from './modules/inspector/inspector.repository.js';
import { InspectorService } from './modules/inspector/inspector.service.js';
import { CertificateController } from './modules/certificates/certificate.controller.js';
import { CertificateRepository } from './modules/certificates/certificate.repository.js';
import { CertificateService } from './modules/certificates/certificate.service.js';
import { createMalwareScanner } from './integrations/clamav/scanner.js';
import { createObjectStorage } from './integrations/s3/storage.js';
import { localizationMiddleware } from './i18n/index.js';
import { env } from './config/env.js';
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
  const projectRepository = new ProjectRepository();
  const objectStorage = createObjectStorage(env);
  const validationClient = createValidationClient(env);
  const documentService = new DocumentService(
    projectRepository,
    new DocumentRepository(),
    objectStorage,
    createMalwareScanner(env),
    validationClient,
    {
      defaultMaxSizeMb: env.UPLOAD_MAX_SIZE_MB,
      rulesVersion: env.RULES_VERSION,
      includeDocumentBytes: env.VALIDATION_INCLUDE_DOCUMENT_BYTES,
    },
  );
  const documentController = new DocumentController(documentService);
  const certificateService = new CertificateService(
    new CertificateRepository(),
    objectStorage,
    env.PUBLIC_BASE_URL,
  );
  const certificateController = new CertificateController(certificateService);
  // The document service doubles as the submission validator, but only when the
  // validation engine is actually configured; otherwise submission keeps its
  // required-documents check without a hard validation gate.
  const projectController = new ProjectController(
    new ProjectService(
      projectRepository,
      createRulesEngineClient(env),
      validationClient ? documentService : null,
      certificateService,
    ),
  );
  const inspectorController = new InspectorController(
    new InspectorService(new InspectorRepository(), objectStorage, certificateService),
  );

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cookieParser());
  app.use(localizationMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(
    '/api/v1',
    createV1Router(
      healthController,
      authController,
      projectController,
      documentController,
      inspectorController,
      certificateController,
    ),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
