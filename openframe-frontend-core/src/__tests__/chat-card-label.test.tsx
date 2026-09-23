import { describe, expect, it } from 'vitest';
import { chatCardLabel } from '../components/chat/entity-cards/dispatch';
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
