import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

// Clearance certificates issued once every required approval on a project has
// been granted. One active certificate per project; permanent unless revoked.
export const up = (pgm: MigrationBuilder): void => {
  pgm.createType('certificate_status', ['active', 'revoked']);

  // Human-readable, gap-tolerant running number for certificate identifiers.
  pgm.createSequence('certificate_number_seq', { start: 1, minvalue: 1 });

  pgm.createTable('certificates', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true },
    certificate_number: { type: 'text', notNull: true },
    verification_code: { type: 'text', notNull: true },
    status: { type: 'certificate_status', notNull: true, default: 'active' },
    storage_key: { type: 'text', notNull: true },
    issued_by: { type: 'uuid' },
    issued_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    revoked_at: { type: 'timestamptz' },
    revoke_reason: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // One certificate per project keeps issuance idempotent.
  pgm.addConstraint('certificates', 'certificates_project_unique', { unique: 'project_id' });
  pgm.addConstraint('certificates', 'certificates_number_unique', { unique: 'certificate_number' });
  pgm.addConstraint('certificates', 'certificates_verification_code_unique', {
    unique: 'verification_code',
  });
  pgm.addConstraint('certificates', 'certificates_project_fk', {
    foreignKeys: { columns: 'project_id', references: 'projects(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('certificates', 'certificates_issued_by_fk', {
    foreignKeys: { columns: 'issued_by', references: 'users(id)', onDelete: 'SET NULL' },
  });

  pgm.sql(`CREATE TRIGGER certificates_set_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();`);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('certificates');
  pgm.dropSequence('certificate_number_seq');
  pgm.dropType('certificate_status');
};
