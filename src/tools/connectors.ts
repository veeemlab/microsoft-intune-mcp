import type { ToolDefinition } from '../types.js';
import { odataProps } from '../query.js';
import { listEndpoint, requireArg } from './shared.js';

export const connectorTools: ToolDefinition[] = [
  {
    name: 'list-tunnel-sites',
    description: '[read] List Microsoft Tunnel sites.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/microsoftTunnelSites', args),
  },
  {
    name: 'list-tunnel-servers',
    description: '[read] List Microsoft Tunnel servers belonging to a tunnel site.',
    inputSchema: {
      type: 'object',
      properties: {
        siteId: { type: 'string', description: 'Microsoft Tunnel site id.' },
        ...odataProps(),
      },
      required: ['siteId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'siteId');
      return listEndpoint(
        `/deviceManagement/microsoftTunnelSites/${encodeURIComponent(id)}/microsoftTunnelServers`,
        args,
      );
    },
  },
  {
    name: 'list-ndes-connectors',
    description: '[read] List NDES (SCEP certificate) connectors.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/ndesConnectors', args),
  },
];
