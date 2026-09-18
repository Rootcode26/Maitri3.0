import { z } from 'zod';

export type ValidationFailure = 'unreachable' | 'unauthorized' | 'bad-status' | 'invalid-response';

export class ValidationEngineError extends Error {
  constructor(
    readonly kind: ValidationFailure,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ValidationEngineError';
  }
}

const issueSchema = z
  .object({
    code: z.string(),
    severity: z.enum(['error', 'warning', 'review']),
    field: z.string().nullable().optional(),
    approvalKey: z.string().nullable().optional(),
    documentKey: z.string().nullable().optional(),
    documentId: z.string().nullable().optional(),
    message: z.string(),
    suggestedAction: z.string(),
  })
  .loose();

const documentCheckSchema = z
  .object({
    documentId: z.string(),
    approvalKey: z.string(),
    documentKey: z.string(),
    field: z.string().nullable().optional(),
    status: z.enum(['matched', 'mismatched', 'unavailable', 'review_required']),
    reason: z.string(),
  })
  .loose();

const validateResponseSchema = z
  .object({
    rulesVersion: z.string(),
    projectId: z.string(),
    projectVersion: z.number(),
    validationStatus: z.enum(['complete', 'review_required', 'not_evaluated']),
    blockingIssues: z.array(issueSchema),
    warnings: z.array(issueSchema),
    reviewItems: z.array(issueSchema),
    documentChecks: z.array(documentCheckSchema),
  })
  .loose();

export type ValidationResult = z.infer<typeof validateResponseSchema>;

export interface UploadedDocumentPayload {
  documentId: string;
  version: number;
  approvalKey: string;
  documentKey: string;
  fileName: string;
  mimeType: string;
  detectedMimeType: string | null;
  sizeBytes: number;
  storageKey: string | null;
  fileReadStatus: string;
  extractionStatus: string;
  extractedData: null;
  expiresOn: string | null;
  content?: string;
}

export interface ValidationRequestInput {
  rulesVersion: string;
  projectId: string;
  projectVersion: number;
  project: unknown;
  documents: UploadedDocumentPayload[];
}

export interface ValidationClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs: number;
}

export class ValidationClient {
  constructor(private readonly options: ValidationClientOptions) {}

  async validate(request: ValidationRequestInput): Promise<ValidationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);

    let response: Response;
    try {
      response = await fetch(new URL('/validate', this.options.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.options.token,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ValidationEngineError(
        'unreachable',
        'Could not reach the validation service',
        error,
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ValidationEngineError(
        'unauthorized',
        `Validation service rejected the internal token (status ${response.status})`,
      );
    }
    if (response.status === 400 || response.status === 422) {
      throw new ValidationEngineError(
        'invalid-response',
        `Validation service rejected the request as invalid (status ${response.status})`,
      );
    }
    if (!response.ok) {
      throw new ValidationEngineError(
        'bad-status',
        `Validation service responded with status ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new ValidationEngineError(
        'invalid-response',
        'Validation service returned invalid JSON',
        error,
      );
    }

    const parsed = validateResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ValidationEngineError(
        'invalid-response',
        'Validation service response failed validation',
        parsed.error,
      );
    }
    return parsed.data;
  }
}

export function createValidationClient(config: {
  RULES_SERVICE_URL?: string | undefined;
  RULES_SERVICE_TOKEN?: string | undefined;
  RULES_SERVICE_TIMEOUT_MS: number;
}): ValidationClient | null {
  if (!config.RULES_SERVICE_URL || !config.RULES_SERVICE_TOKEN) {
    return null;
  }
  return new ValidationClient({
    baseUrl: config.RULES_SERVICE_URL,
    token: config.RULES_SERVICE_TOKEN,
    timeoutMs: config.RULES_SERVICE_TIMEOUT_MS,
  });
}
