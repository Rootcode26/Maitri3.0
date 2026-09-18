import pino from 'pino';

export const REDACTION_CENSOR = '[REDACTED]';

const sensitiveKeys = [
  'password',
  'passwd',
  'secret',
  'token',
  'jwt',
  'idToken',
  'accessToken',
  'refreshToken',
  'apiKey',
  'clientSecret',
  'privateKey',
  'otp',
  'otpHash',
  'content',
  'extractedData',
  'storageKey',
  'DATABASE_URL',
  'REDIS_URL',
] as const;

export const pinoRedaction = {
  censor: REDACTION_CENSOR,
  paths: [
    ...sensitiveKeys,
    ...sensitiveKeys.map((key) => `*.${key}`),
    ...sensitiveKeys.map((key) => `*.*.${key}`),
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["set-cookie"]',
    'req.headers["x-api-key"]',
    'req.headers["x-internal-token"]',
    'res.headers["set-cookie"]',
    'request.headers.authorization',
    'request.headers.cookie',
    'request.headers["set-cookie"]',
    'request.headers["x-api-key"]',
    'request.headers["x-internal-token"]',
    'response.headers["set-cookie"]',
    'err.body',
    'error.body',
  ],
} satisfies pino.LoggerOptions['redact'];

export const redactSensitiveText = (value: string): string =>
  value
    .replace(
      /\b((?:postgres(?:ql)?|redis(?:s)?|https?):\/\/)([^@\s/]+)@/gi,
      `$1${REDACTION_CENSOR}@`,
    )
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTION_CENSOR}`)
    .replace(
      /([?&](?:token|access_token|refresh_token|api_key|key)=)[^&\s]+/gi,
      `$1${REDACTION_CENSOR}`,
    )
    .replace(
      /\b(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*([=:])\s*[^\s,;]+/gi,
      `$1$2${REDACTION_CENSOR}`,
    );

export const serializeErrorSafely = (error: unknown): unknown => {
  if (!(error instanceof Error)) return error;

  const serialized = pino.stdSerializers.err(error);

  return {
    ...serialized,
    message:
      typeof serialized.message === 'string'
        ? redactSensitiveText(serialized.message)
        : serialized.message,
    stack:
      typeof serialized.stack === 'string'
        ? redactSensitiveText(serialized.stack)
        : serialized.stack,
  };
};
