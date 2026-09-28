import { query } from '../../database/database.js';
import type { Certificate, CertificateProject, CertificateStatus } from './certificate.types.js';

interface CertificateRow {
  id: string;
  project_id: string;
  certificate_number: string;
  verification_code: string;
  status: CertificateStatus;
  storage_key: string;
  issued_by: string | null;
  issued_at: Date;
  revoked_at: Date | null;
  revoke_reason: string | null;
}

const mapCertificate = (row: CertificateRow): Certificate => ({
  id: row.id,
  projectId: row.project_id,
  certificateNumber: row.certificate_number,
  verificationCode: row.verification_code,
  status: row.status,
  storageKey: row.storage_key,
  issuedById: row.issued_by,
  issuedAt: row.issued_at.toISOString(),
  revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
  revokeReason: row.revoke_reason,
});

const CERTIFICATE_COLUMNS = `id, project_id, certificate_number, verification_code, status,
  storage_key, issued_by, issued_at, revoked_at, revoke_reason`;

export class CertificateRepository {
  /** Project facts needed to render and issue a certificate. */
  async getProject(projectId: string): Promise<CertificateProject | null> {
    const projectResult = await query<{
      applicant_id: string;
      enterprise_name: string;
      industry: string;
      district: string;
      status: string;
      applicant_name: string;
    }>(
      `SELECT p.applicant_id, p.enterprise_name, p.industry, p.district, p.status,
              COALESCE(u.name, u.phone_number) AS applicant_name
         FROM projects p
         JOIN users u ON u.id = p.applicant_id
        WHERE p.id = $1`,
      [projectId],
    );
    const project = projectResult.rows[0];
    if (!project) return null;

    const approvalsResult = await query<{
      approval_key: string;
      title: string;
      review_status: string;
    }>(
      `SELECT approval_key, title, review_status
         FROM project_approvals
        WHERE project_id = $1
        ORDER BY approval_key`,
      [projectId],
    );

    return {
      projectId,
      applicantId: project.applicant_id,
      enterpriseName: project.enterprise_name,
      industry: project.industry,
      district: project.district,
      applicantName: project.applicant_name,
      status: project.status,
      approvals: approvalsResult.rows.map((row) => ({
        approvalKey: row.approval_key,
        title: row.title,
        reviewStatus: row.review_status,
      })),
    };
  }

  async nextCertificateNumber(): Promise<string> {
    const result = await query<{ seq: string }>(`SELECT nextval('certificate_number_seq') AS seq`);
    const seq = Number(result.rows[0]?.seq ?? 0);
    const year = new Date().getFullYear();
    return `MH-CLR-${year}-${String(seq).padStart(6, '0')}`;
  }

  async create(input: {
    projectId: string;
    certificateNumber: string;
    verificationCode: string;
    storageKey: string;
    issuedById: string | null;
  }): Promise<Certificate> {
    const result = await query<CertificateRow>(
      `INSERT INTO certificates
         (project_id, certificate_number, verification_code, storage_key, issued_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${CERTIFICATE_COLUMNS}`,
      [
        input.projectId,
        input.certificateNumber,
        input.verificationCode,
        input.storageKey,
        input.issuedById,
      ],
    );
    return mapCertificate(result.rows[0]!);
  }

  async findByProject(projectId: string): Promise<Certificate | null> {
    const result = await query<CertificateRow>(
      `SELECT ${CERTIFICATE_COLUMNS} FROM certificates WHERE project_id = $1`,
      [projectId],
    );
    return result.rows[0] ? mapCertificate(result.rows[0]) : null;
  }

  async findByVerificationCode(code: string): Promise<Certificate | null> {
    const result = await query<CertificateRow>(
      `SELECT ${CERTIFICATE_COLUMNS} FROM certificates WHERE verification_code = $1`,
      [code],
    );
    return result.rows[0] ? mapCertificate(result.rows[0]) : null;
  }

  async revoke(projectId: string, reason: string): Promise<Certificate | null> {
    const result = await query<CertificateRow>(
      `UPDATE certificates
          SET status = 'revoked', revoked_at = NOW(), revoke_reason = $2
        WHERE project_id = $1 AND status = 'active'
        RETURNING ${CERTIFICATE_COLUMNS}`,
      [projectId, reason],
    );
    return result.rows[0] ? mapCertificate(result.rows[0]) : null;
  }
}
