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
    expect(SOURCE_ICON_NAMES['prospect-calls']).toBe('call');
    expect(buildListUrl('prospect_call', ['1', '2'])).toBe('/api/prospect-calls?ids=1,2');
  });
});

describe('site_page source wiring', () => {
  it('maps the document type to its table id, label, icon and card route', () => {
    expect(chatCardLabel('site_page')).toBe('Website page');
    expect(DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID.site_page).toBe('website-pages');
    expect(getSourceLabel('website-pages')).toBe('Website');
    expect(SOURCE_ICON_NAMES['website-pages']).toBe('flamingo-logo-grey');
    expect(buildListUrl('site_page', ['pricing', 'openframe'])).toBe('/api/site-pages?ids=pricing,openframe');
  });
});

describe('vendor source wiring', () => {
  it('maps the document type to its table id, label, icon and card route', () => {
    expect(chatCardLabel('vendor')).toBe('Vendor');
    expect(DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID.vendor).toBe('vendors');
    expect(getSourceLabel('vendors')).toBe('Vendor Directory');
    expect(SOURCE_ICON_NAMES.vendors).toBe('package-search');
    expect(buildListUrl('vendor', ['1', '2'])).toBe('/api/vendors/cards?ids=1,2');
  });
});

describe('trust_center source wiring', () => {
  it('maps the document type to its table id, label, icon and route', () => {
    expect(chatCardLabel('trust_center')).toBe('Trust center');
    expect(DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID.trust_center).toBe('trust-center');
    expect(getSourceLabel('trust-center')).toBe('Trust Center');
    expect(SOURCE_ICON_NAMES['trust-center']).toBe('shield-check');
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

describe('openframe_price source wiring', () => {
  it('has a card label, a table, a chip label, an icon and a hydration URL', () => {
    expect(chatCardLabel('openframe_price')).toBe('OpenFrame price');
    expect(DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID.openframe_price).toBe('openframe-pricing');
    expect(getSourceLabel('openframe-pricing')).toBe('OpenFrame pricing');
    expect(SOURCE_ICON_NAMES['openframe-pricing']).toBe('money-bill-dollar');
    expect(buildListUrl('openframe_price', ['plan', 'model-claude-opus-5-5'])).toBe(
      '/api/openframe-pricing?ids=plan,model-claude-opus-5-5',
    );
  });
});
