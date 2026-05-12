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
