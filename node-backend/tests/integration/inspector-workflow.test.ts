import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, connectDatabase, query } from '../../src/database/database.js';
import { InspectorRepository } from '../../src/modules/inspector/inspector.repository.js';
import { DocumentRepository } from '../../src/modules/documents/document.repository.js';
import { ProjectRepository } from '../../src/modules/projects/project.repository.js';
import type { CreateProjectInput } from '../../src/modules/projects/project.schemas.js';

const runDbTests = process.env.RUN_DB_TESTS === 'true' || process.env.RUN_E2E === 'true';
const applicantPhone = '+919000009911';
const inspectorPhone = '+919000009912';

const projectInput: CreateProjectInput = {
  enterpriseName: 'Inspector Workflow Steel Pvt. Ltd.',
  organisationType: 'private-limited',
  industry: 'steel',
  pan: 'AABCS1234F',
  district: 'Pune',
  pincode: '410501',
  plotArea: '500–2,000',
  landStatus: 'owned',
  primaryActivity: 'Rolling mill',
  projectStage: 'new',
  boiler: 'no',
  hazardousChemicals: 'no',
  processes: ['Manufacturing / processing'],
  furnaceType: 'Induction furnace',
  furnaceCapacity: 'Up to 5',
  electricity: '100–500',
  waterUse: '10–50',
  wastewater: 'On-site treatment plant',
  hazardousWaste: 'no',
  permanent: '20–49',
};

