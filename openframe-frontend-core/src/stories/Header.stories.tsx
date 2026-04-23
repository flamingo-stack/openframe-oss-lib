import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState } from 'react';
import { fn } from 'storybook/test';

import { FlamingoLogo, OpenFrameLogo } from '../components/icons';
import { Header } from '../components/navigation/header';
import { Button } from '../components/ui/button';
import type { HeaderConfig } from '../types/navigation';

const flamingoLogo = (
  <div className="flex items-center gap-2">
    <FlamingoLogo className="h-8 w-8" />
    <span className="font-['DM_Sans'] font-bold text-[18px] text-ods-text-primary">
      Flamingo
    </span>
  </div>
);

const baseNavigation: HeaderConfig['navigation'] = {
  position: 'center',
  items: [
    {
      id: 'openframe',
      label: 'OpenFrame',
      icon: <OpenFrameLogo className="h-5 w-5" />,
      isActive: true,
      children: [
        { id: 'of-overview', label: 'Overview', href: '/openframe' },
        { id: 'of-cases', label: 'Case Studies', href: '/openframe/case-studies' },
        { id: 'of-roadmap', label: 'Roadmap & Releases', href: '/openframe/roadmap' },
        { id: 'of-webinars', label: 'Webinars', href: '/openframe/webinars' },
        { id: 'of-kb', label: 'Knowledge Hub', href: '/openframe/knowledge-hub' },
      ],
    },
    {
      id: 'openmsp',
      label: 'OpenMSP',
      children: [
        { id: 'om-overview', label: 'Overview', href: '/openmsp' },
        { id: 'om-blog', label: 'Blog', href: '/openmsp/blog' },
      ],
    },
    {
      id: 'company',
      label: 'Company',
      href: '/company',
    },
  ],
};

const rightActions = [
  <Button key="cta" variant="primary" href="/signup">
    Start Free Trial
  </Button>,
];

const meta = {
  title: 'Navigation/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Top navigation header with dropdown menus. Dropdown children are **always rendered in the DOM** — toggled via `visibility`/`opacity` — so their `<a href>` links are present in the initial HTML for SEO crawlers (no more "orphan" pages). Hidden anchors are automatically excluded from tab order and the accessibility tree via `visibility: hidden` + `aria-hidden`.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--ods-bg)' }}>
        <Story />
        <div style={{ padding: '2rem', color: 'var(--ods-text-primary)' }}>
          <p>Page content goes here — scroll to test auto-hide behavior.</p>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default header with dropdown navigation. Click "OpenFrame" or "OpenMSP" to open
 * the dropdown. Inspect the DOM — child `<a>` links are present even when
 * dropdowns are closed (hidden via CSS `visibility: hidden`).
 */
export const Default: Story = {
  args: {
    config: {
      logo: { element: flamingoLogo, href: '/' },
      navigation: baseNavigation,
      actions: { right: rightActions },
      autoHide: true,
      mobile: { enabled: true, onToggle: fn() },
    } satisfies HeaderConfig,
  },
};

/**
 * Programmatically opens the OpenFrame dropdown on mount so you can see the
 * SEO-visible child links in the viewport without clicking. Also useful for
 * visual regression snapshots of the open state.
 */
export const DropdownOpen: Story = {
  args: {
    config: {
      logo: { element: flamingoLogo, href: '/' },
      navigation: baseNavigation,
      actions: { right: rightActions },
      autoHide: false,
      mobile: { enabled: true, onToggle: fn() },
    } satisfies HeaderConfig,
  },
  render: (args) => {
    useEffect(() => {
      // Simulate user click on the first dropdown trigger after mount
      const trigger = document.querySelector<HTMLButtonElement>(
        'nav button'
      );
      trigger?.click();
    }, []);
    return <Header {...args} />;
  },
};

/**
 * Demonstrates that the dropdown links live in the DOM even when closed.
 * The panel below mirrors `document.querySelectorAll('nav a[href]').length`
 * and updates whenever you open/close a dropdown — the count stays the same,
 * which is exactly what a crawler would see.
 */
export const SeoLinksAlwaysInDom: Story = {
  args: {
    config: {
      logo: { element: flamingoLogo, href: '/' },
      navigation: baseNavigation,
      actions: { right: rightActions },
      autoHide: false,
      mobile: { enabled: true, onToggle: fn() },
    } satisfies HeaderConfig,
  },
  render: (args) => {
    const [linkHrefs, setLinkHrefs] = useState<string[]>([]);

    useEffect(() => {
      const collect = () => {
        const anchors = document.querySelectorAll<HTMLAnchorElement>(
          'header nav a[href]'
        );
        setLinkHrefs(Array.from(anchors, (a) => a.getAttribute('href') || ''));
      };
      collect();
      const interval = window.setInterval(collect, 500);
      return () => window.clearInterval(interval);
    }, []);

    return (
      <>
        <Header {...args} />
        <div
          style={{
            padding: '2rem',
            color: 'var(--ods-text-primary)',
            fontFamily: 'monospace',
            fontSize: 14,
          }}
        >
          <p style={{ marginBottom: 12 }}>
            <strong>{linkHrefs.length}</strong> anchor(s) currently in the
            header DOM (visible to crawlers regardless of dropdown state):
          </p>
          <ul style={{ lineHeight: 1.8 }}>
            {linkHrefs.map((href, i) => (
              <li key={`${href}-${i}`}>{href || '(empty)'}</li>
            ))}
          </ul>
        </div>
      </>
    );
  },
};

/**
 * Header with `autoHide: false` — stays fixed while scrolling.
 */
export const FixedHeader: Story = {
  args: {
    config: {
      logo: { element: flamingoLogo, href: '/' },
      navigation: baseNavigation,
      actions: { right: rightActions },
      autoHide: false,
      mobile: { enabled: true, onToggle: fn() },
    } satisfies HeaderConfig,
  },
};
