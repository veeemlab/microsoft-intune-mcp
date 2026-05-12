import { describe, it, expect } from 'vitest';
import { buildODataQuery, odataProps } from '../src/query.js';

describe('buildODataQuery', () => {
  it('returns empty string when no OData params supplied', () => {
    expect(buildODataQuery({})).toBe('');
  });

  it('only includes the OData keys and re-attaches the $ prefix', () => {
    const qs = buildODataQuery({
      select: 'id,deviceName',
      top: '10',
      deviceId: 'irrelevant',
    } as Record<string, string>);
    expect(qs).toContain('%24select=id%2CdeviceName');
    expect(qs).toContain('%24top=10');
    expect(qs).not.toContain('deviceId');
  });

  it('skips empty values', () => {
    const qs = buildODataQuery({ select: '', top: '5' });
    expect(qs).toBe('?%24top=5');
  });

  it('does not pass through $-prefixed input keys (Claude API rejects those)', () => {
    const qs = buildODataQuery({
      $select: 'id',
      $top: '5',
    } as unknown as Record<string, string>);
    expect(qs).toBe('');
  });
});

describe('odataProps', () => {
  it('exposes plain (non-$) property keys so Claude API accepts the schema', () => {
    const props = odataProps();
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining(['select', 'filter', 'expand', 'top', 'skiptoken']),
    );
    expect(Object.keys(props)).not.toEqual(expect.arrayContaining(['$select', '$filter']));
  });

  it('merges extra props on top of the OData defaults', () => {
    const props = odataProps({ deviceId: { type: 'string', description: 'Device id.' } });
    expect(props.deviceId.description).toBe('Device id.');
    expect(props.select.description).toMatch(/comma-separated/);
  });
});
