// OData parameter keys exposed to MCP clients. We deliberately strip the leading
// `$` because Claude's tool-use API rejects property keys that don't match
// `^[a-zA-Z0-9_.-]{1,64}$`. The leading `$` is re-attached when we build the
// outgoing Graph URL.
export const ODATA_KEYS = [
  'select',
  'filter',
  'expand',
  'top',
  'skip',
  'skiptoken',
  'orderby',
  'count',
  'search',
] as const;

export type ODataKey = (typeof ODATA_KEYS)[number];

export const ODATA_PROPERTIES: Record<ODataKey, { type: string; description: string }> = {
  select: {
    type: 'string',
    description: 'OData $select: comma-separated list of fields to return. Reduces payload size.',
  },
  filter: {
    type: 'string',
    description: 'OData $filter expression (e.g. "operatingSystem eq \'Windows\'").',
  },
  expand: {
    type: 'string',
    description: 'OData $expand: comma-separated navigation properties to expand.',
  },
  top: {
    type: 'string',
    description: 'OData $top: page size (1-999). Default Graph behaviour varies by entity.',
  },
  skip: { type: 'string', description: 'OData $skip: number of items to skip.' },
  skiptoken: {
    type: 'string',
    description:
      "OData $skiptoken from a previous page's @odata.nextLink. Used for cursor pagination.",
  },
  orderby: {
    type: 'string',
    description: 'OData $orderby: sort expression (e.g. "deviceName asc").',
  },
  count: { type: 'string', description: 'OData $count: set to "true" to include @odata.count.' },
  search: {
    type: 'string',
    description: 'OData $search: free-text search (where supported by the entity).',
  },
};

export function buildODataQuery(args: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const key of ODATA_KEYS) {
    const value = args[key];
    if (value !== undefined && value !== '') {
      // Re-attach the leading `$` for the Graph URL.
      params.set(`$${key}`, value);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// Property shared by every tool to route to a specific Intune tenant. Optional —
// resolved by resolveClient() at handler time. When INTUNE_CLIENTS is unset or
// has a single entry the agent can omit it.
export const CLIENT_PROPERTY = {
  client: {
    type: 'string',
    description:
      'Intune client key (one of the keys configured in INTUNE_CLIENTS). Optional when only one client is configured.',
  },
} as const;

export function odataProps(
  extra: Record<string, { type: string; description: string }> = {},
): Record<string, { type: string; description: string }> {
  return { ...CLIENT_PROPERTY, ...ODATA_PROPERTIES, ...extra };
}
