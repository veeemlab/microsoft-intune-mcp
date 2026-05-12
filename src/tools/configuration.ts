import type { ToolDefinition } from '../types.js';
import { CLIENT_PROPERTY, odataProps } from '../query.js';
import { getEndpoint, listEndpoint, requireArg } from './shared.js';

export const configurationTools: ToolDefinition[] = [
  {
    name: 'list-device-configurations',
    description: '[read] List classic Intune device configuration profiles (deviceConfigurations).',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/deviceConfigurations', args),
  },
  {
    name: 'get-device-configuration',
    description: '[read] Get a single classic device configuration profile by id.',
    inputSchema: {
      type: 'object',
      properties: {
        configurationId: { type: 'string', description: 'Device configuration id (GUID).' },
        select: { type: 'string', description: 'OData $select: comma-separated fields.' },
        expand: { type: 'string', description: 'OData $expand: navigation properties.' },
        ...CLIENT_PROPERTY,
      },
      required: ['configurationId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'configurationId');
      const params = new URLSearchParams();
      if (args.select) params.set('$select', args.select);
      if (args.expand) params.set('$expand', args.expand);
      const qs = params.toString();
      return getEndpoint(
        `/deviceManagement/deviceConfigurations/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
        args,
      );
    },
  },
  {
    name: 'list-configuration-policies',
    description:
      '[read] List Settings Catalog configuration policies (configurationPolicies). Distinct from classic deviceConfigurations.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/configurationPolicies', args),
  },
  {
    name: 'get-configuration-policy',
    description: '[read] Get a single Settings Catalog configuration policy by id.',
    inputSchema: {
      type: 'object',
      properties: {
        policyId: { type: 'string', description: 'Configuration policy id (GUID).' },
        select: { type: 'string', description: 'OData $select: comma-separated fields.' },
        expand: { type: 'string', description: 'OData $expand: navigation properties.' },
        ...CLIENT_PROPERTY,
      },
      required: ['policyId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'policyId');
      const params = new URLSearchParams();
      if (args.select) params.set('$select', args.select);
      if (args.expand) params.set('$expand', args.expand);
      const qs = params.toString();
      return getEndpoint(
        `/deviceManagement/configurationPolicies/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
        args,
      );
    },
  },
  {
    name: 'list-configuration-policy-assignments',
    description: '[read] List assignments for a Settings Catalog configuration policy.',
    inputSchema: {
      type: 'object',
      properties: {
        policyId: { type: 'string', description: 'Configuration policy id (GUID).' },
        ...odataProps(),
      },
      required: ['policyId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'policyId');
      return listEndpoint(
        `/deviceManagement/configurationPolicies/${encodeURIComponent(id)}/assignments`,
        args,
      );
    },
  },
];
