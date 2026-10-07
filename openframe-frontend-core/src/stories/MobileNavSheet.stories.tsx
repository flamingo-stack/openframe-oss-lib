import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { OpenFrameLogo } from '../components/icons';
import { MobileNavSheet } from '../components/navigation/mobile-nav-sheet';
import { SocialIconRow } from '../components/social-icon-row';
import { Button } from '../components/ui/button';
import { simpleNav, siteNav } from './site-nav-fixtures';

const logo = (
  <OpenFrameLogo
    className="h-6 w-6 shrink-0"
    upperPathColor="var(--color-text-primary)"
    lowerPathColor="var(--color-accent-primary)"
  />
);

const meta = {
  title: 'Navigation/MobileNavSheet',
  component: MobileNavSheet,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        component:
          'The site navigation below `lg`: a full-screen sheet from the same `SiteNav` as the header. Menus with links ' +
          'are accordions (the one holding the current page starts open); the CTA and Sign in stay pinned.',
      },
    },
  },
  args: { isOpen: true, onClose: fn(), logo },
} satisfies Meta<typeof MobileNavSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The marketing site: the ask field, accordions, a pinned CTA and Sign in. */
export const Site: Story = {
  args: { nav: siteNav, pathname: '/openframe', askAI: { source: 'flamingo', label: 'Ask Mingo anything…' } },
};

/** A simple platform with live counters, the host's CTA node and a host-added group. */
export const SimplePlatform: Story = {
  args: {
    nav: simpleNav,
    pathname: '/members',
    badges: { messages: 3, requests: 12 },
    social: <SocialIconRow compact />,
    cta: <Button onClick={fn()}>Join the waitlist</Button>,
    extraMenus: [
      {
        id: 'profile',
        label: 'Profile',
        columns: [
          {
            id: 'profile',
            links: [
              { id: 'settings', label: 'Settings', href: '/profile' },
              { id: 'sign-out', label: 'Sign out', href: '/auth/sign-out' },
            ],
          },
        ],
      },
    ],
  },
};
