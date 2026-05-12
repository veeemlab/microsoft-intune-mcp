import type { ToolDefinition } from '../types.js';
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
