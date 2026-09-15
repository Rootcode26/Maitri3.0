import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

/** Aligns the persisted role name with the public Inspector workspace name. */
export const up = (pgm: MigrationBuilder): void => {
  pgm.dropConstraint('users', 'users_role_scope_check');
  pgm.sql("ALTER TYPE user_role RENAME VALUE 'officer' TO 'inspector';");
  pgm.addConstraint('users', 'users_role_scope_check', {
    check:
      "(role = 'applicant' AND industry IS NOT NULL AND department_id IS NULL) OR " +
      "(role = 'inspector' AND industry IS NULL AND department_id IS NOT NULL)",
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropConstraint('users', 'users_role_scope_check');
  pgm.sql("ALTER TYPE user_role RENAME VALUE 'inspector' TO 'officer';");
  pgm.addConstraint('users', 'users_role_scope_check', {
    check:
      "(role = 'applicant' AND industry IS NOT NULL AND department_id IS NULL) OR " +
      "(role = 'officer' AND industry IS NULL AND department_id IS NOT NULL)",
  });
};
