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
            'Full @odata.nextLink URL returned by a prior list call. Must start with the Graph base URL.',
        },
        ...CLIENT_PROPERTY,
      },
      required: ['nextLink'],
    },
    handler: async (args) => {
      const next = args.nextLink;
      if (!next) throw new Error('Missing required argument: nextLink');
      // Defence in depth: refuse anything that isn't a Graph URL so the agent
      // can't be tricked into using this tool for SSRF against arbitrary hosts.
      if (
        !/^https:\/\/(graph\.microsoft\.com|microsoftgraph\.chinacloudapi\.cn|graph\.microsoft\.us|dod-graph\.microsoft\.us)\//i.test(
          next,
        )
      ) {
        throw new Error('nextLink must be a Microsoft Graph URL.');
      }
      const api = getApiFor(args.client);
      const result = await api.get(next);
      return jsonResult(result);
    },
  },
];
