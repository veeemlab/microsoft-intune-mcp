import type { ToolDefinition } from '../types.js';
import { CLIENT_PROPERTY, odataProps } from '../query.js';
import { getEndpoint, listEndpoint, requireArg } from './shared.js';

export const filterTools: ToolDefinition[] = [
  {
    name: 'list-assignment-filters',
    description: '[read] List Intune assignment filters (used to scope policy/app assignments).',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/assignmentFilters', args),
  },
  {
    name: 'get-assignment-filter',
    description: '[read] Get a single assignment filter by id.',
    inputSchema: {
      type: 'object',
      properties: {
        filterId: { type: 'string', description: 'Assignment filter id (GUID).' },
        ...CLIENT_PROPERTY,
      },
      required: ['filterId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'filterId');
      return getEndpoint(`/deviceManagement/assignmentFilters/${encodeURIComponent(id)}`, args);
    },
  },
];
