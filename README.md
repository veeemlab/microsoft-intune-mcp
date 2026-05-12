# Microsoft Intune MCP Server

[![Release](https://github.com/vmorgunov/microsoft-intune-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/vmorgunov/microsoft-intune-mcp/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/@veeemlab/microsoft-intune-mcp?color=blue&label=npm)](https://www.npmjs.com/package/@veeemlab/microsoft-intune-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@veeemlab/microsoft-intune-mcp?color=blue)](https://www.npmjs.com/package/@veeemlab/microsoft-intune-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Model Context Protocol (MCP) server for **Microsoft Intune** via Microsoft Graph. Read and write operations (incl. delete / wipe / retire), **multi-tenant MSP support**, **Copilot Studio compatible** (flat string schemas, no `$ref`, no `anyOf`, no nested objects).

## Why this server

Compared to similar projects, this one focuses on **just Intune** and adds a production-grade core:

- **Resilient Graph client** — OAuth2 client-credentials with token cache, singleton in-flight auth, 401 single retry, `Retry-After`-aware 429 retry, jittered exponential backoff on 5xx for safe methods only.
- **Read + write surface** — list/get tools plus device actions (sync, reboot, lock), management (rename, set category, set primary user), lifecycle (retire, wipe, delete) and bulk-delete. Every tool description is tagged `[read]`, `[write]`, `[write/reversible]`, or `[write/destructive]` so the agent can warn before destructive calls. Tokens and secrets are scrubbed from error text; oversize responses are truncated with hints.
- **Pagination as a first-class tool** — `fetch-next-page` accepts the `@odata.nextLink` returned from any list call, with a host allowlist to prevent SSRF.
- **OData on every list tool** — `$select`, `$filter`, `$expand`, `$top`, `$skip`, `$skiptoken`, `$orderby`, `$count`, `$search`.
- **Two transports** — stdio (default, for Claude Desktop / Copilot Studio / MetaMCP) and Streamable HTTP (for remote deployment).
- **Sovereign clouds supported** — set `GRAPH_BASE_URL` / `AZURE_AUTHORITY_HOST` for GCC High, DoD, or China.

## Prerequisites

- **Node.js 20+**
- A Microsoft Entra ID **app registration** with **application** (app-only) permissions on Microsoft Graph and admin consent granted.

### Minimum recommended Graph permissions

| Permission                                                | Purpose                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------- |
| `DeviceManagementManagedDevices.Read.All`                 | Read managed devices, detected apps, compliance/config states |
| `DeviceManagementManagedDevices.ReadWrite.All`            | Rename, set category, set primary user, delete, retire        |
| `DeviceManagementManagedDevices.PrivilegedOperations.All` | `wipe-device`, `reboot-device`, `remote-lock`, `sync-device`  |
| `DeviceManagementConfiguration.Read.All`                  | Compliance and configuration policies + assignments           |
| `DeviceManagementApps.Read.All`                           | Mobile apps, assignments, install status, MAM policies        |
| `DeviceManagementServiceConfig.Read.All`                  | Autopilot, enrollment configurations, tunnel, connectors      |
| `DeviceManagementRBAC.Read.All`                           | Assignment filters                                            |
| `User.Read.All`                                           | List devices by user, set primary user                        |

> Grant only what you need. If you only use read tools, skip `ReadWrite.All` and `PrivilegedOperations.All`. If you skip device action permissions, write tools that need them will return `403 Forbidden`; read tools are unaffected.

## Installation

There are three ways to use this server.

### 1. Run via `npx` (recommended)

No install needed — `npx` fetches the latest published version every time:

```bash
npx -y @veeemlab/microsoft-intune-mcp
```

### 2. Run from GitHub (bleeding edge)

```bash
npx -y github:vmorgunov/microsoft-intune-mcp
```

### 3. Install globally

```bash
npm install -g @veeemlab/microsoft-intune-mcp
intune-mcp
```

## Claude Desktop configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "intune": {
      "command": "npx",
      "args": ["-y", "@veeemlab/microsoft-intune-mcp"],
      "env": {
        "AZURE_TENANT_ID": "your-tenant-id",
        "AZURE_CLIENT_ID": "your-app-registration-client-id",
        "AZURE_CLIENT_SECRET": "your-app-registration-client-secret"
      }
    }
  }
}
```

## MetaMCP / Copilot Studio

```
Command:   npx
Arguments: -y @veeemlab/microsoft-intune-mcp
Env:       AZURE_TENANT_ID=..., AZURE_CLIENT_ID=..., AZURE_CLIENT_SECRET=...
```

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx -y @veeemlab/microsoft-intune-mcp
```

## Environment variables

