/**
 * Provision inspector accounts from a ministry-supplied list.
 *
 *   pnpm seed:inspectors path/to/inspectors.json
 *
 * The file is a JSON array of:
 *   { "name": "...", "phoneNumber": "+91XXXXXXXXXX", "departmentKey": "...", "code": "..." }
 *
 * Each entry becomes an active, phone-verified inspector whose unique access
 * code is stored hashed (the code is what they enter in place of a password).
 * Re-running updates existing accounts by phone number (idempotent).
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { databasePool, query } from '../src/database/database.js';
import { hashPassword } from '../src/modules/auth/password.service.js';

interface InspectorSeed {
  name: string;
  phoneNumber: string;
  departmentKey: string;
  code: string;
}

const PHONE_RE = /^\+91[6-9][0-9]{9}$/;

const parseSeeds = (raw: string): InspectorSeed[] => {
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) throw new Error('The seed file must be a JSON array.');
  return data.map((entry, index) => {
    const item = entry as Partial<InspectorSeed>;
    if (!item.name || typeof item.name !== 'string')
      throw new Error(`Entry ${index}: "name" is required.`);
    if (!item.phoneNumber || !PHONE_RE.test(item.phoneNumber))
      throw new Error(`Entry ${index} (${item.name}): "phoneNumber" must be a +91 number.`);
    if (!item.departmentKey || typeof item.departmentKey !== 'string')
      throw new Error(`Entry ${index} (${item.name}): "departmentKey" is required.`);
    if (!item.code || typeof item.code !== 'string' || item.code.length < 8)
      throw new Error(`Entry ${index} (${item.name}): "code" must be at least 8 characters.`);
    return {
      name: item.name.trim(),
      phoneNumber: item.phoneNumber.trim(),
      departmentKey: item.departmentKey.trim(),
      code: item.code,
    };
  });
};

const main = async (): Promise<void> => {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: pnpm seed:inspectors <path-to-inspectors.json>');
    process.exit(1);
  }

  const seeds = parseSeeds(await readFile(resolve(file), 'utf8'));
  let created = 0;
  let updated = 0;

  for (const seed of seeds) {
    const department = await query<{ id: string }>(`SELECT id FROM departments WHERE "key" = $1`, [
      seed.departmentKey,
    ]);
    const departmentId = department.rows[0]?.id;
    if (!departmentId) {
      throw new Error(`Unknown departmentKey "${seed.departmentKey}" for ${seed.name}.`);
    }

    const passwordHash = await hashPassword(seed.code);
    const existing = await query<{ id: string }>(`SELECT id FROM users WHERE phone_number = $1`, [
      seed.phoneNumber,
    ]);

    if (existing.rows[0]) {
      await query(
        `UPDATE users
            SET name = $2, password_hash = $3, role = 'inspector', industry = NULL,
                department_id = $4, status = 'active', phone_verified_at = NOW()
          WHERE id = $1`,
        [existing.rows[0].id, seed.name, passwordHash, departmentId],
      );
      updated += 1;
    } else {
      await query(
        `INSERT INTO users
           (name, phone_number, password_hash, role, status, industry, department_id, phone_verified_at)
         VALUES ($1, $2, $3, 'inspector', 'active', NULL, $4, NOW())`,
        [seed.name, seed.phoneNumber, passwordHash, departmentId],
      );
      created += 1;
    }
    console.log(`  ✓ ${seed.name} (${seed.phoneNumber}) → ${seed.departmentKey}`);
  }

  console.log(`\nDone. ${created} created, ${updated} updated.`);
  await databasePool.end();
};

main().catch(async (error) => {
  console.error('Seeding failed:', error instanceof Error ? error.message : error);
  await databasePool.end().catch(() => {});
  process.exit(1);
});
