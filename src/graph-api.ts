import { GraphApiError, normalizeGraphError } from './errors.js';
import type { TokenData } from './types.js';
import { resolveClient } from './clients.js';

const DEFAULT_AUTHORITY = 'https://login.microsoftonline.com';
const DEFAULT_GRAPH_BASE = 'https://graph.microsoft.com';
const DEFAULT_API_VERSION = 'v1.0';

const MAX_RETRIES = 3;
const TOKEN_REFRESH_BUFFER_SECONDS = 300;
const SAFE_METHODS = new Set(['GET', 'HEAD']);

// Allowlist of official Microsoft Graph hosts. Any absolute URL passed into
// the Graph client must resolve to one of these — otherwise we'd hand the
// Bearer token to a third party (SSRF / token exfiltration).
const GRAPH_HOST_ALLOWLIST =
  /^(graph\.microsoft\.com|graph\.microsoft\.us|dod-graph\.microsoft\.us|microsoftgraph\.chinacloudapi\.cn)$/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GraphApiOptions {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  authorityHost?: string;
  graphBaseUrl?: string;
  apiVersion?: string;
}

export class GraphApi {
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private authorityHost: string;
  private graphBaseUrl: string;
  private apiVersion: string;
  private token: TokenData | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(opts: GraphApiOptions = {}) {
    this.tenantId = opts.tenantId ?? process.env.AZURE_TENANT_ID ?? '';
    this.clientId = opts.clientId ?? process.env.AZURE_CLIENT_ID ?? '';
    this.clientSecret = opts.clientSecret ?? process.env.AZURE_CLIENT_SECRET ?? '';
    this.authorityHost = (
      opts.authorityHost ??
      process.env.AZURE_AUTHORITY_HOST ??
      DEFAULT_AUTHORITY
    ).replace(/\/+$/, '');
    this.graphBaseUrl = (
      opts.graphBaseUrl ??
      process.env.GRAPH_BASE_URL ??
      DEFAULT_GRAPH_BASE
    ).replace(/\/+$/, '');
    this.apiVersion = opts.apiVersion ?? process.env.GRAPH_API_VERSION ?? DEFAULT_API_VERSION;
  }

  private get tokenEndpoint(): string {
    return `${this.authorityHost}/${this.tenantId}/oauth2/v2.0/token`;
  }

  private get graphScope(): string {
    return `${this.graphBaseUrl}/.default`;
  }

