import { describe, expect, it } from 'vitest';
import { presentationFor } from '../presentation-for';

const LABELS = { PRIMARY: 'Primary user', SHARED: 'Shared' } satisfies Record<'PRIMARY' | 'SHARED', string>;

describe('presentationFor', () => {
  it('answers a value the table knows', () => {
    expect(presentationFor(LABELS, 'SHARED')).toBe('Shared');
  });

  it('answers undefined for a value it does not know, or none', () => {
    expect(presentationFor(LABELS, 'NEW')).toBeUndefined();
    expect(presentationFor(LABELS, null)).toBeUndefined();
    expect(presentationFor(LABELS, undefined)).toBeUndefined();
  });

  it('does not answer with an inherited key', () => {
    expect(presentationFor(LABELS, 'toString')).toBeUndefined();
    expect(presentationFor(LABELS, 'constructor')).toBeUndefined();
    expect(presentationFor(LABELS, '__proto__')).toBeUndefined();
  });
});
