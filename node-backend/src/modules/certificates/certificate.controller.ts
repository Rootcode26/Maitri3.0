import type { RequestHandler } from 'express';

import { verificationParamsSchema } from './certificate.schemas.js';
import type { CertificateService } from './certificate.service.js';

export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  /** Public, unauthenticated certificate verification. */
  readonly verify: RequestHandler = async (request, response) => {
    const { verificationCode } = verificationParamsSchema.parse(request.params);
    const certificate = await this.service.verify(verificationCode);
    response.status(200).json({ status: 'success', data: { certificate } });
  };
}
