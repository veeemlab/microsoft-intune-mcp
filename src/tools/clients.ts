import type { ToolDefinition } from '../types.js';
import { listClients, loadClientsConfig } from '../clients.js';
import { jsonResult } from '../format.js';

export const clientTools: ToolDefinition[] = [
  {
    name: 'list-intune-clients',
    description:
      '[read] List the Intune tenants this server is configured to manage. Use the returned `key` values as the `client` argument for other tools.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const cfg = loadClientsConfig();
      const entries = listClients().map(({ key, tenantId }) => ({ key, tenantId }));
      return jsonResult({
        multiTenant: cfg.multiTenant,
        count: entries.length,
        clients: entries,
      });
    },
  },
];
