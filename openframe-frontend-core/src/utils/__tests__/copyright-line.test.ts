import { describe, expect, it } from 'vitest';
import { copyrightLine } from '../copyright-line';

describe('copyrightLine', () => {
  it('does not double the period of a legal name that ends in one', () => {
    expect(copyrightLine('Flamingo AI, Inc.', 2026)).toBe('© 2026 Flamingo AI, Inc. All rights reserved.');
  });

  it('closes a legal name without a period', () => {
    expect(copyrightLine('Flamingo', 2026)).toBe('© 2026 Flamingo. All rights reserved.');
  });
});
