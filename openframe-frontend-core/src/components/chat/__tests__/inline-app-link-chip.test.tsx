import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { appScreenLinkMarkdown, isAppScreenLink } from '../../../chat-protocol/app-screen-link';
import { InlineAppLinkChip } from '../inline-app-link-chip';

function HostAnchor({ href, className, children }: { href: string; className?: string; children?: React.ReactNode }) {
  return (
    <a href={href} className={className} data-testid="host-anchor">
      {children}
    </a>
  );
}

describe('a link to a screen of the app is an inline box', () => {
  it('counts only links the answer marked as a screen of the app, never a guess from the path', () => {
    expect(isAppScreenLink('/devices/new', 'app-screen')).toBe(true);
    expect(isAppScreenLink('/devices/new', undefined)).toBe(false);
    expect(isAppScreenLink('/devices/new', 'Devices')).toBe(false);
    expect(isAppScreenLink('//evil.example/x', 'app-screen')).toBe(false);
    expect(isAppScreenLink('https://openframe.ai/devices', 'app-screen')).toBe(false);
    expect(isAppScreenLink(undefined, 'app-screen')).toBe(false);
  });

  it('writes the marked link the hub tells the model to write', () => {
    expect(appScreenLinkMarkdown('Devices → Add Device', '/devices/new')).toBe(
      '[Devices → Add Device](/devices/new "app-screen")',
    );
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
