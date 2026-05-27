#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';
import { allTools, filterToolsByMode, parseMode, type IntuneMode } from './tools/index.js';

async function runStdio(mode: IntuneMode): Promise<void> {
  const server = buildServer({ mode });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const count = filterToolsByMode(allTools, mode).length;
  console.error(
    `[intune-mcp] stdio transport ready (mode=${mode}, ${count}/${allTools.length} tools registered)`,
  );
}

// Constant-time string compare so an attacker can't time-side-channel the
// expected token byte-by-byte. Buffers are padded to the same length to
// avoid leaking the secret length.
function timingSafeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  const aBuf = Buffer.alloc(max);
  const bBuf = Buffer.alloc(max);
  aBuf.write(a);
  bBuf.write(b);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < max; i++) {
    diff |= aBuf[i] ^ bBuf[i];
  }
  return diff === 0;
}

async function runHttp(mode: IntuneMode): Promise<void> {
  const { StreamableHTTPServerTransport } =
    await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const http = await import('node:http');

  const port = Number(process.env.PORT ?? 3000);
  // Default to 127.0.0.1. Operator must opt-in to a routable interface and
  // MUST set INTUNE_HTTP_AUTH_TOKEN if they do. We refuse to start otherwise:
  // an unauthenticated /mcp listener on a public interface would hand any
  // network neighbour the Graph app credentials.
  const host = (process.env.HOST ?? '127.0.0.1').trim();
  const authToken = (process.env.INTUNE_HTTP_AUTH_TOKEN ?? '').trim();
  const isLoopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';

  if (!isLoopback && !authToken) {
    console.error(
      `[intune-mcp] FATAL: HTTP transport is bound to ${host} but INTUNE_HTTP_AUTH_TOKEN is empty. Refusing to start an unauthenticated remote MCP endpoint. Set INTUNE_HTTP_AUTH_TOKEN to a long random secret, or bind HOST=127.0.0.1.`,
    );
    process.exit(1);
  }
  if (!authToken) {
    console.error(
      '[intune-mcp] WARNING: HTTP transport on loopback without auth token. Anything running on this host (including other local users) can call your Intune tools.',
    );
  }

  const server = buildServer({ mode });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  await server.connect(transport);

  const tools = filterToolsByMode(allTools, mode);
  const httpServer = http.createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end();
      return;
    }
    if (req.url === '/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true, mode, tools: tools.length }));
      return;
    }
    if (req.url.startsWith('/mcp')) {
      if (authToken) {
        const header = req.headers.authorization ?? '';
        const match = /^Bearer\s+(.+)$/i.exec(header);
        const presented = match?.[1]?.trim() ?? '';
        if (!presented || !timingSafeEqual(presented, authToken)) {
          res.statusCode = 401;
          res.setHeader('WWW-Authenticate', 'Bearer realm="intune-mcp"');
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }
      }
      void transport.handleRequest(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  httpServer.listen(port, host, () => {
    console.error(
      `[intune-mcp] HTTP transport listening on ${host}:${port} (mode=${mode}, ${tools.length}/${allTools.length} tools, auth: ${authToken ? 'bearer' : 'none'})`,
    );
  });
}

async function main(): Promise<void> {
  const mode = parseMode(process.env.INTUNE_MODE);
  const transport = (process.env.INTUNE_TRANSPORT ?? 'stdio').toLowerCase();
  if (transport === 'http') {
    await runHttp(mode);
    return;
  }
  await runStdio(mode);
}

main().catch((err) => {
  console.error('[intune-mcp] fatal:', err);
  process.exit(1);
});
