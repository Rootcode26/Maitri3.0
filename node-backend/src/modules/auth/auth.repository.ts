import type { PoolClient } from 'pg';

import { databasePool, query } from '../../database/database.js';
import type { AuthUser, UserRole, UserStatus } from './auth.types.js';

interface UserRow {
  id: string;
  name: string;
  phone_number: string | null;
  password_hash: string | null;
  role: UserRole;
  status: UserStatus;
  department_id: string | null;
  industry: 'food' | 'textile' | 'steel' | null;
}

interface StoredUser extends AuthUser {
  passwordHash: string | null;
}

const mapUser = (row: UserRow): StoredUser => ({
  id: row.id,
  name: row.name,
  phoneNumber: row.phone_number,
  passwordHash: row.password_hash,
  role: row.role,
  status: row.status,
  departmentId: row.department_id,
  industry: row.industry,
});

const toAuthUser = (user: StoredUser): AuthUser => ({
  id: user.id,
  name: user.name,
  phoneNumber: user.phoneNumber,
  role: user.role,
  status: user.status,
  departmentId: user.departmentId,
  industry: user.industry,
});

export class AuthRepository {
  async findUserById(userId: string): Promise<AuthUser | null> {
    const result = await query<UserRow>(
      `SELECT id, name, phone_number, password_hash, role, status, department_id, industry
       FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows[0] ? toAuthUser(mapUser(result.rows[0])) : null;
  }

  async findUserByPhone(phoneNumber: string): Promise<StoredUser | null> {
    const result = await query<UserRow>(
      `SELECT id, name, phone_number, password_hash, role, status, department_id, industry
       FROM users WHERE phone_number = $1`,
      [phoneNumber],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async createPendingUser(input: {
    name: string;
    phoneNumber: string;
    passwordHash: string;
    role: 'applicant' | 'inspector';
    industry?: 'food' | 'textile' | 'steel';
    departmentKey?: string;
  }): Promise<AuthUser> {
    const result = await query<UserRow>(
      `INSERT INTO users (name, phone_number, password_hash, role, status, industry, department_id)
       VALUES ($1, $2, $3, $4, 'pending_verification', $5,
         (SELECT id FROM departments WHERE "key" = $6))
       RETURNING id, name, phone_number, password_hash, role, status, department_id, industry`,
      [
        input.name,
        input.phoneNumber,
        input.passwordHash,
        input.role,
        input.industry ?? null,
        input.departmentKey ?? null,
      ],
    );
    return toAuthUser(mapUser(result.rows[0]!));
  }

  async activatePendingUser(userId: string, phoneNumber: string): Promise<AuthUser | null> {
    const result = await query<UserRow>(
      `UPDATE users
       SET status = 'active', phone_verified_at = NOW()
       WHERE id = $1 AND phone_number = $2 AND role IN ('applicant', 'inspector')
         AND status = 'pending_verification' AND phone_verified_at IS NULL
       RETURNING id, name, phone_number, password_hash, role, status, department_id, industry`,
      [userId, phoneNumber],
    );
    return result.rows[0] ? toAuthUser(mapUser(result.rows[0])) : null;
  }

  async storeRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    client?: PoolClient,
  ): Promise<void> {
    const executor = client ?? databasePool;
    await executor.query(
      `INSERT INTO refresh_tokens (user_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async rotateRefreshToken(
    currentHash: string,
    nextHash: string,
    nextExpiresAt: Date,
  ): Promise<AuthUser | null> {
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<UserRow>(
        `UPDATE refresh_tokens AS token
         SET revoked_at = NOW()
         FROM users
         WHERE token.refresh_token_hash = $1
           AND token.user_id = users.id
           AND token.revoked_at IS NULL
           AND token.expires_at > NOW()
           AND users.status = 'active'
         RETURNING users.id, users.name, users.phone_number, users.password_hash,
                   users.role, users.status, users.department_id, users.industry`,
        [currentHash],
      );

      const row = result.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return null;
      }

      await this.storeRefreshToken(row.id, nextHash, nextExpiresAt, client);
      await client.query('COMMIT');
      return toAuthUser(mapUser(row));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async updatePassword(
    userId: string,
    phoneNumber: string,
    passwordHash: string,
  ): Promise<boolean> {
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE users SET password_hash = $1
         WHERE id = $2 AND phone_number = $3 AND status = 'active'`,
        [passwordHash, userId, phoneNumber],
      );
      if (result.rowCount !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
