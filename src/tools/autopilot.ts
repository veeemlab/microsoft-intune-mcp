import type { ToolDefinition } from '../types.js';
import { odataProps } from '../query.js';
import { listEndpoint } from './shared.js';

export const autopilotTools: ToolDefinition[] = [
  {
    name: 'list-autopilot-devices',
    description: '[read] List Windows Autopilot device identities registered in the tenant.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/windowsAutopilotDeviceIdentities', args),
  },
  {
    name: 'list-autopilot-deployment-profiles',
    description: '[read] List Windows Autopilot deployment profiles.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/windowsAutopilotDeploymentProfiles', args),
  },
];
