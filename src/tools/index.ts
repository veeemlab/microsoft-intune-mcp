import type { ToolDefinition } from '../types.js';

export type IntuneMode = 'read' | 'full';

export const INTUNE_MODES: readonly IntuneMode[] = ['read', 'full'] as const;

export function parseMode(raw: string | undefined): IntuneMode {
  const value = (raw ?? 'read').toLowerCase();
  if (value === 'read' || value === 'full') return value;
  throw new Error(`Invalid INTUNE_MODE='${raw}'. Expected one of: ${INTUNE_MODES.join(', ')}.`);
}

export function filterToolsByMode(tools: ToolDefinition[], mode: IntuneMode): ToolDefinition[] {
  if (mode === 'full') return tools;
  return tools.filter((t) => t.description.trimStart().startsWith('[read]'));
}

import { clientTools } from './clients.js';
import { deviceTools } from './devices.js';
import { deviceActionTools } from './deviceActions.js';
import { deviceManagementTools } from './deviceManagement.js';
import { complianceTools } from './compliance.js';
import { configurationTools } from './configuration.js';
import { appTools } from './apps.js';
import { appProtectionTools } from './appProtection.js';
import { enrollmentTools } from './enrollment.js';
import { autopilotTools } from './autopilot.js';
import { scriptTools } from './scripts.js';
import { filterTools } from './filters.js';
import { connectorTools } from './connectors.js';
import { auditTools } from './audit.js';
import { paginationTools } from './pagination.js';

export const allTools: ToolDefinition[] = [
  ...clientTools,
  ...deviceTools,
  ...deviceActionTools,
  ...deviceManagementTools,
  ...complianceTools,
  ...configurationTools,
  ...appTools,
  ...appProtectionTools,
  ...enrollmentTools,
  ...autopilotTools,
  ...scriptTools,
  ...filterTools,
  ...connectorTools,
  ...auditTools,
  ...paginationTools,
];
