export type CertificateStatus = 'active' | 'revoked';

/** A stored clearance certificate for a fully approved project. */
export interface Certificate {
  id: string;
  projectId: string;
  certificateNumber: string;
  verificationCode: string;
  status: CertificateStatus;
  storageKey: string;
  issuedById: string | null;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

/** Certificate metadata returned to an authenticated inspector or applicant. */
export interface CertificateSummary {
  certificateNumber: string;
  status: CertificateStatus;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  verifyUrl: string;
}

/** The minimal, non-sensitive view returned by the public verification route. */
export interface PublicCertificate {
  valid: boolean;
  certificateNumber: string;
  status: CertificateStatus;
  enterpriseName: string;
  district: string;
  issuedAt: string;
}

/** Project facts needed to render a certificate PDF. */
export interface CertificateProject {
  projectId: string;
  applicantId: string;
  enterpriseName: string;
  industry: string;
  district: string;
  applicantName: string;
  status: string;
  approvals: { approvalKey: string; title: string; reviewStatus: string }[];
}
