import type { GraphErrorBody } from './types.js';

// Headers that may carry tokens / sensitive identifiers. Stripped before any
// payload reaches an LLM so credentials never round-trip through the model.
const SENSITIVE_HEADER_PATTERN = /authorization|cookie|set-cookie|x-ms-.*token/i;

export function scrubText(input: string): string {
  if (!input) return input;
  let out = input;
  out = out.replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]');
  out = out.replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[REDACTED]"');
  out = out.replace(/"client_secret"\s*:\s*"[^"]+"/gi, '"client_secret":"[REDACTED]"');
  return out;
}

export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADER_PATTERN.test(name);
}

export interface NormalizedGraphError {
  status: number;
  code?: string;
  message: string;
  requestId?: string;
}

export function normalizeGraphError(status: number, rawBody: string): NormalizedGraphError {
  let parsed: GraphErrorBody | undefined;
  try {
    parsed = JSON.parse(rawBody) as GraphErrorBody;
  } catch {
    parsed = undefined;
  }

  const err = parsed?.error;
  return {
    status,
    code: err?.code,
    message: scrubText(err?.message || rawBody || `HTTP ${status}`),
    requestId: err?.innerError?.['request-id'],
  };
}

export class GraphApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(normalized: NormalizedGraphError) {
    const tail = normalized.requestId ? ` [request-id: ${normalized.requestId}]` : '';
    super(
      `Graph API error (${normalized.status}${normalized.code ? ` ${normalized.code}` : ''}): ${normalized.message}${tail}`,
    );
    this.name = 'GraphApiError';
    this.status = normalized.status;
    this.code = normalized.code;
    this.requestId = normalized.requestId;
  }
}
