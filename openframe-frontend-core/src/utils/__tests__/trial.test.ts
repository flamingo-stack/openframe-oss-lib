import { describe, expect, it } from 'vitest';
import { TRIAL_TERMS, trialLabels, trialLengthLabel } from '../trial';

describe('trial wording', () => {
  it('states the length from the number it is given', () => {
    expect(trialLengthLabel(30)).toBe('30 day free trial');
    expect(trialLabels(30).length).toBe('30 day free trial');
  });

  it("leaves the length out when the plan's length is not known", () => {
    expect(trialLabels(null).length).toBeNull();
    expect(trialLabels(undefined).length).toBeNull();
    expect(trialLabels(null).noCard).toBe(TRIAL_TERMS.noCard);
  });
});
