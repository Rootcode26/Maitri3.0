export const userRoles = ['applicant', 'inspector'] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ['pending_verification', 'active', 'suspended'] as const;
export type UserStatus = (typeof userStatuses)[number];

export interface AuthUser {
  id: string;
  name: string;
  phoneNumber: string | null;
  role: UserRole;
  status: UserStatus;
  departmentId: string | null;
  industry: 'food' | 'textile' | 'steel' | null;
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  departmentId: string | null;
  jti: string;
  exp: number;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  refreshTtlSeconds: number;
}

export interface RegistrationResult {
  user: AuthUser;
  verificationRequired: true;
}
