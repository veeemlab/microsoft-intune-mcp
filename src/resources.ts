import { getApi } from './graph-api.js';
import { formatJson } from './format.js';

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceTemplateDefinition {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}

export const staticResources: ResourceDefinition[] = [
  {
    uri: 'intune://managed-devices',
    name: 'Managed Devices',
    description: 'All Intune managed devices in the tenant.',
    mimeType: 'application/json',
  },
  {
    uri: 'intune://compliance-policies',
    name: 'Compliance Policies',
    description: 'All Intune device compliance policies.',
    mimeType: 'application/json',
  },
  {
    uri: 'intune://configuration-policies',
    name: 'Configuration Policies',
    description: 'All Intune Settings Catalog configuration policies.',
    mimeType: 'application/json',
  },
  {
    uri: 'intune://mobile-apps',
    name: 'Mobile Apps',
    description: 'All Intune-managed mobile apps.',
    mimeType: 'application/json',
  },
];

export const resourceTemplates: ResourceTemplateDefinition[] = [
  {
    uriTemplate: 'intune://managed-devices/{deviceId}',
    name: 'Managed Device',
    description: 'Details for a single managed device.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'intune://compliance-policies/{policyId}',
    name: 'Compliance Policy',
    description: 'Details for a single compliance policy.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'intune://configuration-policies/{policyId}',
    name: 'Configuration Policy',
    description: 'Details for a single Settings Catalog configuration policy.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'intune://mobile-apps/{appId}',
    name: 'Mobile App',
    description: 'Details for a single mobile app.',
    mimeType: 'application/json',
  },
];

// formatJson enforces the INTUNE_MAX_RESPONSE_BYTES cap on every resource so
// a tenant-wide list can't blow the agent's context window or leak the entire
// device inventory in one read.
export async function handleResource(uri: string): Promise<string> {
  const api = getApi();

  if (uri === 'intune://managed-devices') {
    return formatJson(await api.get('/deviceManagement/managedDevices'));
  }
  if (uri === 'intune://compliance-policies') {
    return formatJson(await api.get('/deviceManagement/deviceCompliancePolicies'));
  }
  if (uri === 'intune://configuration-policies') {
    return formatJson(await api.get('/deviceManagement/configurationPolicies'));
  }
  if (uri === 'intune://mobile-apps') {
    return formatJson(await api.get('/deviceAppManagement/mobileApps'));
  }

  const deviceMatch = uri.match(/^intune:\/\/managed-devices\/([^/]+)$/);
  if (deviceMatch) {
    return formatJson(
      await api.get(`/deviceManagement/managedDevices/${encodeURIComponent(deviceMatch[1])}`),
    );
  }

  const compMatch = uri.match(/^intune:\/\/compliance-policies\/([^/]+)$/);
  if (compMatch) {
    return formatJson(
      await api.get(
        `/deviceManagement/deviceCompliancePolicies/${encodeURIComponent(compMatch[1])}`,
      ),
    );
  }

  const configMatch = uri.match(/^intune:\/\/configuration-policies\/([^/]+)$/);
  if (configMatch) {
    return formatJson(
      await api.get(
        `/deviceManagement/configurationPolicies/${encodeURIComponent(configMatch[1])}`,
      ),
    );
  }

  const appMatch = uri.match(/^intune:\/\/mobile-apps\/([^/]+)$/);
  if (appMatch) {
    return formatJson(
      await api.get(`/deviceAppManagement/mobileApps/${encodeURIComponent(appMatch[1])}`),
    );
  }

  throw new Error(`Unknown resource: ${uri}`);
}
