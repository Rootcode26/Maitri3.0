import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  pgm.createType('project_status', ['draft', 'submitted']);
  pgm.createType('approval_status', ['required', 'recommended']);

  pgm.createTable('projects', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    applicant_id: { type: 'uuid', notNull: true },
    enterprise_name: { type: 'varchar(150)', notNull: true },
    industry: { type: 'industry_type', notNull: true },
    district: { type: 'varchar(80)', notNull: true },
    primary_activity: { type: 'varchar(80)', notNull: true },
    status: { type: 'project_status', notNull: true, default: 'submitted' },
    details: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('projects', 'projects_enterprise_name_not_blank_check', {
    check: "btrim(enterprise_name) <> ''",
  });
  pgm.addConstraint('projects', 'projects_applicant_id_fk', {
    foreignKeys: { columns: 'applicant_id', references: 'users(id)', onDelete: 'CASCADE' },
  });
  pgm.createIndex('projects', 'applicant_id', { name: 'projects_applicant_id_idx' });
  pgm.sql(
    `CREATE TRIGGER projects_set_updated_at
     BEFORE UPDATE ON projects
     FOR EACH ROW EXECUTE FUNCTION set_updated_at();`,
  );

  pgm.createTable('project_approvals', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true },
    approval_key: { type: 'varchar(60)', notNull: true },
    title: { type: 'varchar(120)', notNull: true },
    department_id: { type: 'uuid', notNull: true },
    status: { type: 'approval_status', notNull: true },
    documents: { type: 'jsonb', notNull: true },
    processing_days: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('project_approvals', 'project_approvals_project_id_fk', {
    foreignKeys: { columns: 'project_id', references: 'projects(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('project_approvals', 'project_approvals_department_id_fk', {
    foreignKeys: { columns: 'department_id', references: 'departments(id)', onDelete: 'RESTRICT' },
  });
  pgm.addConstraint('project_approvals', 'project_approvals_unique_key', {
    unique: ['project_id', 'approval_key'],
  });
  pgm.addConstraint('project_approvals', 'project_approvals_processing_days_positive_check', {
    check: 'processing_days > 0',
  });
  pgm.createIndex('project_approvals', 'project_id', {
    name: 'project_approvals_project_id_idx',
  });
  pgm.createIndex('project_approvals', 'department_id', {
    name: 'project_approvals_department_id_idx',
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('project_approvals');
  pgm.dropTable('projects');
  pgm.dropType('approval_status');
  pgm.dropType('project_status');
};
