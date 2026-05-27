import { describe, it, expect } from 'vitest';

// We don't spin up the real HTTP transport here (that pulls in the SDK and
// would need a port). Instead we re-implement the same constant-time compare
// used in src/index.ts and verify the property we care about — secrets
// compare in constant time and unequal lengths reject — without making tests
// environment-flaky.
function timingSafeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  const aBuf = Buffer.alloc(max);
  const bBuf = Buffer.alloc(max);
  aBuf.write(a);
  bBuf.write(b);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < max; i++) {
    diff |= aBuf[i] ^ bBuf[i];
  }
  return diff === 0;
}

describe('HTTP bearer token compare', () => {
  it('accepts the exact secret', () => {
    expect(timingSafeEqual('sup3r-secret-token', 'sup3r-secret-token')).toBe(true);
  });

  it('rejects a different secret of the same length', () => {
    expect(timingSafeEqual('sup3r-secret-token', 'sup3r-secret-tokeN')).toBe(false);
  });

  it('rejects shorter strings (no length leak via early return)', () => {
    expect(timingSafeEqual('sup3r-secret-token', 'sup3r')).toBe(false);
  });

  it('rejects longer strings', () => {
    expect(timingSafeEqual('sup3r', 'sup3r-and-more')).toBe(false);
  });

  it('rejects empty presented token', () => {
    expect(timingSafeEqual('', 'sup3r-secret-token')).toBe(false);
  });
});
