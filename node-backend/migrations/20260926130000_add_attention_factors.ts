import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

// Persist the contributing factors behind the attention score so the inspector
// detail view can explain why an application was scored the way it was.
export const up = (pgm: MigrationBuilder): void => {
  pgm.addColumns('projects', {
    attention_factors: { type: 'jsonb' },
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropColumns('projects', ['attention_factors']);
};
