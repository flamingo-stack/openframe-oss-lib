// Pins the tool registry for the directory tenants: the gateway's identifiers resolve to a tool
// with a label (not the raw enum), the usual alias shapes resolve too, and an unknown tool still
// falls back to SYSTEM rather than throwing.

import { describe, expect, it } from 'vitest';
import { normalizeToolType, normalizeToolTypeWithFallback, toToolLabel } from '../utils/tool-utils';

describe('tool-utils: directory tenants', () => {
  it('resolves the gateway identifiers to their tools', () => {
    expect(normalizeToolType('GOOGLE_WORKSPACE')).toBe('GOOGLE_WORKSPACE');
    expect(normalizeToolType('MICROSOFT_365')).toBe('MICROSOFT_365');
  });

  it('labels them in plain words', () => {
    expect(toToolLabel('GOOGLE_WORKSPACE')).toBe('Google Workspace');
    expect(toToolLabel('MICROSOFT_365')).toBe('Microsoft 365');
  });

  it('accepts the usual alias shapes', () => {
    for (const alias of ['google-workspace', 'googleworkspace', 'Google_Workspace']) {
      expect(normalizeToolType(alias), alias).toBe('GOOGLE_WORKSPACE');
    }
    for (const alias of ['microsoft-365', 'microsoft365', 'm365', 'M365']) {
      expect(normalizeToolType(alias), alias).toBe('MICROSOFT_365');
    }
  });

  it('still falls back to SYSTEM for a tool it does not know', () => {
    expect(normalizeToolType('SOMETHING_ELSE')).toBeUndefined();
    expect(normalizeToolTypeWithFallback('SOMETHING_ELSE')).toBe('SYSTEM');
    expect(toToolLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
  });
});
