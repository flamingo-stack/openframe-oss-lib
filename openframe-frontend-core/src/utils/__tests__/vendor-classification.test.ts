import { describe, expect, it } from 'vitest';
import { formatClassification } from '../format';
import {
  GENERAL_CLASSIFICATIONS,
  OPENFRAME_CLASSIFICATIONS,
  VENDOR_CLASSIFICATIONS,
  isVendorClassification,
  vendorClassificationGroup,
  vendorClassificationLabel,
} from '../vendor-classification';

describe('vendor classifications', () => {
  it('every value has copy, in exactly one table', () => {
    for (const value of VENDOR_CLASSIFICATIONS) {
      const inGeneral = Object.prototype.hasOwnProperty.call(GENERAL_CLASSIFICATIONS, value);
      const inOpenFrame = Object.prototype.hasOwnProperty.call(OPENFRAME_CLASSIFICATIONS, value);
      expect(inGeneral !== inOpenFrame).toBe(true);
    }
    expect(Object.keys(GENERAL_CLASSIFICATIONS).length + Object.keys(OPENFRAME_CLASSIFICATIONS).length).toBe(
      VENDOR_CLASSIFICATIONS.length,
    );
  });

  it('groups license, lifecycle and OpenFrame values', () => {
    expect(vendorClassificationGroup('open_source')).toBe('license');
    expect(vendorClassificationGroup('source_available')).toBe('license');
    expect(vendorClassificationGroup('commercial')).toBe('license');
    expect(vendorClassificationGroup('end_of_life')).toBe('lifecycle');
    expect(vendorClassificationGroup('end_of_support')).toBe('lifecycle');
    expect(vendorClassificationGroup('unmaintained')).toBe('lifecycle');
    expect(vendorClassificationGroup('openframe_selected')).toBe('openframe');
  });

  it('the lifecycle and source-available values are filterable classifications', () => {
    for (const value of ['source_available', 'end_of_life', 'end_of_support', 'unmaintained']) {
      expect(isVendorClassification(value)).toBe(true);
    }
    expect(isVendorClassification('favorites')).toBe(false);
  });

  it('labels a filter from the one vocabulary, and title-cases an unknown value', () => {
    expect(formatClassification('source_available')).toBe('Source-available');
    expect(formatClassification('end_of_life')).toBe('End of life');
    expect(formatClassification('end_of_support')).toBe('End of support');
    expect(formatClassification('unmaintained')).toBe('Unmaintained');
    expect(formatClassification('openframe_selected')).toBe('OpenFrame Selected');
    expect(vendorClassificationLabel('not_a_value')).toBeNull();
    expect(formatClassification('not_a_value')).toBe('Not A Value');
  });
});
