import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  pgm.createType('document_read_status', [
    'not_checked',
    'readable',
    'unreadable',
    'password_protected',
  ]);
  pgm.createType('document_extraction_status', [
    'not_run',
    'succeeded',
    'failed',
    'review_required',
  ]);

  pgm.createTable('project_documents', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true },
    approval_key: { type: 'varchar(60)', notNull: true },
    document_key: { type: 'varchar(100)', notNull: true },
    version: { type: 'integer', notNull: true, default: 1 },
    file_name: { type: 'varchar(255)', notNull: true },
    mime_type: { type: 'varchar(255)', notNull: true },
    detected_mime_type: { type: 'varchar(255)' },
    size_bytes: { type: 'bigint', notNull: true },
    storage_key: { type: 'text', notNull: true },
    file_read_status: { type: 'document_read_status', notNull: true, default: 'readable' },
    extraction_status: {
      type: 'document_extraction_status',
      notNull: true,
      default: 'not_run',
    },
    expires_on: { type: 'date' },
    uploaded_by: { type: 'uuid', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('project_documents', 'project_documents_project_id_fk', {
    foreignKeys: { columns: 'project_id', references: 'projects(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('project_documents', 'project_documents_uploaded_by_fk', {
    foreignKeys: { columns: 'uploaded_by', references: 'users(id)', onDelete: 'RESTRICT' },
  });
  pgm.addConstraint('project_documents', 'project_documents_size_positive_check', {
    check: 'size_bytes > 0',
  });
  pgm.addConstraint('project_documents', 'project_documents_unique_version', {
    unique: ['project_id', 'approval_key', 'document_key', 'version'],
  });
  pgm.createIndex('project_documents', 'project_id', {
    name: 'project_documents_project_id_idx',
  });

  pgm.sql(
    `CREATE TRIGGER project_documents_set_updated_at
     BEFORE UPDATE ON project_documents
     FOR EACH ROW EXECUTE FUNCTION set_updated_at();`,
  );
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('project_documents');
  pgm.dropType('document_extraction_status');
  pgm.dropType('document_read_status');
};
