import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

// Persist the automated validation flags (warnings, officer-review items and
// per-document checks) captured at submission time, so the inspector detail view
// can show what the automated check surfaced.
export const up = (pgm: MigrationBuilder): void => {
  pgm.addColumns('projects', {
    validation_flags: { type: 'jsonb' },
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropColumns('projects', ['validation_flags']);
};
