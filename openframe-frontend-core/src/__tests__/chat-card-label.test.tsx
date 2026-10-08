import { describe, expect, it } from 'vitest';
import { chatCardLabel } from '../components/chat/entity-cards/dispatch';
import {
  TRUST_CENTER_FIXTURE_FAQ,
  makeTrustCenterData,
} from '../components/help-center-pages/__fixtures__/trust-center';
import { TRUST_CENTER_API_PATH, TRUST_CENTER_CARD_ID } from '../types/trust-center';
import { extractCardItems, extractItemId, extractItems } from '../utils/extract-items';
import { buildListUrl } from '../utils/list-url';
import { getSourceLabel, SOURCE_ICON_NAMES, DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID } from '../utils/source-icons';

describe('chatCardLabel', () => {
  it('returns the registered label for a document type', () => {
    expect(chatCardLabel('design_doc')).toBe('Design doc');
    expect(chatCardLabel('prospect_call')).toBe('Prospect call');
  });

  it('returns undefined for an unregistered type', () => {
    expect(chatCardLabel('not_a_real_type')).toBeUndefined();
  });
});

describe('prospect_call source wiring', () => {
  it('maps the document type to its table id, label, icon and card route', () => {
    expect(DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID.prospect_call).toBe('prospect-calls');
    expect(getSourceLabel('prospect-calls')).toBe('Prospect calls');
    expect(SOURCE_ICON_NAMES['prospect-calls']).toBe('phone');
    expect(buildListUrl('prospect_call', ['1', '2'])).toBe('/api/prospect-calls?ids=1,2');
  });
});

describe('trust_center source wiring', () => {
  it('maps the document type to its table id, label, icon and route', () => {
    expect(chatCardLabel('trust_center')).toBe('Trust center');
    expect(DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID.trust_center).toBe('trust-center');
    expect(getSourceLabel('trust-center')).toBe('Trust Center');
    expect(SOURCE_ICON_NAMES['trust-center']).toBe('shield');
    expect(buildListUrl('trust_center', [TRUST_CENTER_CARD_ID], '/content')).toBe(
      `/content${TRUST_CENTER_API_PATH}?ids=main`,
    );
  });

  it('matches the single-record object payload back to the fixed card id', () => {
    const payload = makeTrustCenterData({ faqs: [TRUST_CENTER_FIXTURE_FAQ] });
    // The generic extractor would read the nested FAQ list as the rows.
    expect(extractItems(payload)).toEqual([TRUST_CENTER_FIXTURE_FAQ]);
    const items = extractCardItems('trust_center', payload);
    expect(items).toHaveLength(1);
    expect(extractItemId('trust_center', items[0])).toBe(TRUST_CENTER_CARD_ID);
    expect(extractCardItems('trust_center', null)).toEqual([]);
    // Every other type is unchanged.
    expect(extractCardItems('faq', payload)).toEqual([TRUST_CENTER_FIXTURE_FAQ]);
  });
});
