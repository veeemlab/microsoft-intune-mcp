import type { ToolDefinition } from '../types.js';
import { CLIENT_PROPERTY, odataProps } from '../query.js';
import { getEndpoint, listEndpoint, requireArg } from './shared.js';

export const deviceTools: ToolDefinition[] = [
  {
    name: 'list-managed-devices',
    description:
      '[read] List Intune managed devices. Supports OData $select/$filter/$top/$skiptoken. Prefer $select for large tenants.',
    inputSchema: {
      type: 'object',
      properties: odataProps(),
    },
    handler: (args) => listEndpoint('/deviceManagement/managedDevices', args),
  },
  {
    name: 'get-managed-device',
    description: '[read] Get a single managed device by id.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Intune managed device id (GUID).' },
        select: {
          type: 'string',
          description: 'OData $select: comma-separated fields to return.',
        },
        ...CLIENT_PROPERTY,
      },
      required: ['deviceId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'deviceId');
      const select = args.select ? `?$select=${encodeURIComponent(args.select)}` : '';
      return getEndpoint(
        `/deviceManagement/managedDevices/${encodeURIComponent(id)}${select}`,
        args,
      );
    },
  },
  {
    name: 'list-user-managed-devices',
    description: '[read] List managed devices owned by a specific Entra ID user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Entra ID user id (GUID) or userPrincipalName.' },
        ...odataProps(),
      },
      required: ['userId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'userId');
      return listEndpoint(`/users/${encodeURIComponent(id)}/managedDevices`, args);
    },
  },
  {
    name: 'list-device-detected-apps',
    description: '[read] List apps detected on a specific managed device.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Intune managed device id (GUID).' },
        ...odataProps(),
      },
      required: ['deviceId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'deviceId');
      return listEndpoint(
        `/deviceManagement/managedDevices/${encodeURIComponent(id)}/detectedApps`,
        args,
      );
    },
  },
  {
    name: 'list-detected-apps',
    description:
      '[read] List apps detected across the tenant (aggregated). Use $filter and $top for large tenants.',
    inputSchema: {
      type: 'object',
      properties: odataProps(),
    },
    handler: (args) => listEndpoint('/deviceManagement/detectedApps', args),
  },
  {
    name: 'get-device-compliance-state',
    description: '[read] Get the compliance policy evaluation state for a managed device.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Intune managed device id (GUID).' },
        ...odataProps(),
      },
      required: ['deviceId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'deviceId');
      return listEndpoint(
        `/deviceManagement/managedDevices/${encodeURIComponent(id)}/deviceCompliancePolicyStates`,
        args,
      );
    },
  },
  {
    name: 'get-device-configuration-state',
    description: '[read] Get the configuration profile evaluation state for a managed device.',
    inputSchema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'Intune managed device id (GUID).' },
        ...odataProps(),
      },
      required: ['deviceId'],
    },
    handler: (args) => {
      const id = requireArg(args, 'deviceId');
      return listEndpoint(
        `/deviceManagement/managedDevices/${encodeURIComponent(id)}/deviceConfigurationStates`,
        args,
      );
    },
  },
];
