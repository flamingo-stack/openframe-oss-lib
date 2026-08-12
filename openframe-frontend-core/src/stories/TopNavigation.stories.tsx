import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { OpenFrameLogo, OpenFrameText } from '../components/icons';
import { ClockHistoryIcon } from '../components/icons-v2-generated/date-and-time/clock-history-icon';
import { BellIcon } from '../components/icons-v2-generated/interface/bell-icon';
import { HeaderButton } from '../components/navigation/header-button';
import { HeaderMingoButton } from '../components/navigation/header-mingo-button';
import { TopNavigation } from '../components/navigation/top-navigation';
import { Button } from '../components/ui/button';

const logo = (
  <>
    <OpenFrameLogo
      className="h-6 w-6 shrink-0"
      upperPathColor="var(--color-text-primary)"
      lowerPathColor="var(--color-accent-primary)"
    />
    <OpenFrameText textColor="var(--color-text-primary)" className="h-4" />
  </>
);

const navLinks = (
  <nav className="flex items-center gap-2" aria-label="Main navigation">
    {['OpenFrame', 'OpenMSP', 'Resources', 'Pricing'].map(label => (
      <Button key={label} variant="transparent" size="default" font="regular" className="text-h6">
        {label}
      </Button>
    ))}
  </nav>
);

const burgerCell = (
  <HeaderButton
    className="border-r border-ods-border lg:hidden"
    aria-label="Open menu"
    onClick={fn()}
    icon={
      <svg className="h-4 w-4 md:h-6 md:w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    }
  />
);

const sideActionCells = (
  <>
    <HeaderButton
      className="border-l border-ods-border"
      aria-label="Time tracker"
      icon={<ClockHistoryIcon className="h-4 w-4 md:h-6 md:w-6" />}
    />
    <HeaderButton
      className="border-l border-ods-border"
      aria-label="Notifications"
      icon={<BellIcon className="h-4 w-4 md:h-6 md:w-6" />}
    />
    <HeaderMingoButton className="border-l border-ods-border" onClick={fn()} />
  </>
);

const meta = {
  title: 'Navigation/TopNavigation',
  component: TopNavigation,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Unified ODS top-navigation shell (Figma `[UPD] top-navigation`, node 2797-5978). ' +
          'Owns the bar geometry only — 48px mobile / 56px md+ height, top/bottom borders, background — and the zone layout ' +
          '`[leading][logo][center][cta][sideActions]`. Dividers belong to the cells (`border-l` / `border-r`), not the bar. ' +
          'Consumers: the console `AppHeader` (centerBreakpoint `md`, global search in the center zone) and the marketing ' +
          '`Header` (centerBreakpoint `lg`, nav links in the center zone). Resize the viewport to see the tablet burger and ' +
          'the mobile arrangement.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    centerBreakpoint: { control: 'radio', options: ['md', 'lg'] },
    size: { control: 'radio', options: ['small', 'big'] },
    backgroundClassName: { control: 'text' },
    mobileTopBorder: { control: 'boolean' },
  },
  decorators: [
    Story => (
      <div style={{ minHeight: '50vh', backgroundColor: 'var(--ods-bg)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TopNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The full marketing arrangement per the Figma spec: burger (below `lg`),
 * logo (grows below `lg`), centered nav links (from `lg`), CTA and the
 * side-action cells. Resize across 800px / 1280px to see all three device
 * variants.
 */
export const MarketingFull: Story = {
  args: {
    leading: burgerCell,
    logo,
    logoClassName: 'gap-2',
    center: navLinks,
    cta: (
      <Button variant="accent" size="small" onClick={fn()}>
        Try for Free
      </Button>
    ),
    sideActions: sideActionCells,
  },
};

/**
 * The `big` (72px) bar every hub/marketing site renders — same zones, taller
 * bar and 72px cells (Figma 2936-6812). `small` (56px) is the console size.
 */
export const MarketingBig: Story = {
  args: {
    ...MarketingFull.args,
    size: 'big',
    // Big bar carries the full default-size CTA (Figma 2936-6812), not the
    // 32px mono control.
    cta: (
      <Button variant="accent" onClick={fn()}>
        Try for Free
      </Button>
    ),
  },
};

/**
 * Console-style arrangement: no logo/nav (the app sidebar owns branding),
 * `centerBreakpoint="md"` so the center zone (here just the spacer) starts at
 * 800px, side-action cells flush right. This is the shape `AppHeader` renders.
 */
export const ConsoleShape: Story = {
  args: {
    centerBreakpoint: 'md',
    sideActions: sideActionCells,
  },
};

/**
 * Per-platform background override — platforms may run the bar on `bg-ods-bg`
 * instead of the default `bg-ods-card`. Keep the override opaque.
 */
export const CustomBackground: Story = {
  args: {
    ...MarketingFull.args,
    backgroundClassName: 'bg-ods-bg',
  },
};

/**
 * Logo-only bar (e.g. the `openframe` platform in the hub): every optional
 * zone omitted — the logo zone grows and nothing else renders.
 */
export const LogoOnly: Story = {
  args: {
    logo,
    logoClassName: 'gap-2',
  },
};