| Variable                    | Required            | Default                             | Description                                                                  |
| --------------------------- | ------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`           | Yes                 | —                                   | App registration client id (shared across all tenants in multi-tenant mode). |
| `AZURE_CLIENT_SECRET`       | Yes                 | —                                   | App registration client secret.                                              |
| `AZURE_TENANT_ID`           | Yes (single-tenant) | —                                   | Entra ID tenant id. Ignored when `INTUNE_CLIENTS` is set.                    |
| `INTUNE_CLIENTS`            | Yes (multi-tenant)  | —                                   | Comma-separated `key:tenantId` pairs. See "Multi-tenant" below.              |
| `AZURE_AUTHORITY_HOST`      | No                  | `https://login.microsoftonline.com` | Identity endpoint. Override for sovereign clouds.                            |
| `GRAPH_BASE_URL`            | No                  | `https://graph.microsoft.com`       | Graph endpoint. Override for sovereign clouds.                               |
| `GRAPH_API_VERSION`         | No                  | `v1.0`                              | Set to `beta` for preview endpoints.                                         |
| `INTUNE_TRANSPORT`          | No                  | `stdio`                             | `stdio` or `http`.                                                           |
| `PORT`                      | No                  | `3000`                              | Port for the HTTP transport.                                                 |
| `INTUNE_MAX_RESPONSE_BYTES` | No                  | `200000`                            | Hard cap before a tool response is truncated with a hint.                    |

## Multi-tenant (MSP scenario)

One server instance can manage Intune across multiple customer tenants. The typical MSP path:

1. **Make your app registration multi-tenant** in Entra → App registrations → your app → Authentication → "Accounts in any organizational directory".
2. **Each customer's Global Admin grants consent** in their tenant by visiting:
   ```
   https://login.microsoftonline.com/{customer-tenant-id}/adminconsent?client_id={your-app-client-id}
   ```
   This creates a service principal of your app in the customer tenant with the permissions you declared.
3. **Configure `INTUNE_CLIENTS`** with one entry per customer:
   ```
   INTUNE_CLIENTS=myorg:<your-tenant-id>,acme:<customer-A-tenant-id>,contoso:<customer-B-tenant-id>
   AZURE_CLIENT_ID=<your-app-client-id>
   AZURE_CLIENT_SECRET=<your-app-secret>
   ```
   `AZURE_TENANT_ID` becomes redundant and is ignored when `INTUNE_CLIENTS` is set.
4. **Tools accept a `client` argument** matching one of the configured keys:
   ```
   list-managed-devices(client="acme", top="10", select="deviceName,operatingSystem")
   ```
   Discover available keys with the `list-intune-clients` tool. When only one client is configured, `client` is optional. When multiple are configured and `client` is omitted, the call fails fast with the list of available keys.

Each tenant has an independent token cache, so a 401 against tenant A never invalidates tenant B's session. The `client` key must match `^[a-zA-Z0-9_.-]{1,64}$` (Claude tool-use API constraint).

> **MCP Resources note:** static / template resources (`intune://managed-devices/...`) always use the default client. With multi-tenant config there is no default — use tools, which accept `client`, instead.

## Tools (47)

