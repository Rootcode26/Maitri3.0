import type { RequestHandler } from 'express';

import type { HealthService } from '../services/health.service.js';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  readonly live: RequestHandler = (_request, response) => {
    response.status(200).json(this.healthService.getLiveness());
  };

  readonly ready: RequestHandler = async (_request, response) => {
    const result = await this.healthService.getReadiness();
    response.status(result.status === 'ready' ? 200 : 503).json(result);
  };
}
