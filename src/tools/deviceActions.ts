import type { ToolDefinition, ToolResponse } from '../types.js';
import { getApiFor } from '../graph-api.js';
import { jsonResult } from '../format.js';
import { CLIENT_PROPERTY } from '../query.js';
import { requireArg } from './shared.js';

async function postAction(
  args: Record<string, string>,
  action: string,
  body: unknown = {},
): Promise<ToolResponse> {
  const id = requireArg(args, 'deviceId');
  const api = getApiFor(args.client);
  const result = await api.post(
    `/deviceManagement/managedDevices/${encodeURIComponent(id)}/${action}`,
    body,
  );
  return jsonResult(result);
}

const deviceIdProperty = {
  deviceId: { type: 'string', description: 'Intune managed device id (GUID).' },
} as const;

export const deviceActionTools: ToolDefinition[] = [
  {
    name: 'sync-device',
    description:
      '[write] Force the device to check in with Intune (apply pending policies and inventory). Operational, safe to retry.',
    inputSchema: {
      type: 'object',
      properties: { ...deviceIdProperty, ...CLIENT_PROPERTY },
      required: ['deviceId'],
    },
    handler: (args) => postAction(args, 'syncDevice'),
  },
  {
    name: 'reboot-device',
    description:
      '[write/reversible] Reboot the device immediately. End user will lose unsaved work but the device returns intact.',
    inputSchema: {
      type: 'object',
      properties: { ...deviceIdProperty, ...CLIENT_PROPERTY },
      required: ['deviceId'],
    },
    handler: (args) => postAction(args, 'rebootNow'),
  },
  {
    name: 'remote-lock',
    description:
      '[write/reversible] Lock the device screen remotely. End user must re-authenticate to resume.',
    inputSchema: {
      type: 'object',
      properties: { ...deviceIdProperty, ...CLIENT_PROPERTY },
      required: ['deviceId'],
    },
    handler: (args) => postAction(args, 'remoteLock'),
  },
  {
    name: 'set-device-name',
    description:
      '[write] Rename the managed device. Some platforms apply on next sync; Windows requires reboot.',
    inputSchema: {
      type: 'object',
      properties: {
        ...deviceIdProperty,
        deviceName: { type: 'string', description: 'New device name.' },
        ...CLIENT_PROPERTY,
      },
      required: ['deviceId', 'deviceName'],
    },
    handler: (args) => {
      const name = requireArg(args, 'deviceName');
      return postAction(args, 'setDeviceName', { deviceName: name });
    },
  },
  {
    name: 'send-custom-notification',
    description:
      '[write] Send a push notification to the Company Portal app on the device. Requires Company Portal installed.',
    inputSchema: {
      type: 'object',
      properties: {
        ...deviceIdProperty,
        notificationTitle: { type: 'string', description: 'Notification title (short).' },
        notificationBody: { type: 'string', description: 'Notification body text.' },
        ...CLIENT_PROPERTY,
      },
      required: ['deviceId', 'notificationTitle', 'notificationBody'],
    },
    handler: (args) => {
      const title = requireArg(args, 'notificationTitle');
      const body = requireArg(args, 'notificationBody');
      return postAction(args, 'sendCustomNotificationToCompanyPortal', {
        notificationTitle: title,
        notificationBody: body,
      });
    },
  },
  {
    name: 'retire-device',
    description:
      "[write/destructive] Unenroll the device and remove company data + Intune policies. Personal data on BYOD stays. Irreversible without re-enrollment. Often the safer first step before 'wipe-device'.",
    inputSchema: {
      type: 'object',
      properties: { ...deviceIdProperty, ...CLIENT_PROPERTY },
      required: ['deviceId'],
    },
    handler: (args) => postAction(args, 'retire'),
  },
  {
    name: 'wipe-device',
    description:
      '[write/destructive] Factory-reset the device. ALL data is erased. Optionally keep user data on Windows (Fresh Start semantics) and keep enrollment data. Irreversible.',
    inputSchema: {
      type: 'object',
      properties: {
        ...deviceIdProperty,
        keepEnrollmentData: {
          type: 'string',
          description: 'Set "true" to retain enrollment state (Windows). Default false.',
        },
        keepUserData: {
          type: 'string',
          description: 'Set "true" to keep user data (Windows Fresh Start). Default false.',
        },
        ...CLIENT_PROPERTY,
      },
      required: ['deviceId'],
    },
    handler: (args) => {
      const body: Record<string, boolean> = {};
      if (args.keepEnrollmentData) body.keepEnrollmentData = args.keepEnrollmentData === 'true';
      if (args.keepUserData) body.keepUserData = args.keepUserData === 'true';
      return postAction(args, 'wipe', body);
    },
  },
];
