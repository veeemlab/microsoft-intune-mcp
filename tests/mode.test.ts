import { describe, it, expect } from 'vitest';
import { allTools, filterToolsByMode, parseMode } from '../src/tools/index.js';

describe('parseMode', () => {
  it('defaults to read when env is undefined', () => {
    expect(parseMode(undefined)).toBe('read');
  });

  it('accepts read and full case-insensitively', () => {
    expect(parseMode('read')).toBe('read');
    expect(parseMode('FULL')).toBe('full');
    expect(parseMode('Read')).toBe('read');
  });

  it('throws on unknown values', () => {
    expect(() => parseMode('write')).toThrow(/Invalid INTUNE_MODE/);
    expect(() => parseMode('')).toThrow(/Invalid INTUNE_MODE/);
  });
});

describe('filterToolsByMode', () => {
  it('full mode returns all tools', () => {
    const out = filterToolsByMode(allTools, 'full');
    expect(out).toHaveLength(allTools.length);
  });

  it('read mode excludes every write-tagged tool', () => {
    const out = filterToolsByMode(allTools, 'read');
    const writeLeaked = out.filter((t) => /^\s*\[write/.test(t.description));
    expect(writeLeaked).toEqual([]);
  });

  it('read mode keeps only [read]-tagged tools', () => {
    const out = filterToolsByMode(allTools, 'read');
    const untagged = out.filter((t) => !t.description.trimStart().startsWith('[read]'));
    expect(untagged).toEqual([]);
    expect(out.length).toBeGreaterThan(0);
  });

  it('destructive tools are filtered out in read mode', () => {
    const destructive = allTools.filter((t) => t.description.includes('[write/destructive]'));
    expect(destructive.length).toBeGreaterThan(0);
    const out = filterToolsByMode(allTools, 'read');
    const names = new Set(out.map((t) => t.name));
    for (const t of destructive) {
      expect(names.has(t.name)).toBe(false);
    }
  });
});
