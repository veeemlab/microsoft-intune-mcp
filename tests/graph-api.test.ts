import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function importFreshApi() {
  vi.resetModules();
  return await import('../src/graph-api.js');
}

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
  process.env.AZURE_TENANT_ID = 'tenant-id';
  process.env.AZURE_CLIENT_ID = 'client-id';
  process.env.AZURE_CLIENT_SECRET = 'client-secret';
  delete process.env.GRAPH_BASE_URL;
  delete process.env.GRAPH_API_VERSION;
  delete process.env.AZURE_AUTHORITY_HOST;

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

describe('GraphApi.getToken', () => {
  it('requests a token via client_credentials with the .default scope', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } },
      { status: 200, body: { value: [] } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await api.get('/deviceManagement/managedDevices');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [authUrl, authInit] = fetchMock.mock.calls[0];
    expect(authUrl).toBe('https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
    expect(authInit.method).toBe('POST');
    expect(authInit.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(authInit.body).toContain('grant_type=client_credentials');
    expect(authInit.body).toContain('client_id=client-id');
    expect(authInit.body).toContain('client_secret=client-secret');
    expect(authInit.body).toContain(
      `scope=${encodeURIComponent('https://graph.microsoft.com/.default')}`,
    );
  });

  it('reuses a cached token within TTL', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok-cache', expires_in: 3600 } },
      { status: 200, body: { call: 1 } },
      { status: 200, body: { call: 2 } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await api.get('/deviceManagement/managedDevices');
    await api.get('/deviceManagement/managedDevices');

    const tokenRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/oauth2/v2.0/token'),
    );
    expect(tokenRequests).toHaveLength(1);
  });

  it('coalesces parallel callers into one auth fetch', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok-shared', expires_in: 3600 } },
      { status: 200, body: { call: 1 } },
      { status: 200, body: { call: 2 } },
      { status: 200, body: { call: 3 } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await Promise.all([
      api.get('/deviceManagement/managedDevices'),
      api.get('/deviceManagement/managedDevices'),
      api.get('/deviceManagement/managedDevices'),
    ]);

    const tokenRequests = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/oauth2/v2.0/token'),
    );
    expect(tokenRequests).toHaveLength(1);
  });

  it('throws a sanitised auth-failed error on bad credentials', async () => {
    mockFetchSequence([
      { status: 401, body: { error: 'invalid_client', error_description: 'AADSTS7000215' } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await expect(api.get('/deviceManagement/managedDevices')).rejects.toThrow(
      /Auth failed \(401\)/,
    );
  });
});

describe('GraphApi.apiCall — URL construction', () => {
  it('builds against graph.microsoft.com/v1.0 by default', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: { value: [] } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await api.get('/deviceManagement/managedDevices');

    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices',
    );
  });

  it('respects GRAPH_BASE_URL and GRAPH_API_VERSION overrides', async () => {
    process.env.GRAPH_BASE_URL = 'https://graph.microsoft.us';
    process.env.GRAPH_API_VERSION = 'beta';

    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: {} },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await api.get('/deviceManagement/managedDevices');

    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.microsoft.us/beta/deviceManagement/managedDevices',
    );
    // Scope also tracks the sovereign cloud.
    expect(fetchMock.mock.calls[0][1].body).toContain(
      encodeURIComponent('https://graph.microsoft.us/.default'),
    );
  });

  it('passes a fully-qualified URL straight through (nextLink case)', async () => {
    const next = 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$skiptoken=ABC';
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: { value: [] } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await api.get(next);

    expect(fetchMock.mock.calls[1][0]).toBe(next);
  });
});

describe('GraphApi.apiCall — retries', () => {
  it('refreshes the token once on 401 and retries', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok-old', expires_in: 3600 } },
      { status: 401, body: 'token expired' },
      { status: 200, body: { access_token: 'tok-new', expires_in: 3600 } },
      { status: 200, body: { ok: true } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    const result = await api.get('/deviceManagement/managedDevices');

    expect(result).toEqual({ ok: true });
    const tokenCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith('/oauth2/v2.0/token'),
    );
    expect(tokenCalls).toHaveLength(2);
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer tok-new');
  });

  it('does not retry 401 twice', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } },
      { status: 401, body: 'expired' },
      { status: 200, body: { access_token: 'tok-2', expires_in: 3600 } },
      { status: 401, body: 'still bad' },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await expect(api.get('/deviceManagement/managedDevices')).rejects.toThrow(
      /Graph API error \(401/,
    );
  });

  it('honours Retry-After on 429 then succeeds', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 429, body: 'throttled', headers: { 'Retry-After': '2' } },
      { status: 200, body: { ok: true } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    const result = await api.get('/deviceManagement/managedDevices');

    expect(result).toEqual({ ok: true });
    const setTimeoutMock = vi.mocked(global.setTimeout);
    expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries 5xx on GET with backoff', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 503, body: 'down' },
      { status: 502, body: 'bad gateway' },
      { status: 200, body: { ok: true } },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    const result = await api.get('/deviceManagement/managedDevices');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('gives up after MAX_RETRIES on persistent 5xx', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 503, body: 'down' },
      { status: 503, body: 'down' },
      { status: 503, body: 'down' },
      { status: 503, body: 'down' },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await expect(api.get('/deviceManagement/managedDevices')).rejects.toThrow(
      /Graph API error \(503/,
    );
  });
});

describe('GraphApi error surface', () => {
  it('normalises Graph error envelope (code + message + requestId)', async () => {
    const errorBody = {
      error: {
        code: 'ResourceNotFound',
        message: 'The resource was not found.',
        innerError: { 'request-id': 'req-abc-123', date: '2026-01-01T00:00:00Z' },
      },
    };
    mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 404, body: errorBody },
    ]);

    const { GraphApi } = await importFreshApi();
    const api = new GraphApi();
    await expect(api.get('/deviceManagement/managedDevices/missing')).rejects.toThrow(
      /Graph API error \(404 ResourceNotFound\): The resource was not found\. \[request-id: req-abc-123\]/,
    );
  });
});
