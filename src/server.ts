import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { allTools, filterToolsByMode, type IntuneMode } from './tools/index.js';
import { staticResources, resourceTemplates, handleResource } from './resources.js';
import { errorResult } from './format.js';

export interface BuildServerOptions {
  name?: string;
  version?: string;
  mode?: IntuneMode;
}

// Flat string schemas (Copilot Studio compatible). All params are strings even
// when the underlying value is a number; Graph happily accepts string-encoded
// OData params. This is the same tradeoff as datto-rmm-mcp.
function buildShape(tool: (typeof allTools)[number]): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  const props = tool.inputSchema.properties;
  const required = tool.inputSchema.required ?? [];

  for (const [key, prop] of Object.entries(props)) {
    let zodType: z.ZodTypeAny = z.string().describe(prop.description);
    if (!required.includes(key)) zodType = zodType.optional();
    shape[key] = zodType;
  }
  return shape;
}

export function buildServer(opts: BuildServerOptions = {}): McpServer {
  const server = new McpServer({
    name: opts.name ?? 'intune-mcp',
    version: opts.version ?? '0.1.0',
  });

  const tools = filterToolsByMode(allTools, opts.mode ?? 'read');

  for (const tool of tools) {
    server.tool(tool.name, tool.description, buildShape(tool), async (args) => {
      try {
        const stringArgs: Record<string, string> = {};
        for (const [k, v] of Object.entries(args)) {
          if (v !== undefined && v !== null) stringArgs[k] = String(v);
        }
        const result = await tool.handler(stringArgs);
        return { ...result } as {
          content: Array<{ type: 'text'; text: string }>;
          isError?: boolean;
          [key: string]: unknown;
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult(message) as {
          content: Array<{ type: 'text'; text: string }>;
          isError: boolean;
          [key: string]: unknown;
        };
      }
    });
  }

  for (const res of staticResources) {
    server.resource(
      res.name,
      res.uri,
      { description: res.description, mimeType: res.mimeType },
      async (uri) => {
        const text = await handleResource(uri.href);
        return { contents: [{ uri: uri.href, mimeType: res.mimeType, text }] };
      },
    );
  }

  for (const tpl of resourceTemplates) {
    server.resource(
      tpl.name,
      tpl.uriTemplate,
      { description: tpl.description, mimeType: tpl.mimeType },
      async (uri) => {
        const text = await handleResource(uri.href);
        return { contents: [{ uri: uri.href, mimeType: tpl.mimeType, text }] };
      },
    );
  }

  return server;
}
