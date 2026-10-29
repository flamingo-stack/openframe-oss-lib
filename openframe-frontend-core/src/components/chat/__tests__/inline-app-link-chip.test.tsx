import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { InlineAppLinkChip } from '../inline-app-link-chip';

function HostAnchor({ href, className, children }: { href: string; className?: string; children?: React.ReactNode }) {
  return (
    <a href={href} className={className} data-testid="host-anchor">
      {children}
    </a>
  );
}

describe('a link that stays in the app is an inline box', () => {
  it('draws the label in the boxed chip, through the host anchor', () => {
    render(
      <InlineAppLinkChip href="/devices/new" anchor={HostAnchor}>
        Devices → Add Device
      </InlineAppLinkChip>,
    );
    const link = screen.getByRole('link', { name: /Devices → Add Device/ });
    expect(link).toHaveAttribute('href', '/devices/new');
    expect(link).toHaveAttribute('data-testid', 'host-anchor');
  });
});