describe.runIf(runDbTests)('inspector manual review workflow (integration)', () => {
  const projects = new ProjectRepository();
  const inspector = new InspectorRepository();
  const documents = new DocumentRepository();
  let applicantId: string;
  let inspectorId: string;
  let departmentId: string;
  let projectId: string;
  let approvalId: string;
  let documentId: string;

  beforeAll(async () => {
    await connectDatabase();
    await query(
      `DELETE FROM projects WHERE applicant_id IN
       (SELECT id FROM users WHERE phone_number IN ($1, $2))`,
      [applicantPhone, inspectorPhone],
    );
    await query(`DELETE FROM users WHERE phone_number IN ($1, $2)`, [
      applicantPhone,
      inspectorPhone,
    ]);
    const department = await query<{ id: string }>(
      `SELECT id FROM departments WHERE "key" = 'dish'`,
    );
    departmentId = department.rows[0]!.id;
    const applicant = await query<{ id: string }>(
      `INSERT INTO users (name, phone_number, password_hash, role, status, industry)
       VALUES ('Workflow Applicant', $1, 'x', 'applicant', 'active', 'steel') RETURNING id`,
      [applicantPhone],
    );
    applicantId = applicant.rows[0]!.id;
    const inspectorUser = await query<{ id: string }>(
      `INSERT INTO users (name, phone_number, password_hash, role, status, department_id)
       VALUES ('Workflow Inspector', $1, 'x', 'inspector', 'active', $2) RETURNING id`,
      [inspectorPhone, departmentId],
    );
    inspectorId = inspectorUser.rows[0]!.id;
    projectId = randomUUID();
    const created = await projects.createProject(applicantId, projectId, projectInput, [
      {
        key: 'factory-registration',
        title: 'Factory registration',
        departmentKey: 'dish',
        status: 'required',
        processingDays: 15,
        documents: [{ key: 'factory-plan', name: 'Factory plan', required: true }],
      },
    ]);
    approvalId = created.approvals[0]!.id;
    const document = await query<{ id: string }>(
      `INSERT INTO project_documents
         (project_id, approval_key, document_key, file_name, mime_type, detected_mime_type,
          size_bytes, storage_key, uploaded_by)
       VALUES ($1, 'factory-registration', 'factory-plan', 'plan.pdf', 'application/pdf',
               'application/pdf', 100, 'tests/plan.pdf', $2)
       RETURNING id`,
      [projectId, applicantId],
    );
    documentId = document.rows[0]!.id;
  });

  afterAll(async () => {
    await query('DELETE FROM projects WHERE id = $1', [projectId]);
    await query(`DELETE FROM users WHERE phone_number IN ($1, $2)`, [
      applicantPhone,
      inspectorPhone,
    ]);
    await closeDatabase();
  });

  it('submits, queues, reviews and approves a department application', async () => {
    const submitted = await projects.submitProject(applicantId, projectId);
    expect(submitted.project?.status).toBe('submitted');

    const queue = await inspector.listApplications(
      departmentId,
      { page: 1, pageSize: 20 },
      inspectorId,
    );
    expect(queue.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId, approvalId, reviewStatus: 'pending' }),
      ]),
    );

    const detail = await inspector.findApplication(projectId, departmentId);
    expect(detail?.documents[0]).toMatchObject({ id: documentId, review: { status: 'pending' } });

    await expect(
      inspector.startReview(projectId, approvalId, departmentId, inspectorId),
    ).resolves.toBe(true);

    await expect(
      inspector.createClarification({
        projectId,
        approvalId,
        departmentId,
        inspectorId,
        documentId,
        message: 'Please confirm that this is the final approved factory plan.',
      }),
    ).resolves.toBe(true);
    const applicantClarifications = await projects.findClarificationsByApplicant(
      applicantId,
      projectId,
    );
    expect(applicantClarifications).toHaveLength(1);
    const clarificationId = applicantClarifications![0]!.id;
    await expect(
      projects.respondToClarification({
        applicantId,
        projectId,
        clarificationId,
        message: 'Confirmed. This is the final plan submitted to the department.',
      }),
    ).resolves.toBe(true);
    const responded = await inspector.findApplication(projectId, departmentId);
    expect(responded?.clarifications[0]).toMatchObject({
      status: 'responded',
      responses: [
        expect.objectContaining({
          message: 'Confirmed. This is the final plan submitted to the department.',
        }),
      ],
    });
    await expect(
      inspector.resolveClarification({ projectId, clarificationId, departmentId }),
    ).resolves.toBe(true);

    const correction = await inspector.reviewDocument({
      projectId,
      documentId,
      departmentId,
      inspectorId,
      status: 'correction_required',
      comment: 'Upload a clearer final plan',
    });
    expect(correction?.review.status).toBe('correction_required');
    const correctionDecision = await inspector.decideApproval({
      projectId,
      approvalId,
      departmentId,
      inspectorId,
      decision: 'correction_required',
      note: 'Replace the factory plan',
    });
    expect(correctionDecision?.projectStatus).toBe('correction_required');

    const replacement = await query<{ id: string }>(
      `INSERT INTO project_documents
         (project_id, approval_key, document_key, version, file_name, mime_type,
          detected_mime_type, size_bytes, storage_key, uploaded_by)
       VALUES ($1, 'factory-registration', 'factory-plan', 2, 'plan-corrected.pdf',
               'application/pdf', 'application/pdf', 120, 'tests/plan-corrected.pdf', $2)
       RETURNING id`,
      [projectId, applicantId],
    );
    const replacementId = replacement.rows[0]!.id;
    await documents.markCorrectionResubmitted({
      projectId,
      approvalKey: 'factory-registration',
      applicantId,
    });
    const resubmitted = await projects.findApplicationDetailByApplicant(applicantId, projectId);
    expect(resubmitted).toMatchObject({
      status: 'under_review',
      documents: expect.arrayContaining([
        expect.objectContaining({
          id: replacementId,
          version: 2,
          review: expect.objectContaining({ status: 'pending' }),
        }),
      ]),
      timeline: expect.arrayContaining([
        expect.objectContaining({
          fromStatus: 'correction_required',
          toStatus: 'under_review',
        }),
      ]),
    });

    const reviewed = await inspector.reviewDocument({
      projectId,
      documentId: replacementId,
      departmentId,
      inspectorId,
      status: 'accepted',
    });
    expect(reviewed?.review.status).toBe('accepted');

    const decided = await inspector.decideApproval({
      projectId,
      approvalId,
      departmentId,
      inspectorId,
      decision: 'approved',
      note: 'Documents verified',
    });
    expect(decided?.projectStatus).toBe('approved');
    expect(decided?.approvals[0]?.reviewStatus).toBe('approved');
  });

  it('does not expose the application to a different department', async () => {
    const other = await query<{ id: string }>(`SELECT id FROM departments WHERE "key" = 'mpcb'`);
    await expect(inspector.findApplication(projectId, other.rows[0]!.id)).resolves.toBeNull();
  });
});
