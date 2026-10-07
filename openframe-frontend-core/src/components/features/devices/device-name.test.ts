import { describe, expect, it } from 'vitest';
import { getDeviceName, matchesDeviceName } from './device-name';

describe('getDeviceName', () => {
  it('prefers the user-defined nickname over both agent-reported names', () => {
    expect(getDeviceName({ nickname: 'Scrappy', displayName: 'Marketing Laptop', hostname: 'Mac' })).toBe('Scrappy');
  });

  it('falls back to displayName when no nickname is set', () => {
    expect(getDeviceName({ nickname: null, displayName: 'Marketing Laptop', hostname: 'Mac' })).toBe(
      'Marketing Laptop',
    );
    expect(getDeviceName({ nickname: undefined, displayName: 'Marketing Laptop', hostname: 'Mac' })).toBe(
      'Marketing Laptop',
    );
  });

  it('falls back to hostname when neither user-defined nor agent display name is set', () => {
    expect(getDeviceName({ nickname: null, displayName: null, hostname: 'Mac' })).toBe('Mac');
    expect(getDeviceName({ nickname: undefined, hostname: 'Mac' })).toBe('Mac');
  });

  // The backend returns an absent nickname as null, but Pinot's schema default
  // for the logs column is an empty string, both have to fall through rather
  // than render a blank cell.
  it('treats an empty string as absent and falls through to the next name', () => {
    expect(getDeviceName({ nickname: '', displayName: 'Marketing Laptop', hostname: 'Mac' })).toBe('Marketing Laptop');
    expect(getDeviceName({ nickname: '', displayName: '', hostname: 'Mac' })).toBe('Mac');
  });

  // Log events carry only hostname + nickname, there is no displayName on
  // LogEvent/LogDetails, so the caller passes a two-field object.
  it('resolves an object that omits displayName entirely', () => {
    expect(getDeviceName({ nickname: 'Scrappy', hostname: 'Mac' })).toBe('Scrappy');
    expect(getDeviceName({ nickname: undefined, hostname: 'Mac' })).toBe('Mac');
  });

  it('returns an empty string when the device carries no name at all', () => {
    expect(getDeviceName({ nickname: undefined })).toBe('');
    expect(getDeviceName({ nickname: null, displayName: null, hostname: null })).toBe('');
    expect(getDeviceName({ nickname: '', displayName: '', hostname: '' })).toBe('');
  });

  // The contract itself: a source that stays silent about its nickname does not
  // compile, so a query that forgot to select the field is caught by tsc rather
  // than by someone noticing a hostname where a nickname should be.
  it('rejects a source that omits the nickname key at the type level', () => {
    // @ts-expect-error nickname is a required key of DeviceNameSource
    expect(getDeviceName({ displayName: 'Marketing Laptop', hostname: 'Mac' })).toBe('Marketing Laptop');
    // @ts-expect-error nickname is a required key of DeviceNameSource
    expect(matchesDeviceName({ hostname: 'Mac' }, 'mac')).toBe(true);
  });

  // Callers render before the device resolves, so a missing device must not
  // throw, they append their own fallback to the empty string.
  it('returns an empty string for a missing device', () => {
    expect(getDeviceName(null)).toBe('');
    expect(getDeviceName(undefined)).toBe('');
    expect(getDeviceName()).toBe('');
  });
});

describe('matchesDeviceName', () => {
  // The device from the ticket: renamed, so its rendered name and its hostname differ.
  const named = { nickname: 'Reception iMac', displayName: null, hostname: 'DESKTOP-123' };
  const unnamed = { nickname: null, displayName: null, hostname: 'DESKTOP-123' };

  it('finds a device by the name it renders under', () => {
    expect(matchesDeviceName(named, 'Reception')).toBe(true);
    expect(matchesDeviceName(named, 'iMac')).toBe(true);
  });

  // Hostname is a match even once a nickname exists, the server's search
  // behaves the same, and admins know devices by hostname from other tools.
  it('still finds a renamed device by its hostname', () => {
    expect(matchesDeviceName(named, 'DESKTOP-123')).toBe(true);
    expect(matchesDeviceName(named, 'desktop')).toBe(true);
  });

  it('finds an unnamed device by its hostname', () => {
    expect(matchesDeviceName(unnamed, 'DESKTOP')).toBe(true);
  });

  it('is a case-insensitive substring match, like the server', () => {
    expect(matchesDeviceName(named, 'RECEPTION')).toBe(true);
    expect(matchesDeviceName(named, 'ception im')).toBe(true);
    expect(matchesDeviceName(named, 'Reception  iMac')).toBe(false);
  });

  it('does not match a term that is in neither name', () => {
    expect(matchesDeviceName(named, 'Scrappy')).toBe(false);
    expect(matchesDeviceName(unnamed, 'Reception')).toBe(false);
  });

  it('ignores surrounding whitespace and treats a blank search as match-all', () => {
    expect(matchesDeviceName(named, '  iMac ')).toBe(true);
    expect(matchesDeviceName(named, '')).toBe(true);
    expect(matchesDeviceName(named, '   ')).toBe(true);
    expect(matchesDeviceName(named)).toBe(true);
  });

  it('never matches a non-blank term against a missing device', () => {
    expect(matchesDeviceName(null, 'x')).toBe(false);
    expect(matchesDeviceName(undefined, 'x')).toBe(false);
    expect(matchesDeviceName({ nickname: undefined }, 'x')).toBe(false);
  });
});
