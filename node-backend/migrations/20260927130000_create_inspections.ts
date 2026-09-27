import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

// Physical site inspections scheduled and recorded by a department against an
// application's approval.
export const up = (pgm: MigrationBuilder): void => {
  pgm.createType('inspection_status', ['scheduled', 'completed', 'cancelled']);
  pgm.createType('inspection_outcome', ['satisfactory', 'needs_follow_up', 'failed']);

  pgm.createTable('inspections', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true },
    approval_id: { type: 'uuid', notNull: true },
    department_id: { type: 'uuid', notNull: true },
    scheduled_at: { type: 'timestamptz', notNull: true },
    status: { type: 'inspection_status', notNull: true, default: 'scheduled' },
    outcome: { type: 'inspection_outcome' },
    notes: { type: 'text' },
    created_by: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('inspections', 'inspections_project_fk', {
    foreignKeys: { columns: 'project_id', references: 'projects(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('inspections', 'inspections_approval_fk', {
    foreignKeys: { columns: 'approval_id', references: 'project_approvals(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('inspections', 'inspections_department_fk', {
    foreignKeys: { columns: 'department_id', references: 'departments(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('inspections', 'inspections_created_by_fk', {
    foreignKeys: { columns: 'created_by', references: 'users(id)', onDelete: 'SET NULL' },
  });
  pgm.createIndex('inspections', ['department_id', 'scheduled_at'], {
    name: 'inspections_department_scheduled_idx',
  });

  pgm.sql(`CREATE TRIGGER inspections_set_updated_at
    BEFORE UPDATE ON inspections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();`);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('inspections');
  pgm.dropType('inspection_outcome');
  pgm.dropType('inspection_status');
};
