import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { OpenframeLogoIcon } from '../components/icons-v2-generated/logos/openframe-logo-icon';
import { OpenframeTextIcon } from '../components/icons-v2-generated/logos/openframe-text-icon';
import { SiteFooter } from '../components/navigation/site-footer';
import { Button } from '../components/ui/button';
import { iconColors } from '../utils/icon-colors';
import { simpleNav, siteNav } from './site-nav-fixtures';

const logo = (
  <span className="flex items-center gap-2">
    <OpenframeLogoIcon
      style={iconColors({ secondary: 'var(--color-accent-primary)' })}
      className="h-7 w-7 shrink-0"
      color="var(--color-text-primary)"
    />
    <OpenframeTextIcon color="var(--color-text-primary)" className="h-4 w-[87px]" />
  </span>
);

const meta = {
  title: 'Navigation/SiteFooter',
  component: SiteFooter,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The site footer, drawn from the same `SiteNav` as the header: closing band, brand column, link columns and ' +
          'the legal line. With more than two columns they fold into accordions below `md`.',
      },
    },
  },
  args: { logo },
} satisfies Meta<typeof SiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closing band, five columns (accordions below md), legal notes and links. */
export const Site: Story = { args: { nav: siteNav } };

/** Two columns stay lists on mobile; the host supplies the band CTA and a brand line. */
export const SimplePlatform: Story = {
  args: {
    nav: {
      ...simpleNav,
      closingBand: { heading: 'Join the gang.', subheading: 'Meetups every month in Miami.' },
      brand: { ...simpleNav.brand, statusUrl: 'https://status.example.com' },
    },
    cta: <Button onClick={fn()}>Join the waitlist</Button>,
    brandExtra: <p className="text-ods-text-secondary text-h6">Made with love in Miami Beach.</p>,
  },
};
