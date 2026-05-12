// Multi-tenant registry. Parses INTUNE_CLIENTS once at module load time so
// every tool call resolves the same set of clients without touching env again.

export interface IntuneClient {
  key: string;
  tenantId: string;
}

export interface ClientsConfig {
  clients: Map<string, IntuneClient>;
  // True iff the user explicitly configured INTUNE_CLIENTS. When false we are
  // in single-tenant compatibility mode driven by AZURE_TENANT_ID.
  multiTenant: boolean;
}

const DEFAULT_KEY = 'default';

function parseClientsEnv(raw: string): Map<string, IntuneClient> {
  const out = new Map<string, IntuneClient>();
  const entries = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const colon = entry.indexOf(':');
    if (colon < 1 || colon === entry.length - 1) {
      throw new Error(
        `INTUNE_CLIENTS entry "${entry}" is malformed. Use the form "key:tenantId" with a non-empty key and tenant id.`,
      );
    }
    const key = entry.slice(0, colon).trim();
    const tenantId = entry.slice(colon + 1).trim();
    if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(key)) {
      throw new Error(
        `INTUNE_CLIENTS key "${key}" must match ^[a-zA-Z0-9_.-]{1,64}$ (Claude tool-use API constraint).`,
      );
    }
    if (out.has(key)) {
      throw new Error(`INTUNE_CLIENTS contains duplicate key "${key}".`);
    }
    out.set(key, { key, tenantId });
  }
  return out;
}

let _config: ClientsConfig | null = null;

export function loadClientsConfig(): ClientsConfig {
  if (_config) return _config;

  const raw = process.env.INTUNE_CLIENTS?.trim();
  if (raw) {
    const clients = parseClientsEnv(raw);
    if (clients.size === 0) {
      throw new Error('INTUNE_CLIENTS is set but parsed to zero entries.');
    }
    _config = { clients, multiTenant: true };
    return _config;
  }

  // Backward-compatible single-tenant mode.
  const tenantId = process.env.AZURE_TENANT_ID?.trim() ?? '';
  const clients = new Map<string, IntuneClient>();
  clients.set(DEFAULT_KEY, { key: DEFAULT_KEY, tenantId });
  _config = { clients, multiTenant: false };
  return _config;
}

// Resolve a client key from a tool argument. If the user passes nothing and
// only one client exists, that one is used. With multiple clients we fail
// loud so the agent has to be explicit.
export function resolveClient(requestedKey: string | undefined): IntuneClient {
  const cfg = loadClientsConfig();
  if (requestedKey) {
    const c = cfg.clients.get(requestedKey);
    if (!c) {
      const available = [...cfg.clients.keys()].join(', ');
      throw new Error(
        `Unknown Intune client "${requestedKey}". Available: ${available || '(none)'}.`,
      );
    }
    return c;
  }

  if (cfg.clients.size === 1) {
    return cfg.clients.values().next().value as IntuneClient;
  }

  const available = [...cfg.clients.keys()].join(', ');
  throw new Error(
    `'client' is required when multiple Intune clients are configured. Available: ${available}.`,
  );
}

export function listClients(): IntuneClient[] {
  return [...loadClientsConfig().clients.values()];
}

// Test-only hook to reset the singleton.
export function _resetClientsForTests(): void {
  _config = null;
}
