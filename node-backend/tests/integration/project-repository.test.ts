import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, connectDatabase, query } from '../../src/database/database.js';
import { ProjectRepository } from '../../src/modules/projects/project.repository.js';
import { deriveApprovals } from '../../src/modules/projects/project.rules.js';
import type { CreateProjectInput } from '../../src/modules/projects/project.schemas.js';

const runDbTests = process.env.RUN_DB_TESTS === 'true' || process.env.RUN_E2E === 'true';

const testPhone = '+919000009901';

const foodProject: CreateProjectInput = {
  enterpriseName: 'Integration Foods Pvt. Ltd.',
  organisationType: 'private-limited',
  industry: 'food',
  pan: 'AABCS1234F',
  district: 'Pune',
  pincode: '410501',
  plotArea: '500–2,000',
  landStatus: 'owned',
  primaryActivity: 'Food & beverage processing',
  projectStage: 'new',
  boiler: 'yes',
  boilerCapacity: '1–5',
  hazardousChemicals: 'yes',
  processes: ['Manufacturing / processing'],
  fssaiCategory: 'State licence',
  electricity: '100–500',
  waterUse: '10–50',
  wastewater: 'On-site treatment plant',
  hazardousWaste: 'no',
  permanent: '20–49',
};

describe.runIf(runDbTests)('ProjectRepository (integration)', () => {
  const repository = new ProjectRepository();
  let applicantId: string;

  beforeAll(async () => {
    await connectDatabase();
    await query(`DELETE FROM users WHERE phone_number = $1`, [testPhone]);
    const result = await query<{ id: string }>(
      `INSERT INTO users (name, phone_number, password_hash, role, status, industry)
       VALUES ('Integration Applicant', $1, 'x', 'applicant', 'active', 'food')
       RETURNING id`,
      [testPhone],
    );
    applicantId = result.rows[0]!.id;
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE phone_number = $1`, [testPhone]);
    await closeDatabase();
  });

  it('stores a project with its derived approvals and reads it back', async () => {
    const approvals = deriveApprovals(foodProject);
    const projectId = randomUUID();
    const created = await repository.createProject(applicantId, projectId, foodProject, approvals);

    expect(created.id).toBe(projectId);
    expect(created.enterpriseName).toBe('Integration Foods Pvt. Ltd.');
    expect(created.industry).toBe('food');
    expect(created.status).toBe('draft');
    expect(created.details.pan).toBe('AABCS1234F');

    expect(created.approvals).toHaveLength(5);
    const boiler = created.approvals.find((a) => a.approvalKey === 'boiler-registration');
    expect(boiler?.department.key).toBe('steam-boilers');
    expect(boiler?.department.name).toContain('Steam Boilers');
    expect(boiler?.documents.length).toBeGreaterThan(0);

    const readBack = await repository.findProjectById(created.id);
    expect(readBack?.approvals).toHaveLength(5);
  });

  it('lists the applicant projects newest first', async () => {
    const summaries = await repository.findProjectsByApplicant(applicantId);
    expect(summaries.length).toBeGreaterThanOrEqual(1);
    expect(summaries[0]?.enterpriseName).toBe('Integration Foods Pvt. Ltd.');
  });

  it('returns null for a missing project', async () => {
    const missing = await repository.findProjectById('00000000-0000-0000-0000-000000000000');
    expect(missing).toBeNull();
  });
});
