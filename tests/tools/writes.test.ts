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
  process.env.AZURE_TENANT_ID = 'tenant-id';
  process.env.AZURE_CLIENT_ID = 'client-id';
  process.env.AZURE_CLIENT_SECRET = 'client-secret';
  delete process.env.INTUNE_CLIENTS;
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

async function freshTools() {
  vi.resetModules();
  const { deviceActionTools } = await import('../../src/tools/deviceActions.js');
  const { deviceManagementTools } = await import('../../src/tools/deviceManagement.js');
  return { deviceActionTools, deviceManagementTools };
}

describe('device action POSTs', () => {
  it('sync-device POSTs to the syncDevice action endpoint', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 204, body: '' },
    ]);
    const { deviceActionTools } = await freshTools();
    const tool = deviceActionTools.find((t) => t.name === 'sync-device')!;
    const resp = await tool.handler({ deviceId: 'dev-1' });
    expect(resp.isError).toBeFalsy();
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/dev-1/syncDevice',
    );
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  it('set-device-name sends deviceName in the body', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 204, body: '' },
    ]);
    const { deviceActionTools } = await freshTools();
    const tool = deviceActionTools.find((t) => t.name === 'set-device-name')!;
    await tool.handler({ deviceId: 'dev-1', deviceName: 'LAPTOP-NEW' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ deviceName: 'LAPTOP-NEW' });
  });

  it('wipe-device converts string booleans into a typed body', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 204, body: '' },
    ]);
    const { deviceActionTools } = await freshTools();
    const tool = deviceActionTools.find((t) => t.name === 'wipe-device')!;
    await tool.handler({ deviceId: 'dev-1', keepUserData: 'true', keepEnrollmentData: 'false' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      keepEnrollmentData: false,
      keepUserData: true,
    });
  });

  it('send-custom-notification requires both title and body', async () => {
    mockFetchSequence([{ status: 200, body: { access_token: 'tok', expires_in: 3600 } }]);
    const { deviceActionTools } = await freshTools();
    const tool = deviceActionTools.find((t) => t.name === 'send-custom-notification')!;
    expect(() => tool.handler({ deviceId: 'dev-1', notificationTitle: 'hi' })).toThrow(
      /notificationBody/,
    );
  });
});

describe('delete-managed-device', () => {
  it('issues DELETE against the managedDevice resource', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 204, body: '' },
    ]);
    const { deviceManagementTools } = await freshTools();
    const tool = deviceManagementTools.find((t) => t.name === 'delete-managed-device')!;
    await tool.handler({ deviceId: 'dev-x' });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/dev-x',
    );
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  });
});

describe('bulk-delete-managed-devices', () => {
  it('deletes every id and reports per-item outcome', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 204, body: '' },
      { status: 404, body: { error: { code: 'ResourceNotFound', message: 'gone' } } },
      { status: 204, body: '' },
    ]);
    const { deviceManagementTools } = await freshTools();
    const tool = deviceManagementTools.find((t) => t.name === 'bulk-delete-managed-devices')!;
    const resp = await tool.handler({ deviceIds: 'dev-a, dev-b, dev-c' });
    const parsed = JSON.parse(resp.content[0].text);
    expect(parsed.total).toBe(3);
    expect(parsed.succeeded).toBe(2);
    expect(parsed.failed).toBe(1);
    expect(parsed.results[1].ok).toBe(false);
    expect(parsed.results[1].error).toMatch(/Graph API error \(404/);
  });

  it('rejects more than 50 ids without making any Graph calls', async () => {
    const fetchMock = mockFetchSequence([]);
    const { deviceManagementTools } = await freshTools();
    const tool = deviceManagementTools.find((t) => t.name === 'bulk-delete-managed-devices')!;
    const ids = Array.from({ length: 51 }, (_, i) => `dev-${i}`).join(',');
    await expect(async () => tool.handler({ deviceIds: ids })).rejects.toThrow(/Max batch size/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('set-device-category PATCH', () => {
  it('PATCHes deviceCategoryDisplayName on the managedDevice resource', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 200, body: { id: 'dev-1', deviceCategoryDisplayName: 'Laptops' } },
    ]);
    const { deviceManagementTools } = await freshTools();
    const tool = deviceManagementTools.find((t) => t.name === 'set-device-category')!;
    await tool.handler({ deviceId: 'dev-1', category: 'Laptops' });
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      deviceCategoryDisplayName: 'Laptops',
    });
  });
});

describe('set-primary-user', () => {
  it('POSTs an @odata.id reference to the user', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok', expires_in: 3600 } },
      { status: 204, body: '' },
    ]);
    const { deviceManagementTools } = await freshTools();
    const tool = deviceManagementTools.find((t) => t.name === 'set-primary-user')!;
    await tool.handler({ deviceId: 'dev-1', userId: 'user-abc' });
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/dev-1/users/$ref',
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      '@odata.id': 'https://graph.microsoft.com/v1.0/users/user-abc',
    });
  });
});
