import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  pgm.createType('user_role', ['applicant', 'officer', 'admin']);
  pgm.createType('user_status', ['pending_verification', 'active', 'suspended']);

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: { type: 'varchar(150)', notNull: true },
    phone_number: { type: 'varchar(16)' },
    password_hash: { type: 'text' },
    phone_verified_at: { type: 'timestamptz' },
    role: { type: 'user_role', notNull: true },
    status: {
      type: 'user_status',
      notNull: true,
      default: 'pending_verification',
    },
    department_id: { type: 'uuid' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('users', 'users_name_not_blank_check', {
    check: "btrim(name) <> ''",
  });
  pgm.addConstraint('users', 'users_phone_number_e164_check', {
    check: "phone_number IS NULL OR phone_number ~ '^\\+[1-9][0-9]{7,14}$'",
  });
  pgm.addConstraint('users', 'users_password_requires_phone_check', {
    check: 'password_hash IS NULL OR phone_number IS NOT NULL',
  });
  pgm.addConstraint('users', 'users_verified_phone_check', {
    check: 'phone_verified_at IS NULL OR phone_number IS NOT NULL',
  });
  pgm.addConstraint('users', 'users_admin_has_no_password_check', {
    check: "role <> 'admin' OR password_hash IS NULL",
  });
  pgm.addConstraint('users', 'users_department_scope_check', {
    check:
      "(role = 'officer' AND department_id IS NOT NULL) OR " +
      "(role IN ('applicant', 'admin') AND department_id IS NULL)",
  });

  pgm.createIndex('users', 'phone_number', {
    name: 'users_phone_number_unique_idx',
    unique: true,
    where: 'phone_number IS NOT NULL',
  });
  pgm.createIndex('users', ['role', 'status'], {
    name: 'users_role_status_idx',
  });
  pgm.createIndex('users', 'department_id', {
    name: 'users_department_id_idx',
    where: 'department_id IS NOT NULL',
  });

  pgm.sql(`
    CREATE FUNCTION set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);

  pgm.createTable('refresh_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    refresh_token_hash: { type: 'text', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('refresh_tokens', 'refresh_tokens_expiry_check', {
    check: 'expires_at > created_at',
  });
  pgm.addConstraint('refresh_tokens', 'refresh_tokens_revoked_at_check', {
    check: 'revoked_at IS NULL OR revoked_at >= created_at',
  });
  pgm.createIndex('refresh_tokens', 'user_id', {
    name: 'refresh_tokens_user_id_idx',
  });
  pgm.createIndex('refresh_tokens', 'expires_at', {
    name: 'refresh_tokens_expires_at_idx',
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('refresh_tokens');
  pgm.sql('DROP TRIGGER users_set_updated_at ON users;');
  pgm.dropTable('users');
  pgm.sql('DROP FUNCTION set_updated_at();');
  pgm.dropType('user_status');
  pgm.dropType('user_role');
};
