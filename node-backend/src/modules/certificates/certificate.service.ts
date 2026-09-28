import { randomBytes } from 'node:crypto';

import { AppError } from '../../errors/app-error.js';
import { logger } from '../../config/logger.js';
import type { ObjectStorage } from '../../integrations/s3/storage.js';
import { renderCertificatePdf } from './certificate.pdf.js';
import type { NotificationService } from '../notifications/notification.service.js';
import type { CertificateRepository } from './certificate.repository.js';
import type { Certificate, CertificateSummary, PublicCertificate } from './certificate.types.js';

export class CertificateService {
  constructor(
    private readonly repository: CertificateRepository,
    private readonly storage: ObjectStorage | null,
    private readonly publicBaseUrl: string,
    private readonly notifications: NotificationService | null = null,
  ) {}

  private verifyUrl(verificationCode: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/verify/${verificationCode}`;
  }

  private toSummary(certificate: Certificate): CertificateSummary {
    return {
      certificateNumber: certificate.certificateNumber,
      status: certificate.status,
      issuedAt: certificate.issuedAt,
      revokedAt: certificate.revokedAt,
      revokeReason: certificate.revokeReason,
      verifyUrl: this.verifyUrl(certificate.verificationCode),
    };
  }

  /**
   * Issue a certificate for a fully approved project. Idempotent: returns the
   * existing certificate when one is already present, and never issues for a
   * project that is not approved.
   */
  async issueForProject(projectId: string, issuedById: string | null): Promise<Certificate | null> {
    const existing = await this.repository.findByProject(projectId);
    if (existing) return existing;

    if (!this.storage) {
      logger.warn({ projectId }, 'Certificate storage not configured; skipping issuance');
      return null;
    }

    const project = await this.repository.getProject(projectId);
    if (!project) return null;
    if (project.status !== 'approved') {
      logger.warn(
        { projectId, status: project.status },
        'Refusing to issue certificate for a project that is not approved',
      );
      return null;
    }

    const certificateNumber = await this.repository.nextCertificateNumber();
    const verificationCode = randomBytes(12).toString('hex');
    const storageKey = `certificates/${projectId}/${certificateNumber}.pdf`;
    const issuedAt = new Date().toISOString();

    const pdf = await renderCertificatePdf({
      project,
      certificateNumber,
      issuedAt,
      verifyUrl: this.verifyUrl(verificationCode),
    });
    await this.storage.put(storageKey, pdf, 'application/pdf');

    const certificate = await this.repository.create({
      projectId,
      certificateNumber,
      verificationCode,
      storageKey,
      issuedById,
    });

    await this.notifications?.notifyCertificateIssued(
      project.applicantId,
      projectId,
      certificateNumber,
    );

    return certificate;
  }

  /** Issue without letting a failure disrupt the caller (e.g. the decision flow). */
  async issueForProjectSafely(projectId: string, issuedById: string | null): Promise<void> {
    try {
      await this.issueForProject(projectId, issuedById);
    } catch (error) {
      logger.error({ err: error, projectId }, 'Certificate issuance failed after approval');
    }
  }

  async getForProject(projectId: string): Promise<CertificateSummary> {
    const certificate = await this.repository.findByProject(projectId);
    if (!certificate) {
      throw new AppError('No certificate has been issued for this project', {
        statusCode: 404,
        code: 'CERTIFICATE_NOT_FOUND',
      });
    }
    return this.toSummary(certificate);
  }

  async getDownloadUrl(projectId: string): Promise<string> {
    if (!this.storage) {
      throw new AppError('Certificate storage is not configured', {
        statusCode: 503,
        code: 'UPLOADS_NOT_CONFIGURED',
      });
    }
    const certificate = await this.repository.findByProject(projectId);
    if (!certificate) {
      throw new AppError('No certificate has been issued for this project', {
        statusCode: 404,
        code: 'CERTIFICATE_NOT_FOUND',
      });
    }
    return this.storage.signedGetUrl(
      certificate.storageKey,
      `${certificate.certificateNumber}.pdf`,
    );
  }

  async revoke(projectId: string, reason: string): Promise<CertificateSummary> {
    const revoked = await this.repository.revoke(projectId, reason);
    if (!revoked) {
      throw new AppError('No active certificate to revoke for this project', {
        statusCode: 404,
        code: 'CERTIFICATE_NOT_FOUND',
      });
    }
    return this.toSummary(revoked);
  }

  /** Public, unauthenticated verification. Returns only non-sensitive fields. */
  async verify(verificationCode: string): Promise<PublicCertificate> {
    const certificate = await this.repository.findByVerificationCode(verificationCode);
    if (!certificate) {
      throw new AppError('Certificate not found', {
        statusCode: 404,
        code: 'CERTIFICATE_NOT_FOUND',
      });
    }
    const project = await this.repository.getProject(certificate.projectId);
    return {
      valid: certificate.status === 'active',
      certificateNumber: certificate.certificateNumber,
      status: certificate.status,
      enterpriseName: project?.enterpriseName ?? '',
      district: project?.district ?? '',
      issuedAt: certificate.issuedAt,
    };
  }
}
