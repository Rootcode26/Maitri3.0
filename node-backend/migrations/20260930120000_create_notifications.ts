import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

// In-app notifications delivered to a recipient. The rendered text is localized
// on the client from `type` + `data`, so the portal's language choice applies.
export const up = (pgm: MigrationBuilder): void => {
  pgm.createType('notification_type', [
    'submission_received',
    'clarification_requested',
    'clarification_answered',
    'approval_decided',
    'certificate_issued',
  ]);

  pgm.createTable('notifications', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true },
    type: { type: 'notification_type', notNull: true },
    data: { type: 'jsonb', notNull: true, default: '{}' },
    project_id: { type: 'uuid' },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('notifications', 'notifications_user_fk', {
    foreignKeys: { columns: 'user_id', references: 'users(id)', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('notifications', 'notifications_project_fk', {
    foreignKeys: { columns: 'project_id', references: 'projects(id)', onDelete: 'CASCADE' },
  });
  pgm.createIndex('notifications', ['user_id', 'created_at'], {
    name: 'notifications_user_created_idx',
  });
  pgm.createIndex('notifications', 'user_id', {
    name: 'notifications_user_unread_idx',
    where: 'read_at IS NULL',
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropTable('notifications');
  pgm.dropType('notification_type');
};
