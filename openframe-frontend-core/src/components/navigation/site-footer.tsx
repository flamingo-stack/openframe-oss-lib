'use client';

import type React from 'react';
import { useState } from 'react';
import type { NavGroup, SiteNav } from '../../types/navigation';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon';
import { SocialIconRow } from '../social-icon-row';
import { Button } from '../ui/button';
import { NavItemRow } from './nav-item-row';
import { defaultRenderSiteNavLink, NAV_FOCUS_CLASS, navLinkLabel, type SiteNavLinkRenderer } from './site-nav-link';

export interface SiteFooterProps {
  nav: SiteNav;
  logo: React.ReactNode;
  renderLink?: SiteNavLinkRenderer;
  /** The closing band's primary CTA when `nav.primaryCta` is `'trial'` or `'waitlist'`. */
  cta?: React.ReactNode;
  /** Replaces the default social row built from `nav.brand.social` (each
   *  link's `iconName` is its social platform key). */
  social?: React.ReactNode;
  /** Rendered in the brand column, under the tagline and the social links. */
  brandExtra?: React.ReactNode;
  /** Opaque ODS background class. Default `bg-ods-bg`. */
  backgroundClassName?: string;
  /** Generated, never typed. Default: the current year. */
  year?: number;
}

/** Below `md`, more columns than this fold into accordions. */
const ACCORDION_OVER = 2;

// Literal class maps: Tailwind's scanner needs the full class strings.
const DESKTOP_COLUMNS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-3 lg:grid-cols-4',
  5: 'md:grid-cols-3 lg:grid-cols-5',
  6: 'md:grid-cols-3 lg:grid-cols-6',
};

const HEADING_CLASS = 'text-ods-text-muted text-h5';

function FooterColumn({
  group,
  accordion,
  renderLink,
}: {
  group: NavGroup;
  accordion: boolean;
  renderLink: SiteNavLinkRenderer;
}) {
  const [open, setOpen] = useState(false);
  const listId = `site-footer-${group.id}`;
  const links = group.links.map(link => (
    <li key={link.id}>
      <NavItemRow link={link} variant="label" renderLink={renderLink} />
    </li>
  ));

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col md:gap-[var(--spacing-system-mf)]',
        accordion ? 'border-b border-ods-border md:border-b-0' : 'gap-[var(--spacing-system-mf)]',
      )}
    >
      {group.title &&
        (accordion ? (
          <>
            {/* Below md the heading is the accordion's button; from md it is a plain heading. */}
            <h3 className="md:hidden">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen(prev => !prev)}
                className={cn(
                  'flex min-h-14 w-full items-center justify-between gap-[var(--spacing-system-sf)] text-left',
                  HEADING_CLASS,
                  NAV_FOCUS_CLASS,
                )}
              >
                {group.title}
                <Chevron02DownIcon
                  aria-hidden="true"
                  className={cn('h-5 w-5 shrink-0 transition-transform duration-150', open && 'rotate-180')}
                />
              </button>
            </h3>
            <h3 className={cn('hidden md:block', HEADING_CLASS)}>{group.title}</h3>
          </>
        ) : (
          <h3 className={HEADING_CLASS}>{group.title}</h3>
        ))}
      {/* Always in the DOM (crawlers read the footer links); a folded
          accordion only hides its list below md. */}
      <ul
        id={listId}
        className={cn(
          'flex-col md:flex md:gap-[var(--spacing-system-sf)] md:pb-0',
          accordion
            ? open
              ? 'flex gap-[var(--spacing-system-sf)] pb-[var(--spacing-system-mf)]'
              : 'hidden'
            : 'flex gap-[var(--spacing-system-sf)]',
        )}
      >
        {links}
      </ul>
    </div>
  );
}

/**
 * The site footer of every platform, drawn from one `SiteNav`: the closing
 * band, the brand column, the link columns and the legal line.
 */
