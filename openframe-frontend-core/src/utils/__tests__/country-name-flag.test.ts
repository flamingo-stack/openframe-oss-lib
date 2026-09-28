import { describe, expect, it } from 'vitest';
import { getCountryByName, getFlagFromCountryName } from '../country-phone-utils';

describe('country name → flag', () => {
  it('resolves display names and common aliases, case-insensitively', () => {
    expect(getFlagFromCountryName('United States')).toBe('🇺🇸');
    expect(getFlagFromCountryName('usa')).toBe('🇺🇸');
    expect(getFlagFromCountryName('UK')).toBe('🇬🇧');
    expect(getCountryByName('germany')?.code).toBe('DE');
  });

  it('answers undefined for an unknown or empty name', () => {
    expect(getFlagFromCountryName('Atlantis')).toBeUndefined();
    expect(getFlagFromCountryName('')).toBeUndefined();
  });
});