  private assertConfigured(): void {
    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      throw new Error(
        'Graph client is not configured: tenantId, clientId and clientSecret are all required.',
      );
    }
  }

  private async getToken(): Promise<string> {
    if (this.token) {
      const elapsed = (Date.now() - this.token.obtained_at) / 1000;
      const remaining = this.token.expires_in - elapsed;
      if (remaining > TOKEN_REFRESH_BUFFER_SECONDS) {
        return this.token.access_token;
      }
    }

    // Singleton in-flight token request: concurrent callers share one fetch
    // so a burst of parallel tool calls doesn't trigger N parallel auth requests.
    if (this.tokenPromise) return this.tokenPromise;

    this.tokenPromise = this.fetchNewToken().finally(() => {
      this.tokenPromise = null;
    });
    return this.tokenPromise;
  }

  private async fetchNewToken(): Promise<string> {
    this.assertConfigured();
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: this.graphScope,
    });

    const resp = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      const normalized = normalizeGraphError(resp.status, text);
      throw new Error(`Auth failed (${normalized.status}): ${normalized.message}`);
    }

    const data = (await resp.json()) as { access_token: string; expires_in: number };
    this.token = {
      access_token: data.access_token,
      expires_in: data.expires_in,
      obtained_at: Date.now(),
    };
    return this.token.access_token;
  }

  // Expose configured cloud so callers (e.g. @odata.id construction) don't
  // hardcode graph.microsoft.com and break in sovereign clouds.
  get baseUrl(): string {
    return this.graphBaseUrl;
  }

  get version(): string {
    return this.apiVersion;
  }

  async get(path: string): Promise<unknown> {
    return this.apiCall('GET', path);
  }

  // Follow an absolute @odata.nextLink. Refuses anything that isn't an HTTPS
  // Graph URL so a malformed nextLink can't redirect the token to a third
  // party host.
  async getFromNextLink(absoluteUrl: string): Promise<unknown> {
    let parsed: URL;
    try {
      parsed = new URL(absoluteUrl);
    } catch {
      throw new Error('nextLink is not a valid URL.');
    }
    if (parsed.protocol !== 'https:' || !GRAPH_HOST_ALLOWLIST.test(parsed.host)) {
      throw new Error('nextLink must be an HTTPS Microsoft Graph URL.');
    }
    return this.apiCall('GET', absoluteUrl);
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    return this.apiCall('POST', path, body);
  }

  async patch(path: string, body: unknown): Promise<unknown> {
    return this.apiCall('PATCH', path, body);
  }

  async delete(path: string): Promise<unknown> {
    return this.apiCall('DELETE', path);
  }

  async apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = this.buildUrl(path);
    const isSafeMethod = SAFE_METHODS.has(method.toUpperCase());
    let auth401Retried = false;
    let attempt = 0;

    while (true) {
      const token = await this.getToken();
      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
      };
      if (body !== undefined) {
        options.body = JSON.stringify(body);
      }

      const resp = await fetch(url, options);

      if (resp.status === 204) return { success: true };
      if (resp.ok) {
        const text = await resp.text();
        return text ? JSON.parse(text) : { success: true };
      }

      if (resp.status === 401 && !auth401Retried) {
        this.token = null;
        auth401Retried = true;
        continue;
      }

      // 429: Graph said it didn't act, but for write methods we still can't
      // safely auto-retry. Graph occasionally returns 429 after the side
      // effect was already queued (e.g. retire/wipe accepted then throttled),
      // and a blind retry would issue it twice. Only safe methods get
      // auto-retry; writes surface the 429 with the Retry-After hint so the
      // caller can decide.
      if (resp.status === 429 && isSafeMethod && attempt < MAX_RETRIES) {
        const retryAfter = resp.headers.get('Retry-After');
        const delayMs = retryAfter
          ? Math.max(0, parseInt(retryAfter, 10) * 1000)
          : 1000 * Math.pow(2, attempt);
        await sleep(delayMs);
        attempt++;
        continue;
      }

      if (resp.status >= 500 && resp.status < 600 && isSafeMethod && attempt < MAX_RETRIES) {
        const delayMs = Math.random() * 1000 * Math.pow(2, attempt);
        await sleep(delayMs);
        attempt++;
        continue;
      }

      const text = await resp.text();
      throw new GraphApiError(normalizeGraphError(resp.status, text));
    }
  }

  private buildUrl(pathOrUrl: string): string {
    // Absolute URLs allowed only if they target an allowlisted Graph host.
    // Prevents a caller from accidentally pivoting the Bearer token to an
    // arbitrary host. nextLink follows go through getFromNextLink() which
    // performs the same check before getting here.
    if (/^https?:\/\//i.test(pathOrUrl)) {
      let parsed: URL;
      try {
        parsed = new URL(pathOrUrl);
      } catch {
        throw new Error('Invalid URL passed to Graph client.');
      }
      if (parsed.protocol !== 'https:' || !GRAPH_HOST_ALLOWLIST.test(parsed.host)) {
        throw new Error(`Refusing to send Graph token to non-Graph host: ${parsed.host}`);
      }
      return pathOrUrl;
    }
    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${this.graphBaseUrl}/${this.apiVersion}${path}`;
  }
}

// One GraphApi instance per client key. Each instance has its own token cache,
// so a 401 on tenant A doesn't ripple into tenant B's flow.
const _apiByKey = new Map<string, GraphApi>();

export function getApiFor(clientKey: string | undefined): GraphApi {
  const client = resolveClient(clientKey);
  let api = _apiByKey.get(client.key);
  if (!api) {
    api = new GraphApi({ tenantId: client.tenantId });
    _apiByKey.set(client.key, api);
  }
  return api;
}

// Convenience for callers that don't care about multi-tenant (resources, the
// pagination tool when no client is supplied) — uses the resolved default.
export function getApi(): GraphApi {
  return getApiFor(undefined);
}

// Test-only hook to reset the per-tenant cache.
export function _resetApiForTests(): void {
  _apiByKey.clear();
}
