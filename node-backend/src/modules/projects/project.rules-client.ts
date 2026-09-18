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
  key: z.string().min(1).max(60),
  title: z.string().min(1).max(120),
  status: z.enum(['required', 'recommended']),
  reason: z.string().optional(),
  ruleId: z.string().max(100).optional(),
  departmentKey: z.enum(departmentKeys),
  processingDays: z.number().int().positive(),
  documents: z.array(documentSchema),
});

const blockingIssueSchema = z.object({ code: z.string(), message: z.string() }).loose();

const evaluateResponseSchema = z.object({
  approvals: z.array(approvalSchema),
  blockingIssues: z.array(blockingIssueSchema).optional(),
});

export type RulesEngineFailure =
  'unreachable' | 'unauthorized' | 'bad-status' | 'invalid-response' | 'blocked';

export interface BlockingIssue {
  code: string;
  message: string;
}

export class RulesEngineError extends Error {
  constructor(
    readonly kind: RulesEngineFailure,
    message: string,
    readonly cause?: unknown,
    readonly blockingIssues?: BlockingIssue[],
  ) {
    super(message);
    this.name = 'RulesEngineError';
  }
}

export interface RulesEngineClientOptions {
  baseUrl: string;
  token: string;
  rulesVersion: string;
  timeoutMs: number;
}

export class RulesEngineClient {
  constructor(private readonly options: RulesEngineClientOptions) {}

  async evaluate(input: CreateProjectInput, projectId: string): Promise<RecommendedApproval[]> {
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
          projectId,
          project: input,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new RulesEngineError('unreachable', 'Could not reach the rules engine', error);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new RulesEngineError(
        'unauthorized',
        `Rules engine rejected the internal token (status ${response.status})`,
      );
    }
    if (response.status === 400 || response.status === 422) {
      throw new RulesEngineError(
        'invalid-response',
        `Rules engine rejected the request as invalid (status ${response.status})`,
      );
    }
    if (!response.ok) {
      throw new RulesEngineError(
        'bad-status',
        `Rules engine responded with status ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new RulesEngineError('invalid-response', 'Rules engine returned invalid JSON', error);
    }

    const parsed = evaluateResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new RulesEngineError(
        'invalid-response',
        'Rules engine response failed validation',
        parsed.error,
      );
    }

    if (parsed.data.blockingIssues && parsed.data.blockingIssues.length > 0) {
      const issues: BlockingIssue[] = parsed.data.blockingIssues.map((issue) => ({
        code: issue.code,
        message: issue.message,
      }));
      logger.warn(
        { projectId, blockingIssues: issues },
        'Rules engine reported blocking issues; submission cannot proceed',
      );
      throw new RulesEngineError(
        'blocked',
        'The rules engine blocked this submission',
        undefined,
        issues,
      );
    }

    return parsed.data.approvals.map((approval): RecommendedApproval => ({
      key: approval.key,
      title: approval.title,
      status: approval.status,
      ...(approval.reason !== undefined ? { reason: approval.reason } : {}),
      ...(approval.ruleId !== undefined ? { ruleId: approval.ruleId } : {}),
      departmentKey: approval.departmentKey as DepartmentKey,
      processingDays: approval.processingDays,
      documents: approval.documents as ApprovalDocument[],
    }));
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
