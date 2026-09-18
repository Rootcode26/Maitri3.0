import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  pgm.alterColumn('projects', 'status', { default: 'draft' });

  pgm.addColumn('project_approvals', {
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.sql(
    `CREATE TRIGGER project_approvals_set_updated_at
     BEFORE UPDATE ON project_approvals
     FOR EACH ROW EXECUTE FUNCTION set_updated_at();`,
  );
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql('DROP TRIGGER IF EXISTS project_approvals_set_updated_at ON project_approvals;');
  pgm.dropColumn('project_approvals', 'updated_at');
  pgm.alterColumn('projects', 'status', { default: 'submitted' });
};
