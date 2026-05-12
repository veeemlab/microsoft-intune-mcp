import type { ToolDefinition } from '../types.js';
import { CLIENT_PROPERTY, odataProps } from '../query.js';
import { getEndpoint, listEndpoint, requireArg } from './shared.js';

export const appTools: ToolDefinition[] = [
  {
    name: 'list-mobile-apps',
    description:
      '[read] List Intune-managed mobile apps across all platforms. Use $filter to narrow by app type or platform.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceAppManagement/mobileApps', args),
  },
  {
    name: 'get-mobile-app',
    description: '[read] Get a single mobile app by id.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Mobile app id (GUID).' },
        select: { type: 'string', description: 'OData $select: comma-separated fields.' },
        expand: {
          type: 'string',
          description: 'OData $expand: e.g. "assignments,categories".',
        },
        ...CLIENT_PROPERTY,
      },
      required: ['appId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'appId');
      const params = new URLSearchParams();
      if (args.select) params.set('$select', args.select);
      if (args.expand) params.set('$expand', args.expand);
      const qs = params.toString();
      return getEndpoint(
        `/deviceAppManagement/mobileApps/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
        args,
      );
    },
  },
  {
    name: 'list-mobile-app-assignments',
    description: '[read] List assignments (target groups + intents) for a mobile app.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Mobile app id (GUID).' },
        ...odataProps(),
      },
      required: ['appId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'appId');
      return listEndpoint(
        `/deviceAppManagement/mobileApps/${encodeURIComponent(id)}/assignments`,
        args,
      );
    },
  },
  {
    name: 'get-mobile-app-installation-summary',
    description:
      '[read] Get the install/failure summary across devices and users for a mobile app.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Mobile app id (GUID).' },
        ...CLIENT_PROPERTY,
      },
      required: ['appId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'appId');
      return getEndpoint(
        `/deviceAppManagement/mobileApps/${encodeURIComponent(id)}/installSummary`,
        args,
      );
    },
  },
];
