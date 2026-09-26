import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

// Persist the prototype attention assessment (a manual-review-effort estimate)
// captured at submission time, so the inspector queue can triage by it.
export const up = (pgm: MigrationBuilder): void => {
  pgm.addColumns('projects', {
    attention_score: { type: 'integer' },
    attention_level: { type: 'text' },
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropColumns('projects', ['attention_score', 'attention_level']);
};
