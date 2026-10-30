/**
 * An empty state's icon slots hold their size before the glyph lands: a glyph still on
 * its way (an agent's mark reads its icon from the server) or drawn a frame late must not
 * move the title, the description or a block's label. Both slots, the message's and each
 * block's, take `noDataIconClasses`.
 */

import { describe, expect, it } from 'vitest';
import { noDataIconClasses } from '../no-data/no-data-styles';

const classes = noDataIconClasses.split(' ');

describe('noDataIconClasses', () => {
  it("is the glyph's box itself: 16px, 24px from the content area's md", () => {
    expect(classes).toEqual(expect.arrayContaining(['size-4', 'content-md:size-6']));
  });

  it('still sizes the glyph to the slot', () => {
    expect(classes).toEqual(
      expect.arrayContaining(['[&_svg]:h-4', '[&_svg]:w-4', 'content-md:[&_svg]:h-6', 'content-md:[&_svg]:w-6']),
    );
  });
});
