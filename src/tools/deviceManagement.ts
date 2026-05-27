import type { ToolDefinition, ToolResponse } from '../types.js';
import { getApiFor, type GraphApi } from '../graph-api.js';
import { jsonResult } from '../format.js';
import { CLIENT_PROPERTY } from '../query.js';
import { CONFIRM_PROPERTY, requireArg, requireConfirm } from './shared.js';

const deviceIdProperty = {
  deviceId: { type: 'string', description: 'Intune managed device id (GUID).' },
} as const;

async function deleteOne(api: GraphApi, id: string): Promise<unknown> {
  return api.delete(`/deviceManagement/managedDevices/${encodeURIComponent(id)}`);
}

export const deviceManagementTools: ToolDefinition[] = [
  {
    name: 'delete-managed-device',
    description:
      '[write/destructive] Delete the managed device record from Intune. Removes the device from the console but does not wipe it. Common when cleaning up duplicate or stale enrollments. Irreversible — pair with \'retire-device\' first if the endpoint is still active. Requires confirm="DELETE <deviceId>" — literal echo, including the device id.',
    inputSchema: {
      type: 'object',
      properties: { ...deviceIdProperty, ...CONFIRM_PROPERTY, ...CLIENT_PROPERTY },
      required: ['deviceId', 'confirm'],
    },
    handler: async (args) => {
      const id = requireArg(args, 'deviceId');
      requireConfirm(args, `DELETE ${id}`, 'delete-managed-device');
      const api = getApiFor(args.client);
      const result = await deleteOne(api, id);
      return jsonResult(result);
    },
  },
  {
    name: 'bulk-delete-managed-devices',
    description:
      '[write/destructive] Delete multiple managed devices in one call. Pass a comma-separated list of device ids (max 50). Returns per-item success/error so a single bad id doesn\'t abort the batch. Useful for cleaning up duplicates after deduplication queries. Requires confirm="DELETE <N>" where N is the number of ids you are about to delete (literal echo).',
    inputSchema: {
      type: 'object',
      properties: {
        deviceIds: {
          type: 'string',
          description: 'Comma-separated managed device ids (GUIDs). Max 50.',
        },
        ...CONFIRM_PROPERTY,
        ...CLIENT_PROPERTY,
      },
      required: ['deviceIds', 'confirm'],
    },
    handler: async (args): Promise<ToolResponse> => {
      const raw = requireArg(args, 'deviceIds');
      const ids = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) throw new Error('No device ids provided.');
      if (ids.length > 50) {
        throw new Error(`Too many ids (${ids.length}). Max batch size is 50.`);
      }
      requireConfirm(args, `DELETE ${ids.length}`, 'bulk-delete-managed-devices');
      const api = getApiFor(args.client);
      const results: Array<{ deviceId: string; ok: boolean; error?: string }> = [];
      for (const id of ids) {
        try {
          await deleteOne(api, id);
          results.push({ deviceId: id, ok: true });
        } catch (err: unknown) {
          results.push({
            deviceId: id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      const succeeded = results.filter((r) => r.ok).length;
      return jsonResult({
        total: results.length,
        succeeded,
        failed: results.length - succeeded,
        results,
      });
    },
  },
  {
    name: 'set-device-category',
    description:
      '[write] Set the Intune device category (free-text label used for grouping/filtering policies). Use the display name of an existing category.',
    inputSchema: {
      type: 'object',
      properties: {
        ...deviceIdProperty,
        category: { type: 'string', description: 'Device category display name.' },
        ...CLIENT_PROPERTY,
      },
      required: ['deviceId', 'category'],
    },
    handler: async (args) => {
      const id = requireArg(args, 'deviceId');
      const category = requireArg(args, 'category');
      const api = getApiFor(args.client);
      const result = await api.patch(`/deviceManagement/managedDevices/${encodeURIComponent(id)}`, {
        deviceCategoryDisplayName: category,
      });
      return jsonResult(result);
    },
  },
  {
    name: 'set-primary-user',
    description:
      '[write] Assign or change the primary user of a managed device. Pass an empty userId to clear (some devices only).',
    inputSchema: {
      type: 'object',
      properties: {
        ...deviceIdProperty,
        userId: { type: 'string', description: 'Entra ID user id (GUID) of the new primary user.' },
        ...CLIENT_PROPERTY,
      },
      required: ['deviceId', 'userId'],
    },
    handler: async (args) => {
      const id = requireArg(args, 'deviceId');
      const userId = requireArg(args, 'userId');
      const api = getApiFor(args.client);
      // Graph expects a $ref pointing at the user resource. Build the URL
      // from the configured cloud + apiVersion so sovereign clouds work
      // (graph.microsoft.us / China / DoD).
      const odataId = `${api.baseUrl}/${api.version}/users/${encodeURIComponent(userId)}`;
      const result = await api.post(
        `/deviceManagement/managedDevices/${encodeURIComponent(id)}/users/$ref`,
        { '@odata.id': odataId },
      );
      return jsonResult(result);
    },
  },
];
