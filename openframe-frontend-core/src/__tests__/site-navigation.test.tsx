import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MOBILE_NAV_SHEET_ID, MobileNavSheet } from '../components/navigation/mobile-nav-sheet';
import { SiteFooter } from '../components/navigation/site-footer';
import { SiteHeader } from '../components/navigation/site-header';
import { adminNav, simpleNav, siteNav } from '../stories/site-nav-fixtures';
import type { CaseStudy, CaseStudyCardData } from '../types/case-study';

/**
 * What only a render can show: the header's panels are in the DOM while closed
 * (crawlers read them), the data picks the panel's shape, and the three
 * components draw the same model.
 */
describe('SiteHeader', () => {
  const renderHeader = (pathname = '/case-studies') =>
    render(<SiteHeader nav={siteNav} pathname={pathname} logo={<span>Logo</span>} logoHref="/" />);

  it('puts "Skip to content" first and targets the main content id', () => {
    renderHeader();
    const first = screen.getAllByRole('link', { hidden: true })[0];
    expect(first).toHaveTextContent('Skip to content');
    expect(first).toHaveAttribute('href', '#main-content');
  });

  it('keeps every menu link in the DOM while its panel is closed and inert', () => {
    renderHeader();
    const link = screen.getByRole('link', { name: /Remote access/, hidden: true });
    expect(link).toHaveAttribute('href', '/openframe#remote-access');
    expect(screen.getByRole('button', { name: 'Product' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu', { hidden: true })).toBeNull();
    expect(screen.queryByRole('menuitem', { hidden: true })).toBeNull();
  });

  it('opens a menu from its button and wires aria-controls to the panel', () => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: 'Product' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBeTruthy();
    expect(screen.getByText('Built on MeshCentral')).toBeInTheDocument();
  });

  it('marks the active section, on a menu button and on a plain link', () => {
    renderHeader('/case-studies/utah');
    expect(screen.getByRole('button', { name: 'Customers' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Product' })).not.toHaveAttribute('aria-current');
  });

  it('fills the {count} token and renders the lib CTA, Sign in and feature cards', () => {
    renderHeader('/pricing');
    expect(screen.getByRole('link', { name: 'Pricing' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /All 21 customer stories/, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start free trial' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getAllByText('Read the story')).toHaveLength(2);
  });

  it('renders the cta slot for a named CTA, live counters, and nothing extra for an admin bar', () => {
    const { unmount } = render(
      <SiteHeader
        nav={simpleNav}
        pathname="/events"
        logo={<span>Logo</span>}
        cta={<button type="button">Join the waitlist</button>}
        badges={{ messages: 3, requests: 12 }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Join the waitlist' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('9+')).toBeInTheDocument();
    unmount();

    render(
      <SiteHeader nav={adminNav} pathname="/admin" logo={<span>Logo</span>} cta={<button type="button">x</button>} />,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button', { name: 'x' })).toBeNull();
  });

  it('shows the Mingo launcher before the host cells and the burger only when asked', () => {
    const onToggleMenu = vi.fn();
    const onOpen = vi.fn();
    window.addEventListener('ask-ai:open', onOpen);
    const { unmount } = render(
      <SiteHeader
        nav={siteNav}
        pathname="/"
        logo={<span>Logo</span>}
        sideActions={<button type="button">Tickets</button>}
        mingo={{ source: 'flamingo', label: 'Mingo' }}
        mobile={{ isOpen: true, onToggle: onToggleMenu }}
      />,
    );
    // The launcher sits in the right cluster, before the host's trailing cells,
    // and dispatches the open event itself.
    const buttons = screen.getAllByRole('button');
    const launcher = screen.getByRole('button', { name: 'Mingo' });
    expect(buttons[buttons.length - 1]).toHaveTextContent('Tickets');
    expect(buttons[buttons.length - 2]).toBe(launcher);
    fireEvent.click(launcher);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect((onOpen.mock.calls[0][0] as CustomEvent).detail).toEqual({ source: 'flamingo' });
    window.removeEventListener('ask-ai:open', onOpen);

    const burger = screen.getByRole('button', { name: 'Close menu' });
    expect(burger).toHaveAttribute('aria-controls', MOBILE_NAV_SHEET_ID);
    fireEvent.click(burger);
    expect(onToggleMenu).toHaveBeenCalledTimes(1);
    unmount();

    render(<SiteHeader nav={siteNav} pathname="/" logo={<span>Logo</span>} />);
    expect(screen.queryByRole('button', { name: 'Mingo AI' })).toBeNull();
    expect(screen.queryByRole('button', { name: /menu/ })).toBeNull();
  });
});

describe('MobileNavSheet', () => {
  const renderSheet = (overrides: Partial<Parameters<typeof MobileNavSheet>[0]> = {}) => {
    const onClose = vi.fn();
    render(
      <MobileNavSheet
        nav={siteNav}
        isOpen
        onClose={onClose}
        pathname="/openframe"
        logo={<span>Logo</span>}
        {...overrides}
      />,
    );
    return onClose;
  };

  it('renders nothing while closed', () => {
    renderSheet({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a modal dialog whose current group starts open', () => {
    renderSheet();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('dialog')).toHaveAttribute('id', MOBILE_NAV_SHEET_ID);
    expect(screen.getByRole('button', { name: 'Product' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Customers' })).toHaveAttribute('aria-expanded', 'false');
    // Every column's links, then the side links.
    expect(screen.getByRole('link', { name: /Mingo/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Trust Center/ })).toBeInTheDocument();
  });

  it('expands a group in place, and a menu with only href is a link row', () => {
    const onClose = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Customers' }));
    expect(screen.getByRole('link', { name: /All 21 customer stories/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Pricing' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('pins the CTA and Sign in, and closes on Escape and on the close button', () => {
    const onClose = renderSheet();
    expect(screen.getByRole('link', { name: 'Start free trial' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows the ask field only with the slot, worded by the host; it opens the chat and closes the sheet', () => {
    const onOpen = vi.fn();
    window.addEventListener('ask-ai:open', onOpen);
    const onClose = renderSheet({ askAI: { source: 'flamingo', label: 'Ask about pricing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask about pricing' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect((onOpen.mock.calls[0][0] as CustomEvent).detail).toEqual({ source: 'flamingo' });
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener('ask-ai:open', onOpen);
  });

  it('appends the host groups', () => {
    renderSheet({
      extraMenus: [
        {
          id: 'admin',
          label: 'Admin',
          columns: [{ id: 'admin', links: [{ id: 'jobs', label: 'Jobs', href: '/admin/jobs' }] }],
        },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
    expect(screen.getByRole('link', { name: 'Jobs' })).toHaveAttribute('href', '/admin/jobs');
  });
});

describe('SiteFooter', () => {
  it('draws the band, the columns in a Footer nav and a generated legal line', () => {
    render(<SiteFooter nav={siteNav} logo={<span>Logo</span>} year={2031} brandExtra={<p>Made with love</p>} />);
    expect(screen.getByRole('heading', { name: 'AI handles IT. You run the business.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book a demo' })).toHaveAttribute('href', '/schedule-a-call');
    const footerNav = screen.getByRole('navigation', { name: 'Footer' });
    expect(within(footerNav).getByRole('link', { name: 'Knowledge base', hidden: true })).toBeInTheDocument();
    expect(screen.getByText('© 2031 Flamingo AI, Inc.')).toBeInTheDocument();
    expect(screen.getByText('Apache-licensed core · Data hosted in the US')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/flamingo-stack');
    expect(screen.getByText('Made with love')).toBeInTheDocument();
    expect(screen.queryByText('System status')).toBeNull();
  });

  it('uses the current year by default and omits the band without one', () => {
    render(<SiteFooter nav={simpleNav} logo={<span>Logo</span>} />);
    expect(screen.getByText(`© ${new Date().getFullYear()} Miami Cyber Gang`)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('folds more than two columns into accordions that keep their links in the DOM', () => {
    render(<SiteFooter nav={siteNav} logo={<span>Logo</span>} />);
    const toggle = screen.getByRole('button', { name: 'Resources', hidden: true });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'FAQs', hidden: true })).toHaveAttribute('href', '/faqs');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('CaseStudyCard input', () => {
  it('still accepts a full case study row: the prop widened to the fields the card reads', () => {
    // Compile-time proof for consumers that pass whole rows: if `CaseStudyCardData`
    // ever asks for something a `CaseStudy` lacks, this file stops type-checking.
    const cardInput = (study: CaseStudyCardData) => study.id;
    const row = { id: 7 } as CaseStudy;
    expect(cardInput(row)).toBe(7);
  });
});
