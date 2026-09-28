import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Drawer, DrawerContent, DrawerTitle } from '../drawer';

function panelOf(props: { side?: 'right' | 'left' | 'top' | 'bottom'; size?: 'default' | 'wide' }) {
  render(
    <Drawer open>
      <DrawerContent {...props} aria-describedby={undefined}>
        <DrawerTitle>Panel</DrawerTitle>
      </DrawerContent>
    </Drawer>,
  );
  // The title sits in the panel's own tree; the panel is the closest bg-ods-card element.
  return screen.getByText('Panel').closest('.bg-ods-card');
}

describe('DrawerContent size', () => {
  it('wide sets the panel to 90% of the viewport width on a side drawer', () => {
    expect(panelOf({ side: 'right', size: 'wide' })).toHaveClass('w-[90vw]');
  });

  it('wide sets the height on a top or bottom drawer', () => {
    expect(panelOf({ side: 'bottom', size: 'wide' })).toHaveClass('h-[90vh]');
  });

  it('default adds no size class', () => {
    const panel = panelOf({ side: 'right' });
    expect(panel).not.toHaveClass('w-[90vw]');
    expect(panel).not.toHaveClass('h-[90vh]');
  });

  it('cannot combine a size preset with the resize handle', () => {
    // Type-level contract: a resizable panel sizes itself inline, so `wide` would be silently dropped.
    // @ts-expect-error size="wide" and resizable are mutually exclusive
    const props: Parameters<typeof DrawerContent>[0] = { size: 'wide', resizable: true };
    expect(props.resizable).toBe(true);
  });
});
