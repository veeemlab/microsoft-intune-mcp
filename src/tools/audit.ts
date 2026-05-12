import type { ToolDefinition } from '../types.js';
import { odataProps } from '../query.js';
import { listEndpoint } from './shared.js';

export const auditTools: ToolDefinition[] = [
  {
    name: 'list-audit-events',
    description:
      '[read] List Intune audit events. Use $filter (e.g. "activityDateTime ge 2026-01-01T00:00:00Z") and $top to scope.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/auditEvents', args),
  },
];
