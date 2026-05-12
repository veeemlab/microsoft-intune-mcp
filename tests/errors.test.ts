import { describe, it, expect } from 'vitest';
import { scrubText, normalizeGraphError, GraphApiError } from '../src/errors.js';

describe('scrubText', () => {
  it('redacts Bearer tokens', () => {
    expect(scrubText('Authorization: Bearer abc.def.ghi-XYZ_123')).toContain('Bearer [REDACTED]');
  });

  it('redacts access_token and client_secret in JSON-ish strings', () => {
    const text = '{"access_token":"eyJxxx","client_secret":"sup3r-s3cret"}';
    const out = scrubText(text);
    expect(out).not.toContain('eyJxxx');
    expect(out).not.toContain('sup3r-s3cret');
    expect(out).toContain('[REDACTED]');
  });
});

describe('normalizeGraphError', () => {
  it('parses the Graph error envelope', () => {
    const body = JSON.stringify({
      error: {
        code: 'Forbidden',
        message: 'Access denied.',
        innerError: { 'request-id': 'req-1' },
      },
    });
    const out = normalizeGraphError(403, body);
    expect(out).toEqual({
      status: 403,
      code: 'Forbidden',
      message: 'Access denied.',
      requestId: 'req-1',
    });
  });

  it('falls back to raw body when not JSON', () => {
    const out = normalizeGraphError(500, 'plain text down');
    expect(out.status).toBe(500);
    expect(out.message).toBe('plain text down');
    expect(out.code).toBeUndefined();
  });
});

describe('GraphApiError', () => {
  it('formats a readable error including request-id', () => {
    const err = new GraphApiError({
      status: 429,
      code: 'TooManyRequests',
      message: 'rate limited',
      requestId: 'req-xyz',
    });
    expect(err.message).toBe(
      'Graph API error (429 TooManyRequests): rate limited [request-id: req-xyz]',
    );
    expect(err.status).toBe(429);
  });
});
