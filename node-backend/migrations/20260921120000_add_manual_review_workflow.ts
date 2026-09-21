import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  for (const status of ['under_review', 'correction_required', 'approved', 'rejected']) {
    pgm.addTypeValue('project_status', status, { ifNotExists: true });
  }

  pgm.createType('approval_review_status', [
    'pending',
    'under_review',
    'correction_required',
    'approved',
    'rejected',
  ]);
  pgm.createType('document_review_status', [
    'pending',
    'accepted',
    'correction_required',
    'rejected',
  ]);
  pgm.createType('clarification_status', ['open', 'responded', 'resolved']);

  pgm.addColumns('projects', {
    submitted_at: { type: 'timestamptz' },
    review_started_at: { type: 'timestamptz' },
    decided_at: { type: 'timestamptz' },
  });
  pgm.createIndex('projects', ['status', 'submitted_at'], {
    name: 'projects_status_submitted_at_idx',
  });

  pgm.addColumns('project_approvals', {
    review_status: { type: 'approval_review_status', notNull: true, default: 'pending' },
    review_started_at: { type: 'timestamptz' },
    decided_at: { type: 'timestamptz' },
    decided_by: { type: 'uuid' },
    decision_note: { type: 'text' },
  });
  pgm.addConstraint('project_approvals', 'project_approvals_decided_by_fk', {
    foreignKeys: { columns: 'decided_by', references: 'users(id)', onDelete: 'SET NULL' },
  });
  pgm.createIndex('project_approvals', ['department_id', 'review_status'], {
    name: 'project_approvals_department_review_status_idx',
  });
  pgm.createTable('document_reviews', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true },
    approval_id: { type: 'uuid', notNull: true },
    document_id: { type: 'uuid', notNull: true, unique: true },
    inspector_id: { type: 'uuid', notNull: true },
    status: { type: 'document_review_status', notNull: true },
    comment: { type: 'text' },
    reviewed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('document_reviews', 'document_reviews_project_fk', {
    foreignKeys: { columns: 'project_id', references: 'projects(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('document_reviews', 'document_reviews_approval_fk', {
    foreignKeys: {
      columns: 'approval_id',
      references: 'project_approvals(id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('document_reviews', 'document_reviews_document_fk', {
    foreignKeys: {
      columns: 'document_id',
      references: 'project_documents(id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('document_reviews', 'document_reviews_inspector_fk', {
    foreignKeys: { columns: 'inspector_id', references: 'users(id)', onDelete: 'RESTRICT' },
  });
  pgm.createIndex('document_reviews', ['project_id', 'approval_id'], {
    name: 'document_reviews_project_approval_idx',
  });
  pgm.sql(`CREATE TRIGGER document_reviews_set_updated_at
    BEFORE UPDATE ON document_reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();`);

  pgm.createTable('application_status_history', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true },
    approval_id: { type: 'uuid' },
    actor_id: { type: 'uuid', notNull: true },
    from_status: { type: 'varchar(40)', notNull: true },
    to_status: { type: 'varchar(40)', notNull: true },
    note: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  for (const [name, column, table, onDelete] of [
    ['application_status_history_project_fk', 'project_id', 'projects', 'CASCADE'],
    ['application_status_history_approval_fk', 'approval_id', 'project_approvals', 'CASCADE'],
    ['application_status_history_actor_fk', 'actor_id', 'users', 'RESTRICT'],
  ] as const) {
    pgm.addConstraint('application_status_history', name, {
      foreignKeys: { columns: column, references: `${table}(id)`, onDelete },
    });
  }
  pgm.createIndex('application_status_history', ['project_id', 'created_at'], {
    name: 'application_status_history_project_created_idx',
  });

  pgm.createTable('clarification_requests', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true },
    approval_id: { type: 'uuid', notNull: true },
    document_id: { type: 'uuid' },
    inspector_id: { type: 'uuid', notNull: true },
    message: { type: 'text', notNull: true },
    status: { type: 'clarification_status', notNull: true, default: 'open' },
    due_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('clarification_requests', 'clarification_requests_project_fk', {
    foreignKeys: { columns: 'project_id', references: 'projects(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('clarification_requests', 'clarification_requests_approval_fk', {
    foreignKeys: {
      columns: 'approval_id',
      references: 'project_approvals(id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('clarification_requests', 'clarification_requests_document_fk', {
    foreignKeys: {
      columns: 'document_id',
      references: 'project_documents(id)',
      onDelete: 'SET NULL',
    },
  });
  pgm.addConstraint('clarification_requests', 'clarification_requests_inspector_fk', {
    foreignKeys: { columns: 'inspector_id', references: 'users(id)', onDelete: 'RESTRICT' },
  });
  pgm.createIndex('clarification_requests', ['project_id', 'status'], {
    name: 'clarification_requests_project_status_idx',
  });
  pgm.sql(`CREATE TRIGGER clarification_requests_set_updated_at
    BEFORE UPDATE ON clarification_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();`);

  pgm.createTable('clarification_responses', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    clarification_id: { type: 'uuid', notNull: true },
    applicant_id: { type: 'uuid', notNull: true },
    message: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('clarification_responses', 'clarification_responses_request_fk', {
    foreignKeys: {
      columns: 'clarification_id',
      references: 'clarification_requests(id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('clarification_responses', 'clarification_responses_applicant_fk', {
    foreignKeys: { columns: 'applicant_id', references: 'users(id)', onDelete: 'RESTRICT' },
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('clarification_responses');
  pgm.dropTable('clarification_requests');
  pgm.dropTable('application_status_history');
  pgm.dropTable('document_reviews');
  pgm.dropColumns('project_approvals', [
    'review_status',
    'review_started_at',
    'decided_at',
    'decided_by',
    'decision_note',
  ]);
  pgm.dropColumns('projects', ['submitted_at', 'review_started_at', 'decided_at']);
  pgm.dropType('clarification_status');
  pgm.dropType('document_review_status');
  pgm.dropType('approval_review_status');
  pgm.sql(`ALTER TYPE project_status RENAME TO project_status_with_review;
    CREATE TYPE project_status AS ENUM ('draft', 'submitted');
    ALTER TABLE projects ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE projects ALTER COLUMN status TYPE project_status USING status::text::project_status;
    ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'draft';
    DROP TYPE project_status_with_review;`);
};
