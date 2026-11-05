import { describe, expect, it } from 'vitest';
import type { DesignDocCompletion } from '../../types/design-doc';
import {
  DESIGN_DOC_READINESS_DISPLAY,
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

describe('designDocStatusDisplay', () => {
  it('shows the status a person set, whatever the sign-offs say', () => {
    const shipped = { value: 'shipped', label: 'Shipped', color_scheme: 'success' };
    expect(designDocStatusDisplay({ completion: completion({ isComplete: true }), lifecycle: shipped })).toEqual({
      label: 'Shipped',
      scheme: 'success',
    });
  });

  it('shows readiness when no status is set', () => {
    expect(designDocStatusDisplay({ completion: completion({ isComplete: true }), lifecycle: null })).toEqual(
      DESIGN_DOC_READINESS_DISPLAY.ready,
    );
    expect(designDocStatusDisplay({ completion: completion({ completed: 0 }), lifecycle: undefined })).toEqual(
      DESIGN_DOC_READINESS_DISPLAY.not_ready,
    );
  });

  it('calls a doc with at least one sign-off in active work', () => {
    expect(designDocStatusDisplay({ completion: completion({ completed: 1 }), lifecycle: null })).toEqual(
      DESIGN_DOC_READINESS_DISPLAY.in_progress,
    );
    expect(designDocStatusDisplay({ completion: completion({ completed: 0 }), lifecycle: null })).toEqual(
      DESIGN_DOC_READINESS_DISPLAY.not_ready,
    );
  });

  it('calls a not-ready doc blocked while a section asks for changes or a blocking comment is open', () => {
    expect(designDocStatusDisplay({ completion: completion({ blocked: 1 }), lifecycle: null }).label).toBe('Blocked');
    expect(designDocStatusDisplay({ completion: completion({ openBlocking: 2 }), lifecycle: null }).label).toBe(
      'Blocked',
    );
  });

  it('never draws Ready to build in the green that Shipped uses', () => {
    expect(DESIGN_DOC_READINESS_DISPLAY.ready.scheme).not.toBe('success');
  });
});

describe('the sign-off caption', () => {
  it('is counts only, with the blocking veto when one is open', () => {
    expect(formatCompletionLabel(completion())).toBe('2/4 signed off');
    expect(formatCompletionLabelWithBlockers(completion({ isComplete: true, completed: 4 }))).toBe('4/4 signed off');
    expect(formatCompletionLabelWithBlockers(completion({ openBlocking: 1 }))).toBe('2/4 signed off · 1 blocking');
  });
});
