import { getApiFor } from '../graph-api.js';
import { jsonResult } from '../format.js';
import { buildODataQuery } from '../query.js';
import type { ToolResponse } from '../types.js';

// Common shape: list endpoint + OData params + multi-tenant routing.
export async function listEndpoint(
  path: string,
  args: Record<string, string>,
): Promise<ToolResponse> {
  const api = getApiFor(args.client);
  const result = await api.get(`${path}${buildODataQuery(args)}`);
  return jsonResult(result);
}

export async function getEndpoint(
  path: string,
  args: Record<string, string>,
): Promise<ToolResponse> {
  const api = getApiFor(args.client);
  const result = await api.get(path);
  return jsonResult(result);
}

export function requireArg(args: Record<string, string>, key: string): string {
  const v = args[key];
  if (!v) throw new Error(`Missing required argument: ${key}`);
  return v;
}

// Server-side confirmation gate for destructive tools. Caller must echo
// `expected` exactly. This is a second layer on top of any UI confirmation
// and the INTUNE_MODE=read gate: useful for HTTP transport where no
// human-in-the-loop UI exists, and as a defence against prompt-injection
// that tricks the agent into firing destructive tools without quoting the
// device id verbatim.
export function requireConfirm(
  args: Record<string, string>,
  expected: string,
  toolName: string,
): void {
  const got = args.confirm;
  if (!got) {
    throw new Error(
      `${toolName} requires confirm="${expected}" to proceed. This guards against accidental destructive calls.`,
    );
  }
  if (got !== expected) {
    throw new Error(
      `${toolName} confirm mismatch. Expected confirm="${expected}", got confirm="${got}".`,
    );
  }
}

export const CONFIRM_PROPERTY = {
  confirm: {
    type: 'string',
    description:
      'Confirmation string. See tool description for the exact value expected (literal echo).',
  },
} as const;
