import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

// Allow a department to assign an approval to a specific inspecting officer so
// work can be distributed instead of shared across the whole department queue.
export const up = (pgm: MigrationBuilder): void => {
  pgm.addColumn('project_approvals', {
    assigned_to: { type: 'uuid' },
  });
  pgm.addConstraint('project_approvals', 'project_approvals_assigned_to_fk', {
    foreignKeys: { columns: 'assigned_to', references: 'users(id)', onDelete: 'SET NULL' },
  });
  pgm.createIndex('project_approvals', ['department_id', 'assigned_to'], {
    name: 'project_approvals_department_assignee_idx',
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropIndex('project_approvals', ['department_id', 'assigned_to'], {
    name: 'project_approvals_department_assignee_idx',
  });
  pgm.dropConstraint('project_approvals', 'project_approvals_assigned_to_fk');
  pgm.dropColumn('project_approvals', 'assigned_to');
};
