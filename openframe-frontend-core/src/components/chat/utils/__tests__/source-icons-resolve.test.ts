import { FileText } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID, SOURCE_ICON_NAMES } from '../../../../utils/source-icons';
import { resolveIcon } from '../icon-library';
import { resolveSourceIcon } from '../source-row-cta';

/** The sources whose icon IS the document glyph, by choice. */
const DOCUMENT_GLYPH = new Set(['file-text', 'file']);

describe('every data source draws its own icon', () => {
  it.each(Object.entries(SOURCE_ICON_NAMES))('%s (%s) resolves to a real icon', (_table, name) => {
    if (DOCUMENT_GLYPH.has(name)) return;
    const unknown = resolveIcon('no-such-icon-anywhere', { variant: 'brand' });
    expect(resolveIcon(name, { variant: 'brand' })).not.toBe(unknown);
  });

  it('a source row uses it: a design-set name is not shown as the file glyph', () => {
    expect(resolveSourceIcon({ sourceRepo: 'openframe-pricing', documentType: 'openframe_price' }).Icon).not.toBe(
      FileText,
    );
    expect(resolveSourceIcon({ sourceRepo: 'trust-center', documentType: 'trust_center' }).Icon).not.toBe(FileText);
  });

  // A card draws its SOURCE's icon (`sourceGlyph` in the card registry), so every card type must lead to a
  // source that names one: the card and its chip are then the same icon by construction.
  it.each(Object.entries(DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID))(
    'card type %s draws the icon of its source %s',
    (docType, table) => {
      const name = SOURCE_ICON_NAMES[table];
      expect(name, `${table} names no icon`).toEqual(expect.any(String));
      if (DOCUMENT_GLYPH.has(name)) return;
      const byType = resolveSourceIcon({ sourceRepo: table, documentType: docType }).Icon;
      expect(byType).toBe(resolveIcon(name, { variant: 'brand' }));
      expect(byType).not.toBe(FileText);
    },
  );
});
