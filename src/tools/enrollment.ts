import type { ToolDefinition } from '../types.js';
import { odataProps } from '../query.js';
import { listEndpoint } from './shared.js';

export const enrollmentTools: ToolDefinition[] = [
  {
    name: 'list-enrollment-configurations',
    description:
      '[read] List device enrollment configurations (ESP, platform restrictions, enrollment notifications). Filter by `deviceEnrollmentConfigurationType` to narrow.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/deviceEnrollmentConfigurations', args),
  },
];
