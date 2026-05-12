import type { ToolDefinition } from '../types.js';
import { odataProps } from '../query.js';
import { listEndpoint } from './shared.js';

export const appProtectionTools: ToolDefinition[] = [
  {
    name: 'list-ios-app-protection-policies',
    description: '[read] List iOS managed app protection (MAM) policies.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceAppManagement/iosManagedAppProtections', args),
  },
  {
    name: 'list-android-app-protection-policies',
    description: '[read] List Android managed app protection (MAM) policies.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceAppManagement/androidManagedAppProtections', args),
  },
  {
    name: 'list-targeted-managed-app-configurations',
    description: '[read] List targeted managed app configurations (MAM app configs).',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceAppManagement/targetedManagedAppConfigurations', args),
  },
];
