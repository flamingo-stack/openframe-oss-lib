import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { InlineAppLinkChip, isInAppPath } from '../inline-app-link-chip';

function HostAnchor({ href, className, children }: { href: string; className?: string; children?: React.ReactNode }) {
  return (
    <a href={href} className={className} data-testid="host-anchor">
      {children}
    </a>
  );
}

describe('a link to a screen of the app is an inline box', () => {
  it('counts only root-relative paths as screens of the app', () => {
    expect(isInAppPath('/devices/new')).toBe(true);
    expect(isInAppPath('//evil.example/x')).toBe(false);
    expect(isInAppPath('https://openframe.ai/devices')).toBe(false);
    expect(isInAppPath('#section')).toBe(false);
    expect(isInAppPath(undefined)).toBe(false);
  });

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
