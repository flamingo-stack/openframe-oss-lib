/**
 * `EmptyState`'s call to action is the house `Button` in its own variant, never a
 * default accent Button repainted with classes: the repaint lost to the accent hover
 * (green text on a green button). Each case is compared with the Button it must be.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../empty-state';
import { Button } from '../ui/button';

function classOf(name: string): string {
  return (screen.getByText(name).closest('a, button') as HTMLElement).className;
}

describe('EmptyState call to action', () => {
  it.each([
    ['secondary', 'outline'],
    ['primary', 'accent'],
  ] as const)('a %s CTA renders exactly the %s Button', (ctaVariant, buttonVariant) => {
    render(
      <>
        <EmptyState type="generic" ctaText="Record it" ctaHref="/record" ctaVariant={ctaVariant} />
        <Button href="/reference" variant={buttonVariant} className="w-full">
          Reference
        </Button>
      </>,
    );
    expect(classOf('Record it')).toBe(classOf('Reference'));
  });
});
