import type { ToolDefinition } from '../types.js';
import { CLIENT_PROPERTY, odataProps } from '../query.js';
import { getEndpoint, listEndpoint, requireArg } from './shared.js';

export const scriptTools: ToolDefinition[] = [
  {
    name: 'list-device-management-scripts',
    description: '[read] List Intune PowerShell device management scripts (Windows).',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/deviceManagementScripts', args),
  },
  {
    name: 'get-device-management-script',
    description: '[read] Get a single PowerShell device management script by id.',
    inputSchema: {
      type: 'object',
      properties: {
        scriptId: { type: 'string', description: 'Device management script id (GUID).' },
        select: { type: 'string', description: 'OData $select: comma-separated fields.' },
        ...CLIENT_PROPERTY,
      },
      required: ['scriptId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'scriptId');
      const select = args.select ? `?$select=${encodeURIComponent(args.select)}` : '';
      return getEndpoint(
        `/deviceManagement/deviceManagementScripts/${encodeURIComponent(id)}${select}`,
        args,
      );
    },
  },
  {
    name: 'list-device-shell-scripts',
    description: '[read] List Intune shell scripts (macOS).',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/deviceShellScripts', args),
  },
];
