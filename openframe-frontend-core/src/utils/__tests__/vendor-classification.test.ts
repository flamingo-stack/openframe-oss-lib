import { describe, expect, it } from 'vitest';
import { formatClassification } from '../format';
import {
  VENDOR_CLASSIFICATION_COPY,
  compareVendorClassifications,
  isOpenFrameClassification,
  vendorClassificationCopy,
  vendorClassificationGroup,
} from '../vendor-classification';

describe('vendor classifications', () => {
  it('a value the server sends with no enrichment still has a label', () => {
    expect(vendorClassificationCopy('some_new_value')).toBeUndefined();
    expect(vendorClassificationGroup('some_new_value')).toBeUndefined();
    expect(formatClassification('some_new_value')).toBe('Some New Value');
  });

  it('enriched values carry a curated label and group', () => {
    expect(formatClassification('source_available')).toBe('Source-available');
    expect(formatClassification('end_of_life')).toBe('End of life');
    expect(formatClassification('end_of_support')).toBe('End of support');
    expect(formatClassification('unmaintained')).toBe('Unmaintained');
    expect(formatClassification('openframe_selected')).toBe('OpenFrame Selected');
    expect(vendorClassificationGroup('source_available')).toBe('license');
    expect(vendorClassificationGroup('end_of_life')).toBe('lifecycle');
    expect(vendorClassificationGroup('openframe_shipped')).toBe('openframe');
  });

  it('only OpenFrame values are drawn with the OpenFrame mark, and each has its word', () => {
    expect(isOpenFrameClassification('openframe_connect')).toBe(true);
    expect(isOpenFrameClassification('open_source')).toBe(false);
    expect(isOpenFrameClassification(undefined)).toBe(false);
    for (const [value, copy] of Object.entries(VENDOR_CLASSIFICATION_COPY)) {
      expect(Boolean(copy.word)).toBe(copy.group === 'openframe');
      expect(isOpenFrameClassification(value)).toBe(copy.group === 'openframe');
    }
  });

  it('does not treat inherited object keys as enriched values', () => {
    expect(vendorClassificationCopy('toString')).toBeUndefined();
    expect(vendorClassificationCopy('__proto__')).toBeUndefined();
  });

  it('orders a filter list: OpenFrame Selected, Connect, Shipped, then license, lifecycle, then the rest', () => {
    const fromServer = [
      'unmaintained',
      'zzz_other',
      'commercial',
      'openframe_shipped',
      'aaa_other',
      'open_source',
      'openframe_connect',
      'end_of_life',
      'openframe_selected',
      'source_available',
    ];
    expect([...fromServer].sort(compareVendorClassifications)).toEqual([
      'openframe_selected',
      'openframe_connect',
      'openframe_shipped',
      'open_source',
      'source_available',
      'commercial',
      'end_of_life',
      'unmaintained',
      'aaa_other',
      'zzz_other',
    ]);
  });
});
