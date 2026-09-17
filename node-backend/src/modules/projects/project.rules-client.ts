import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { logger } from '../../config/logger.js';
import { departmentKeys } from '../auth/auth.constants.js';
import type { DepartmentKey, RecommendedApproval } from './project.rules.js';
import type { CreateProjectInput } from './project.schemas.js';
import type { ApprovalDocument } from './project.types.js';

const documentSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  formats: z.array(z.string()).optional(),
  maxSizeMb: z.number().optional(),
  filesRequired: z.number().optional(),
  required: z.boolean().optional(),
  mustInclude: z.array(z.string()).optional(),
  quality: z.array(z.string()).optional(),
});

const approvalSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['required', 'recommended']),
  reason: z.string().optional(),
  ruleId: z.string().optional(),
  departmentKey: z.enum(departmentKeys),
  processingDays: z.number().int().nonnegative(),
  documents: z.array(documentSchema),
});

const evaluateResponseSchema = z.object({
  approvals: z.array(approvalSchema),
});

export interface RulesEngineClientOptions {
  baseUrl: string;
  token: string;
  rulesVersion: string;
  timeoutMs: number;
}

export class RulesEngineClient {
  constructor(private readonly options: RulesEngineClientOptions) {}

  async evaluate(input: CreateProjectInput): Promise<RecommendedApproval[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    let response: Response;
    try {
      response = await fetch(new URL('/evaluate', this.options.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.options.token,
        },
        body: JSON.stringify({
          rulesVersion: this.options.rulesVersion,
          projectId: randomUUID(),
          project: input,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`Rules engine responded with status ${response.status}`);
    }

    const parsed = evaluateResponseSchema.parse(await response.json());
    return parsed.approvals.map(
      (approval): RecommendedApproval => ({
        key: approval.key,
        title: approval.title,
        status: approval.status,
        ...(approval.reason !== undefined ? { reason: approval.reason } : {}),
        ...(approval.ruleId !== undefined ? { ruleId: approval.ruleId } : {}),
        departmentKey: approval.departmentKey as DepartmentKey,
        processingDays: approval.processingDays,
        documents: approval.documents as ApprovalDocument[],
      }),
    );
  }
}

export function createRulesEngineClient(config: {
  RULES_SERVICE_URL?: string | undefined;
  RULES_SERVICE_TOKEN?: string | undefined;
  RULES_VERSION: string;
  RULES_SERVICE_TIMEOUT_MS: number;
}): RulesEngineClient | null {
  if (!config.RULES_SERVICE_URL || !config.RULES_SERVICE_TOKEN) {
    logger.info('Rules engine not configured; using built-in approval derivation');
    return null;
  }
  return new RulesEngineClient({
    baseUrl: config.RULES_SERVICE_URL,
    token: config.RULES_SERVICE_TOKEN,
    rulesVersion: config.RULES_VERSION,
    timeoutMs: config.RULES_SERVICE_TIMEOUT_MS,
  });
}
