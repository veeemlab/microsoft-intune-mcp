import { describe, it, expect } from 'vitest';
import { allTools } from '../src/tools/index.js';

// Claude's tool-use API rejects any property key not matching this regex.
// Regression guard against ever re-introducing $-prefixed input keys.
const CLAUDE_KEY_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;

describe('tool input schemas', () => {
  it('every property key matches Claude API regex ^[a-zA-Z0-9_.-]{1,64}$', () => {
    const violations: string[] = [];
    for (const tool of allTools) {
      for (const key of Object.keys(tool.inputSchema.properties)) {
        if (!CLAUDE_KEY_REGEX.test(key)) {
          violations.push(`${tool.name}.${key}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('every tool name matches Claude API regex', () => {
    const violations: string[] = [];
    for (const tool of allTools) {
      if (!CLAUDE_KEY_REGEX.test(tool.name)) violations.push(tool.name);
    }
    expect(violations).toEqual([]);
  });
});
