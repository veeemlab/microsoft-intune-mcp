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

async function importFreshTools() {
  vi.resetModules();
  const { deviceTools } = await import('../../src/tools/devices.js');
  return deviceTools;
}

beforeEach(() => {
  process.env.AZURE_TENANT_ID = 'tenant-id';
  process.env.AZURE_CLIENT_ID = 'client-id';
  process.env.AZURE_CLIENT_SECRET = 'client-secret';
  vi.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0;
  }) as unknown as typeof setTimeout);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('deviceTools', () => {
  it('list-managed-devices targets the right Graph endpoint and forwards OData params', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: { value: [{ id: 'a', deviceName: 'L1' }] } },
    ]);

    const tools = await importFreshTools();
    const tool = tools.find((t) => t.name === 'list-managed-devices')!;
    const resp = await tool.handler({ select: 'id,deviceName', top: '5' });

    expect(resp.isError).toBeFalsy();
    expect(JSON.parse(resp.content[0].text)).toEqual({ value: [{ id: 'a', deviceName: 'L1' }] });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?%24select=id%2CdeviceName&%24top=5',
    );
  });

  it('get-managed-device throws a helpful error when deviceId missing', async () => {
    mockFetchSequence([{ status: 200, body: { access_token: 'tok', expires_in: 3600 } }]);
    const tools = await importFreshTools();
    const tool = tools.find((t) => t.name === 'get-managed-device')!;
    // requireArg throws synchronously before returning the Promise; that's fine,
    // server.ts wraps every tool call in try/catch around the await.
    expect(() => tool.handler({})).toThrow(/Missing required argument: deviceId/);
  });

  it('get-managed-device URL-encodes the device id and applies $select', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: { id: 'abc/def', deviceName: 'Edge case' } },
    ]);
    const tools = await importFreshTools();
    const tool = tools.find((t) => t.name === 'get-managed-device')!;
    await tool.handler({ deviceId: 'abc/def', select: 'id,deviceName' });

    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/abc%2Fdef?$select=id%2CdeviceName',
    );
  });

  it('list-user-managed-devices hits the user-scoped Graph endpoint', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: { value: [] } },
    ]);
    const tools = await importFreshTools();
    const tool = tools.find((t) => t.name === 'list-user-managed-devices')!;
    await tool.handler({ userId: 'user@example.com' });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.microsoft.com/v1.0/users/user%40example.com/managedDevices',
    );
  });
});

describe('paginationTools.fetch-next-page', () => {
  it('rejects non-Graph URLs', async () => {
    mockFetchSequence([{ status: 200, body: { access_token: 'tok', expires_in: 3600 } }]);
    vi.resetModules();
    const { paginationTools } = await import('../../src/tools/pagination.js');
    const tool = paginationTools.find((t) => t.name === 'fetch-next-page')!;
    // fetch-next-page is async — rejection is delivered via Promise.
    await expect(tool.handler({ nextLink: 'https://evil.example.com/foo' })).rejects.toThrow(
      /must be an HTTPS Microsoft Graph URL/,
    );
  });

  it('forwards a valid Graph nextLink as-is', async () => {
    const next = 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$skiptoken=abc';
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: { value: ['p2'] } },
    ]);
    vi.resetModules();
    const { paginationTools } = await import('../../src/tools/pagination.js');
    const tool = paginationTools.find((t) => t.name === 'fetch-next-page')!;
    await tool.handler({ nextLink: next });
    expect(fetchMock.mock.calls[1][0]).toBe(next);
  });
});
