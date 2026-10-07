import { describe, expect, it } from 'vitest';
import { logSourceLabels, SYSTEM_SOURCE_LABEL } from './log-source-labels';

describe('logSourceLabels', () => {
  it('passes a device row through untouched', () => {
    expect(logSourceLabels({ name: 'Scrappy', organization: 'John' })).toEqual({
      deviceName: 'Scrappy',
      organization: 'John',
    });
  });

  // Fleet audit events carry the literal string "null", not null, in both fields.
  it('labels a system event and drops its "null" organization', () => {
    expect(logSourceLabels({ name: 'null', organization: 'null' })).toEqual({
      deviceName: SYSTEM_SOURCE_LABEL,
      organization: undefined,
    });
  });

  it('maps each field on its own', () => {
    expect(logSourceLabels({ name: 'null', organization: 'John' })).toEqual({
      deviceName: SYSTEM_SOURCE_LABEL,
      organization: 'John',
    });
    expect(logSourceLabels({ name: 'Scrappy', organization: 'null' })).toEqual({
      deviceName: 'Scrappy',
      organization: undefined,
    });
  });

  it('does not touch a real device that merely contains the word', () => {
    expect(logSourceLabels({ name: 'nullable-box', organization: 'Nulltown' }).deviceName).toBe('nullable-box');
    expect(logSourceLabels({ name: 'nullable-box', organization: 'Nulltown' }).organization).toBe('Nulltown');
  });
});
