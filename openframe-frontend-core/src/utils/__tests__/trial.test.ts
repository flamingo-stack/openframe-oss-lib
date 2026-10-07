import { describe, expect, it } from 'vitest';
import { TRIAL_DAYS, TRIAL_LABELS } from '../trial';

describe('trial facts', () => {
  it('states the trial length from the one constant', () => {
    expect(TRIAL_LABELS.length).toBe(`${TRIAL_DAYS} day free trial`);
  });
});
