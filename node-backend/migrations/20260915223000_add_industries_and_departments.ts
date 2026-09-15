import type { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

const departments = [
  ['fda-maharashtra', 'Food and Drug Administration, Maharashtra'],
  ['fssai', 'Food Safety and Standards Authority of India (FSSAI)'],
  ['mpcb', 'Maharashtra Pollution Control Board (MPCB)'],
  ['dish', 'Directorate of Industrial Safety and Health (DISH)'],
  ['fire-emergency-services', 'Maharashtra Fire and Emergency Services'],
  ['midc-planning', 'MIDC Planning and Building Permissions'],
  ['msedcl', 'Maharashtra State Electricity Distribution (MSEDCL)'],
  ['textiles-directorate', 'Directorate of Textiles, Maharashtra'],
  ['steam-boilers', 'Directorate of Steam Boilers, Maharashtra'],
  ['seiaa', 'Environment Department / SEIAA Maharashtra'],
] as const;

export const up = (pgm: MigrationBuilder): void => {
  pgm.createType('industry_type', ['food', 'textile', 'steel']);
  pgm.createTable('departments', {
    id: { type: 'uuid', primaryKey: true, notNull: true, default: pgm.func('gen_random_uuid()') },
    key: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(180)', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  const values = departments
    .map(([key, name]) => `('${key.replaceAll("'", "''")}', '${name.replaceAll("'", "''")}')`)
    .join(', ');
  pgm.sql(`INSERT INTO departments ("key", name) VALUES ${values}`);

  pgm.addColumn('users', { industry: { type: 'industry_type' } });
  pgm.sql("UPDATE users SET industry = 'steel' WHERE role = 'applicant' AND industry IS NULL");
  pgm.addConstraint('users', 'users_department_id_fk', {
    foreignKeys: { columns: 'department_id', references: 'departments(id)', onDelete: 'RESTRICT' },
  });
  pgm.dropConstraint('users', 'users_department_scope_check');
  pgm.dropConstraint('users', 'users_admin_has_no_password_check');
  pgm.sql(`
    ALTER TYPE user_role RENAME TO user_role_legacy;
    CREATE TYPE user_role AS ENUM ('applicant', 'officer');
    ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;
    DROP TYPE user_role_legacy;
  `);
  pgm.addConstraint('users', 'users_role_scope_check', {
    check:
      "(role = 'applicant' AND industry IS NOT NULL AND department_id IS NULL) OR " +
      "(role = 'officer' AND industry IS NULL AND department_id IS NOT NULL)",
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.dropConstraint('users', 'users_role_scope_check');
  pgm.dropConstraint('users', 'users_department_id_fk');
  pgm.dropColumn('users', 'industry');
  pgm.sql(`
    ALTER TYPE user_role RENAME TO user_role_current;
    CREATE TYPE user_role AS ENUM ('applicant', 'officer', 'admin');
    ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;
    DROP TYPE user_role_current;
  `);
  pgm.addConstraint('users', 'users_admin_has_no_password_check', {
    check: "role <> 'admin' OR password_hash IS NULL",
  });
  pgm.addConstraint('users', 'users_department_scope_check', {
    check:
      "(role = 'officer' AND department_id IS NOT NULL) OR " +
      "(role IN ('applicant', 'admin') AND department_id IS NULL)",
  });
  pgm.dropTable('departments');
  pgm.dropType('industry_type');
};
