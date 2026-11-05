import { describe, expect, it } from 'vitest';
import { tagVariantForBadgeColor } from '../../components/ui/tag';
import type { DesignDocCompletion } from '../../types/design-doc';
import {
  designDocStatusDisplay,
  formatCompletionLabel,
  formatCompletionLabelWithBlockers,
} from '../design-doc-readiness';

const completion = (over: Partial<DesignDocCompletion> = {}): DesignDocCompletion => ({
  total: 4,
  completed: 2,
  blocked: 0,
  openBlocking: 0,
  isComplete: false,
  waitingOn: [],
  ...over,
});

const shipped = { value: 'shipped', label: 'Shipped', color_scheme: 'success' };
const inActiveWork = { value: 'in_progress', label: 'In active work', color_scheme: 'pinkSoft' };

describe('designDocStatusDisplay', () => {
  it('shows the status a person set over the readiness', () => {
    expect(designDocStatusDisplay({ lifecycle: shipped, readiness: inActiveWork })).toBe(shipped);
  });

  it('shows the readiness the hub resolved when no status is set', () => {
    expect(designDocStatusDisplay({ lifecycle: null, readiness: inActiveWork })).toBe(inActiveWork);
  });

  it('shows nothing when the hub resolved neither (an older hub)', () => {
    expect(designDocStatusDisplay({ lifecycle: null })).toBeNull();
  });
});

describe('tagVariantForBadgeColor', () => {
  it('keeps the semantic tones and reads every other colour as grey', () => {
    expect(tagVariantForBadgeColor('success')).toBe('success');
    expect(tagVariantForBadgeColor('warning')).toBe('warning');
    expect(tagVariantForBadgeColor('error')).toBe('error');
    expect(tagVariantForBadgeColor('pinkSoft')).toBe('grey');
    expect(tagVariantForBadgeColor(null)).toBe('grey');
  });
});

describe('the sign-off caption', () => {
  it('is counts only, with the blocking veto when one is open', () => {
    expect(formatCompletionLabel(completion())).toBe('2/4 signed off');
    expect(formatCompletionLabelWithBlockers(completion({ isComplete: true, completed: 4 }))).toBe('4/4 signed off');
    expect(formatCompletionLabelWithBlockers(completion({ openBlocking: 1 }))).toBe('2/4 signed off · 1 blocking');
  });
});
