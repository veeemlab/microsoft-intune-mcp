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

async function runHttp(mode: IntuneMode): Promise<void> {
  const { StreamableHTTPServerTransport } =
    await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const http = await import('node:http');

  const server = buildServer({ mode });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  await server.connect(transport);

  const tools = filterToolsByMode(allTools, mode);
  const port = Number(process.env.PORT ?? 3000);
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
      void transport.handleRequest(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  httpServer.listen(port, () => {
    console.error(
      `[intune-mcp] HTTP transport listening on :${port} (mode=${mode}, ${tools.length}/${allTools.length} tools)`,
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
