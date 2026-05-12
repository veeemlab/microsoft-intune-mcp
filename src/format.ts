import type { ToolResponse } from './types.js';

const DEFAULT_MAX_BYTES = 200_000;

function getMaxBytes(): number {
  const raw = process.env.INTUNE_MAX_RESPONSE_BYTES;
  if (!raw) return DEFAULT_MAX_BYTES;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BYTES;
}

// Trim huge Graph payloads before they reach the model. Whole list responses
// can be tens of MB; sending them costs context and money and almost never
// helps the agent — better to fail loud with a hint to use $top/$select.
export function formatJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  const max = getMaxBytes();
  if (json.length <= max) return json;

  const sample = truncateSample(value, max);
  const meta = {
    truncated: true,
    reason: `Response exceeded INTUNE_MAX_RESPONSE_BYTES (${max} bytes).`,
    hint: 'Narrow the result with $select, $filter, $top, or fetch by id. The payload preview below may be incomplete.',
    sample,
  };
  return JSON.stringify(meta, null, 2);
}

function truncateSample(value: unknown, max: number): unknown {
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.value)) {
      const kept: unknown[] = [];
      let size = 0;
      const headroom = Math.floor(max / 2);
      for (const item of obj.value) {
        const serialized = JSON.stringify(item);
        if (size + serialized.length > headroom) break;
        kept.push(item);
        size += serialized.length;
      }
      const out: Record<string, unknown> = {
        ...obj,
        value: kept,
        valueCountTotal: obj.value.length,
        valueCountIncluded: kept.length,
      };
      return out;
    }
  }
  const serialized = JSON.stringify(value);
  if (serialized.length <= max) return value;
  return { note: 'Object too large for inline preview.' };
}

export function textResult(text: string): ToolResponse {
  return { content: [{ type: 'text', text }] };
}

export function jsonResult(value: unknown): ToolResponse {
  return textResult(formatJson(value));
}

export function errorResult(message: string): ToolResponse {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}
