import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  pgm.addColumns('project_approvals', {
    reason: { type: 'text', notNull: false },
    rule_id: { type: 'varchar(100)', notNull: false },
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropColumns('project_approvals', ['reason', 'rule_id']);
};
