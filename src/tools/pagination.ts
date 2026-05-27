import type { ToolDefinition } from '../types.js';
import { getApiFor } from '../graph-api.js';
import { jsonResult } from '../format.js';
import { CLIENT_PROPERTY } from '../query.js';

export const paginationTools: ToolDefinition[] = [
  {
    name: 'fetch-next-page',
    description:
      "[read] Fetch the next page from a previous list response's @odata.nextLink. Pass the full nextLink URL verbatim. Provide `client` if you used multi-tenant mode for the original call.",
    inputSchema: {
      type: 'object',
      properties: {
        nextLink: {
          type: 'string',
          description:
            'Full @odata.nextLink URL returned by a prior list call. Must be an HTTPS Microsoft Graph URL.',
        },
        ...CLIENT_PROPERTY,
      },
      required: ['nextLink'],
    },
    handler: async (args) => {
      const next = args.nextLink;
      if (!next) throw new Error('Missing required argument: nextLink');
      // getFromNextLink enforces the Graph host allowlist (SSRF guard).
      const api = getApiFor(args.client);
      const result = await api.getFromNextLink(next);
      return jsonResult(result);
    },
  },
];
