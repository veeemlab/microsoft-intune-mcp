import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.INTUNE_CLIENTS;
  delete process.env.AZURE_TENANT_ID;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function fresh() {
  // Reset the module cache so loadClientsConfig re-reads env every time.
  const mod = await import('../src/clients.js');
  mod._resetClientsForTests();
  return mod;
}

describe('loadClientsConfig — single-tenant fallback', () => {
  it('falls back to AZURE_TENANT_ID with key "default"', async () => {
    process.env.AZURE_TENANT_ID = 'tenant-only-id';
    const { loadClientsConfig } = await fresh();
    const cfg = loadClientsConfig();
    expect(cfg.multiTenant).toBe(false);
    expect(cfg.clients.size).toBe(1);
    expect(cfg.clients.get('default')?.tenantId).toBe('tenant-only-id');
  });

  it('still returns a default client when AZURE_TENANT_ID is missing (handler will fail later)', async () => {
    const { loadClientsConfig } = await fresh();
    const cfg = loadClientsConfig();
    expect(cfg.multiTenant).toBe(false);
    expect(cfg.clients.get('default')?.tenantId).toBe('');
  });
});

describe('loadClientsConfig — multi-tenant via INTUNE_CLIENTS', () => {
  it('parses key:tenantId pairs', async () => {
    process.env.INTUNE_CLIENTS = 'acme:tenant-a,contoso:tenant-b';
    const { loadClientsConfig } = await fresh();
    const cfg = loadClientsConfig();
    expect(cfg.multiTenant).toBe(true);
    expect(cfg.clients.size).toBe(2);
    expect(cfg.clients.get('acme')?.tenantId).toBe('tenant-a');
    expect(cfg.clients.get('contoso')?.tenantId).toBe('tenant-b');
  });

  it('trims whitespace and ignores empty entries', async () => {
    process.env.INTUNE_CLIENTS = '  acme : tenant-a , , contoso:tenant-b  ';
    const { loadClientsConfig } = await fresh();
    const cfg = loadClientsConfig();
    expect([...cfg.clients.keys()]).toEqual(['acme', 'contoso']);
  });

  it('rejects malformed entries', async () => {
    process.env.INTUNE_CLIENTS = 'no-colon-here';
    const { loadClientsConfig } = await fresh();
    expect(() => loadClientsConfig()).toThrow(/malformed/);
  });

  it('rejects duplicate keys', async () => {
    process.env.INTUNE_CLIENTS = 'acme:tenant-a,acme:tenant-b';
    const { loadClientsConfig } = await fresh();
    expect(() => loadClientsConfig()).toThrow(/duplicate key "acme"/);
  });

  it('rejects keys outside the Claude tool-use regex', async () => {
    process.env.INTUNE_CLIENTS = 'has space:tenant-a';
    const { loadClientsConfig } = await fresh();
    expect(() => loadClientsConfig()).toThrow(/Claude tool-use API constraint/);
  });

  it('takes precedence over AZURE_TENANT_ID when both are set', async () => {
    process.env.AZURE_TENANT_ID = 'ignored-tenant';
    process.env.INTUNE_CLIENTS = 'acme:tenant-a';
    const { loadClientsConfig } = await fresh();
    const cfg = loadClientsConfig();
    expect(cfg.multiTenant).toBe(true);
    expect(cfg.clients.has('default')).toBe(false);
    expect(cfg.clients.get('acme')?.tenantId).toBe('tenant-a');
  });
});

describe('resolveClient', () => {
  it('returns the only client when one is configured and key omitted', async () => {
    process.env.AZURE_TENANT_ID = 'solo-tenant';
    const { resolveClient } = await fresh();
    expect(resolveClient(undefined).tenantId).toBe('solo-tenant');
  });

  it('returns the matching client when key is provided', async () => {
    process.env.INTUNE_CLIENTS = 'acme:tenant-a,contoso:tenant-b';
    const { resolveClient } = await fresh();
    expect(resolveClient('contoso').tenantId).toBe('tenant-b');
  });

  it('throws when key is required but omitted with multiple clients', async () => {
    process.env.INTUNE_CLIENTS = 'acme:tenant-a,contoso:tenant-b';
    const { resolveClient } = await fresh();
    expect(() => resolveClient(undefined)).toThrow(
      /'client' is required.*Available: acme, contoso/,
    );
  });

  it('throws on unknown key', async () => {
    process.env.INTUNE_CLIENTS = 'acme:tenant-a';
    const { resolveClient } = await fresh();
    expect(() => resolveClient('fabrikam')).toThrow(/Unknown Intune client "fabrikam"/);
  });
});
