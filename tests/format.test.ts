import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.INTUNE_MAX_RESPONSE_BYTES;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('formatJson', () => {
  it('returns full JSON for small payloads', async () => {
    const { formatJson } = await import('../src/format.js');
    const out = formatJson({ a: 1, b: 'hello' });
    expect(JSON.parse(out)).toEqual({ a: 1, b: 'hello' });
  });

  it('truncates oversize array responses with a hint and partial sample', async () => {
    process.env.INTUNE_MAX_RESPONSE_BYTES = '500';
    const { formatJson } = await import('../src/format.js');

    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `device-${i}`,
      deviceName: `LAPTOP-${i}`,
      osVersion: '10.0.22631',
    }));
    const out = formatJson({ value: items });

    const parsed = JSON.parse(out);
    expect(parsed.truncated).toBe(true);
    expect(parsed.hint).toMatch(/\$select|\$filter|\$top/);
    expect(parsed.sample.valueCountTotal).toBe(50);
    expect(parsed.sample.valueCountIncluded).toBeLessThan(50);
  });

  it('handles oversize non-array payloads with a generic note', async () => {
    process.env.INTUNE_MAX_RESPONSE_BYTES = '50';
    const { formatJson } = await import('../src/format.js');
    const big = { description: 'x'.repeat(2000) };
    const out = formatJson(big);
    const parsed = JSON.parse(out);
    expect(parsed.truncated).toBe(true);
  });
});

describe('errorResult', () => {
  it('returns a sanitised isError response', async () => {
    const { errorResult } = await import('../src/format.js');
    const r = errorResult('something failed');
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe('Error: something failed');
  });
});