Every tool accepts an optional `client` parameter (see [Multi-tenant](#multi-tenant-msp-scenario)). List-style tools accept OData parameters (`select`, `filter`, `expand`, `top`, `skip`, `skiptoken`, `orderby`, `count`, `search`) which are mapped to their `$`-prefixed Graph counterparts at request time. Risk markers: `[read]`, `[write]`, `[write/reversible]`, `[write/destructive]`.

### Clients (1)

| Tool                  | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `list-intune-clients` | Inspect configured Intune tenants (keys you can pass as `client`). |

### Device actions (7) — write

| Tool                       | Description                                                                       |
| -------------------------- | --------------------------------------------------------------------------------- |
| `sync-device`              | Force the device to check in immediately.                                         |
| `reboot-device`            | Reboot the device now (reversible).                                               |
| `remote-lock`              | Lock the device screen remotely (reversible).                                     |
| `set-device-name`          | Rename the device.                                                                |
| `send-custom-notification` | Push a notification to the Company Portal app.                                    |
| `retire-device`            | Destructive. Unenroll and remove corp data. Personal data on BYOD stays.          |
| `wipe-device`              | Destructive. Factory reset (Windows `keepUserData` / `keepEnrollmentData` flags). |

### Device management (4) — write

| Tool                          | Description                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `delete-managed-device`       | Destructive. Remove the device record from Intune (does not wipe the endpoint).   |
| `bulk-delete-managed-devices` | Destructive. Delete up to 50 devices in one call. Returns per-item success/error. |
| `set-device-category`         | Set the Intune device category (display name).                                    |
| `set-primary-user`            | Assign or change the primary user of a device.                                    |

### Managed devices (7)

| Tool                             | Description                                          |
| -------------------------------- | ---------------------------------------------------- |
| `list-managed-devices`           | List all Intune managed devices.                     |
| `get-managed-device`             | Get a single managed device by id.                   |
| `list-user-managed-devices`      | List devices belonging to a specific Entra ID user.  |
| `list-device-detected-apps`      | List apps detected on a specific device.             |
| `list-detected-apps`             | List apps detected across the tenant.                |
| `get-device-compliance-state`    | Compliance policy evaluation state for a device.     |
| `get-device-configuration-state` | Configuration profile evaluation state for a device. |

### Compliance (3)

| Tool                                 | Description                               |
| ------------------------------------ | ----------------------------------------- |
| `list-compliance-policies`           | List device compliance policies.          |
| `get-compliance-policy`              | Get a single compliance policy.           |
| `list-compliance-policy-assignments` | List assignments for a compliance policy. |

### Configuration (5)

| Tool                                    | Description                                     |
| --------------------------------------- | ----------------------------------------------- |
| `list-device-configurations`            | Classic `deviceConfigurations` profiles.        |
| `get-device-configuration`              | Get a single classic configuration profile.     |
| `list-configuration-policies`           | Settings Catalog `configurationPolicies`.       |
| `get-configuration-policy`              | Get a single Settings Catalog policy.           |
| `list-configuration-policy-assignments` | List assignments for a Settings Catalog policy. |

### Apps (4)

| Tool                                  | Description                              |
| ------------------------------------- | ---------------------------------------- |
| `list-mobile-apps`                    | List Intune-managed mobile apps.         |
| `get-mobile-app`                      | Get a single mobile app.                 |
| `list-mobile-app-assignments`         | List target groups + intents for an app. |
| `get-mobile-app-installation-summary` | Install/failure summary for an app.      |

### App protection (3)

| Tool                                       | Description                          |
| ------------------------------------------ | ------------------------------------ |
| `list-ios-app-protection-policies`         | iOS MAM policies.                    |
| `list-android-app-protection-policies`     | Android MAM policies.                |
| `list-targeted-managed-app-configurations` | Targeted managed app configurations. |

### Enrollment & Autopilot (3)

| Tool                                 | Description                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `list-enrollment-configurations`     | All device enrollment configurations (ESP, platform restrictions, notifications). |
| `list-autopilot-devices`             | Windows Autopilot device identities.                                              |
| `list-autopilot-deployment-profiles` | Windows Autopilot deployment profiles.                                            |

### Scripts (3)

| Tool                             | Description                        |
| -------------------------------- | ---------------------------------- |
| `list-device-management-scripts` | List PowerShell scripts (Windows). |
| `get-device-management-script`   | Get a single PowerShell script.    |
| `list-device-shell-scripts`      | List shell scripts (macOS).        |

### Assignment filters (2)

| Tool                      | Description                     |
| ------------------------- | ------------------------------- |
| `list-assignment-filters` | List assignment filters.        |
| `get-assignment-filter`   | Get a single assignment filter. |

### Connectors (3)

| Tool                   | Description                         |
| ---------------------- | ----------------------------------- |
| `list-tunnel-sites`    | Microsoft Tunnel sites.             |
| `list-tunnel-servers`  | Microsoft Tunnel servers in a site. |
| `list-ndes-connectors` | NDES (SCEP certificate) connectors. |

### Audit (1)

| Tool                | Description                                         |
| ------------------- | --------------------------------------------------- |
| `list-audit-events` | Intune audit events (use `$filter` for date scope). |

### Pagination (1)

| Tool              | Description                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `fetch-next-page` | Fetch the next page from any prior `@odata.nextLink`. Graph-host allowlisted (defence in depth). |

## Resources

| URI                                          | Description                       |
| -------------------------------------------- | --------------------------------- |
| `intune://managed-devices`                   | All managed devices.              |
| `intune://managed-devices/{deviceId}`        | A single managed device.          |
| `intune://compliance-policies`               | All compliance policies.          |
| `intune://compliance-policies/{policyId}`    | A single compliance policy.       |
| `intune://configuration-policies`            | All Settings Catalog policies.    |
| `intune://configuration-policies/{policyId}` | A single Settings Catalog policy. |
| `intune://mobile-apps`                       | All mobile apps.                  |
| `intune://mobile-apps/{appId}`               | A single mobile app.              |

## Local development

```bash
git clone https://github.com/vmorgunov/microsoft-intune-mcp.git
cd microsoft-intune-mcp
npm install
npm run build
npm start
```

### Quality checks

```bash
npm run lint           # ESLint
npm run lint:fix       # auto-fix lint issues
npm run format         # Prettier write
npm run format:check   # Prettier check (CI-friendly)
npm test               # Vitest one-shot
npm run test:watch     # Vitest watch mode
npm run test:coverage  # Vitest with v8 coverage
```

### Run with Streamable HTTP

```bash
INTUNE_TRANSPORT=http PORT=3000 npm start
```

Health check: `GET http://localhost:3000/health` → `{ "ok": true, "tools": 35 }`.

## Troubleshooting

**`Auth failed (401)` / `AADSTS70011`** — admin consent was not granted, or the requested scope does not match a configured permission. Verify the app registration has the Graph application permissions listed above and that an admin has consented.

**`Graph API error (403 Forbidden)`** — the app authenticated but the specific Graph endpoint requires a permission you have not granted. Add the missing application permission and re-consent.

**`Response exceeded INTUNE_MAX_RESPONSE_BYTES`** — Graph returned more than ~200KB. Narrow with `$select`, `$filter` or `$top`, or follow `@odata.nextLink` with `fetch-next-page`.

**Throttling (`429`)** — the server retries automatically using the `Retry-After` header (up to 3 times). Persistent throttling means the agent is calling too aggressively; consider larger `$select` payloads instead of more requests.

## License

MIT
