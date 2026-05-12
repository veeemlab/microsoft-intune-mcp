import type { ToolDefinition } from '../types.js';
import { CLIENT_PROPERTY, odataProps } from '../query.js';
import { getEndpoint, listEndpoint, requireArg } from './shared.js';

export const complianceTools: ToolDefinition[] = [
  {
    name: 'list-compliance-policies',
    description: '[read] List Intune device compliance policies.',
    inputSchema: { type: 'object', properties: odataProps() },
    handler: (args) => listEndpoint('/deviceManagement/deviceCompliancePolicies', args),
  },
  {
    name: 'get-compliance-policy',
    description: '[read] Get a single compliance policy by id.',
    inputSchema: {
      type: 'object',
      properties: {
        policyId: { type: 'string', description: 'Compliance policy id (GUID).' },
        select: {
          type: 'string',
          description: 'OData $select: comma-separated fields to return.',
        },
        expand: {
          type: 'string',
          description: 'OData $expand: navigation properties (e.g. "assignments").',
        },
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
        `/deviceManagement/deviceCompliancePolicies/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
        args,
      );
    },
  },
  {
    name: 'list-compliance-policy-assignments',
    description: '[read] List assignments for a compliance policy.',
    inputSchema: {
      type: 'object',
      properties: {
        policyId: { type: 'string', description: 'Compliance policy id (GUID).' },
        ...odataProps(),
      },
      required: ['policyId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'policyId');
      return listEndpoint(
        `/deviceManagement/deviceCompliancePolicies/${encodeURIComponent(id)}/assignments`,
        args,
      );
    },
  },
];
