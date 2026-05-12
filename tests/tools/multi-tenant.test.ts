import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

type MockResponse = { status: number; body: unknown; headers?: Record<string, string> };

function mockFetchSequence(responses: Array<MockResponse>) {
  const mock = vi.fn();
  for (const r of responses) {
    const isString = typeof r.body === 'string';
    const text = isString ? (r.body as string) : JSON.stringify(r.body);
    const headers = r.headers ?? {};
    mock.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      text: async () => text,
      json: async () => (isString ? JSON.parse(text || '{}') : r.body),
      headers: { get: (name: string) => headers[name] ?? null },
    });
  }
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  process.env.AZURE_CLIENT_ID = 'shared-client-id';
  process.env.AZURE_CLIENT_SECRET = 'shared-client-secret';
  delete process.env.AZURE_TENANT_ID;
  process.env.INTUNE_CLIENTS = 'acme:tenant-acme,contoso:tenant-contoso';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function freshTools() {
  vi.resetModules();
  const { deviceTools } = await import('../../src/tools/devices.js');
  const { clientTools } = await import('../../src/tools/clients.js');
  return { deviceTools, clientTools };
}

describe('multi-tenant routing', () => {
  it('routes list-managed-devices to the tenant named by `client`', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok-acme', expires_in: 3600 } },
      { status: 200, body: { value: [{ id: 'acme-1' }] } },
    ]);
    const { deviceTools } = await freshTools();
    const tool = deviceTools.find((t) => t.name === 'list-managed-devices')!;
    await tool.handler({ client: 'acme' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://login.microsoftonline.com/tenant-acme/oauth2/v2.0/token',
    );
  });

  it('keeps independent token caches per tenant', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok-acme', expires_in: 3600 } },
      { status: 200, body: { value: [] } },
      { status: 200, body: { access_token: 'tok-contoso', expires_in: 3600 } },
      { status: 200, body: { value: [] } },
    ]);
    const { deviceTools } = await freshTools();
    const tool = deviceTools.find((t) => t.name === 'list-managed-devices')!;
    await tool.handler({ client: 'acme' });
    await tool.handler({ client: 'contoso' });

    const tokenCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith('/oauth2/v2.0/token'),
    );
    expect(tokenCalls).toHaveLength(2);
    expect(tokenCalls[0][0]).toContain('/tenant-acme/');
    expect(tokenCalls[1][0]).toContain('/tenant-contoso/');
  });

  it('throws when client argument is omitted with multiple tenants configured', async () => {
    const { deviceTools } = await freshTools();
    const tool = deviceTools.find((t) => t.name === 'list-managed-devices')!;
    // Wrap in async fn so synchronous throw becomes a rejection for vitest.
    await expect(async () => tool.handler({})).rejects.toThrow(/'client' is required/);
  });

  it('list-intune-clients returns configured tenants without calling Graph', async () => {
    const fetchMock = mockFetchSequence([]);
    const { clientTools } = await freshTools();
    const tool = clientTools.find((t) => t.name === 'list-intune-clients')!;
    const resp = await tool.handler({});
    const parsed = JSON.parse(resp.content[0].text);
    expect(parsed.multiTenant).toBe(true);
    expect(parsed.count).toBe(2);
    expect(parsed.clients.map((c: { key: string }) => c.key)).toEqual(['acme', 'contoso']);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('single-tenant compatibility mode', () => {
  beforeEach(() => {
    delete process.env.INTUNE_CLIENTS;
    process.env.AZURE_TENANT_ID = 'solo-tenant-id';
  });

  it('still works without `client` argument', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: { value: [] } },
    ]);
    const { deviceTools } = await freshTools();
    const tool = deviceTools.find((t) => t.name === 'list-managed-devices')!;
    await tool.handler({});
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://login.microsoftonline.com/solo-tenant-id/oauth2/v2.0/token',
    );
  });

  it('list-intune-clients reports multiTenant=false', async () => {
    mockFetchSequence([]);
    const { clientTools } = await freshTools();
    const tool = clientTools.find((t) => t.name === 'list-intune-clients')!;
    const resp = await tool.handler({});
    const parsed = JSON.parse(resp.content[0].text);
    expect(parsed.multiTenant).toBe(false);
    expect(parsed.count).toBe(1);
    expect(parsed.clients[0].key).toBe('default');
  });
});
