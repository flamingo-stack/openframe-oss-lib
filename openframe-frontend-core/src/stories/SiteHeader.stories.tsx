import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { OpenFrameLogo, OpenFrameText } from '../components/icons';
import { Menu01Icon } from '../components/icons-v2-generated/interface/menu-01-icon';
import { HeaderButton } from '../components/navigation/header-button';
import { SiteHeader, type SiteHeaderProps } from '../components/navigation/site-header';
import { SocialIconRow } from '../components/social-icon-row';
import { Button } from '../components/ui/button';
import { adminNav, simpleNav, siteNav } from './site-nav-fixtures';

const logo = (
  <span className="flex items-center gap-2">
    <OpenFrameLogo
      className="h-6 w-6 shrink-0"
      upperPathColor="var(--color-text-primary)"
      lowerPathColor="var(--color-accent-primary)"
    />
    <OpenFrameText textColor="var(--color-text-primary)" className="h-4" />
  </span>
);

/** Owns the one piece of state a host owns here: the mobile sheet. */
function Harness(props: SiteHeaderProps & { withMobile?: boolean }) {
  const { withMobile, ...headerProps } = props;
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <div className="min-h-[640px] bg-ods-bg">
      <SiteHeader
        {...headerProps}
        mobile={withMobile ? { isOpen: sheetOpen, onToggle: () => setSheetOpen(open => !open) } : undefined}
      />
      <main id="main-content" className="p-6 text-ods-text-secondary text-h4">
        Page content. Hover or click a menu; press Tab from the top of the page to reach "Skip to content".
      </main>
    </div>
  );
}

const meta = {
  title: 'Navigation/SiteHeader',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The site header of every platform, drawn from one `SiteNav`. A menu with one column opens a dropdown; more ' +
          'columns, features or side links open the full-width mega menu. Below `lg` the menus and Sign in move to ' +
          '`MobileNavSheet`; the CTA and the Mingo AI launcher stay.',
      },
    },
  },
  args: { logo, logoHref: '/' },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A marketing site: mega menus, Sign in, a lib-rendered CTA and the Mingo AI launcher. */
export const SiteWithMegaMenus: Story = {
  args: {
    nav: siteNav,
    pathname: '/case-studies',
    mingo: { source: 'flamingo' },
    withMobile: true,
    social: <SocialIconRow compact />,
  },
};

/** A simple public platform: one dropdown with live counters and the host's CTA node. */
export const SimplePlatformWithBadges: Story = {
  args: {
    nav: simpleNav,
    pathname: '/events',
    withMobile: true,
    badges: { messages: 3, requests: 12 },
    social: <SocialIconRow compact />,
    cta: <Button onClick={fn()}>Join the waitlist</Button>,
  },
};

/** An admin hub: a leading sidebar toggle, no menus, the host's actions. */
export const AdminWithLeadingCell: Story = {
  args: {
    nav: adminNav,
    pathname: '/admin/jobs',
    leading: (
      <HeaderButton
        className="border-r border-ods-border"
        aria-label="Toggle sidebar"
        onClick={fn()}
        icon={<Menu01Icon className="h-6 w-6" />}
      />
    ),
    actions: (
      <Button variant="outline" onClick={fn()}>
        Profile
      </Button>
    ),
  },
};