export function SiteFooter({
  nav,
  logo,
  renderLink = defaultRenderSiteNavLink,
  cta,
  social,
  brandExtra,
  backgroundClassName,
  year = new Date().getFullYear(),
}: SiteFooterProps) {
  const band = nav.closingBand;
  const bandPrimary =
    typeof nav.primaryCta === 'object' ? (
      <Button variant="accent" href={nav.primaryCta.href}>
        {nav.primaryCta.label}
      </Button>
    ) : nav.primaryCta === 'none' ? null : (
      (cta ?? null)
    );

  const columns = nav.footerColumns;
  const accordion = columns.length > ACCORDION_OVER;
  const socialRow =
    social ??
    (nav.brand.social.length > 0 ? (
      <SocialIconRow
        compact
        links={nav.brand.social.map(link => ({
          platform: link.iconName ?? link.id,
          href: link.href,
          label: link.label,
        }))}
      />
    ) : null);

  return (
    <footer
      className={cn(
        'relative z-[44] w-full border-t border-ods-border px-[var(--spacing-system-lf)] text-ods-text-primary',
        backgroundClassName ?? 'bg-ods-bg',
      )}
    >
      {band && (
        <div className="flex flex-col gap-[var(--spacing-system-lf)] border-b border-ods-border py-[var(--spacing-system-xlf)] md:flex-row md:items-center md:justify-between md:gap-[var(--spacing-system-xlf)] md:py-14">
          <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xsf)]">
            <h2 className="text-h2">{band.heading}</h2>
            <p className="text-ods-text-secondary text-h4">{band.subheading}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-[var(--spacing-system-sf)] md:flex-row">
            {bandPrimary}
            {band.secondary && (
              <Button variant="outline" href={band.secondary.href} openInNewTab={band.secondary.external}>
                {navLinkLabel(band.secondary)}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8 py-[var(--spacing-system-xlf)] lg:flex-row lg:gap-16 lg:py-14">
        <div className="flex w-full shrink-0 flex-col items-start gap-[var(--spacing-system-mf)] lg:w-60">
          {logo}
          <p className="text-ods-text-secondary text-h6">{nav.brand.tagline}</p>
          {socialRow}
          {nav.brand.statusUrl &&
            renderLink({
              link: { href: nav.brand.statusUrl, external: true },
              className: cn(
                'inline-flex items-center gap-[var(--spacing-system-xsf)] text-ods-text-secondary transition-colors text-h6 hover:text-ods-text-primary',
                NAV_FOCUS_CLASS,
              ),
              children: (
                <>
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ods-success" />
                  System status
                </>
              ),
            })}
          {brandExtra}
        </div>

        {columns.length > 0 && (
          <nav
            aria-label="Footer"
            className={cn(
              'grid min-w-0 flex-1 md:gap-7',
              accordion ? 'grid-cols-1' : 'grid-cols-2 gap-7',
              DESKTOP_COLUMNS[Math.min(columns.length, 6)],
            )}
          >
            {columns.map(group => (
              <FooterColumn key={group.id} group={group} accordion={accordion} renderLink={renderLink} />
            ))}
          </nav>
        )}
      </div>

      {/* The legal line is text, not navigation: muted, with its links in the
          accent so they still read as links (prototype `.nf-legal`). */}
      <div
        className={cn(
          'flex flex-col gap-[var(--spacing-system-xxs)] border-t border-ods-border pb-[var(--spacing-system-xlf)] pt-[var(--spacing-system-lf)] text-ods-text-muted text-h6 md:flex-row md:items-center md:justify-between md:gap-[var(--spacing-system-lf)]',
        )}
      >
        <span>
          © {year} {nav.legal.company}
        </span>
        <span className="flex flex-wrap items-center gap-x-[var(--spacing-system-mf)] gap-y-[var(--spacing-system-xxs)]">
          {nav.legal.notes.length > 0 && <span>{nav.legal.notes.join(' · ')}</span>}
          {nav.legal.links.map(link => (
            <NavItemRow
              key={link.id}
              link={link}
              variant="label"
              renderLink={renderLink}
              className="text-ods-accent hover:text-ods-accent hover:underline"
            />
          ))}
        </span>
      </div>
    </footer>
  );
}
