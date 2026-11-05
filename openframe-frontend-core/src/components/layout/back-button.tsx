'use client';

import type React from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { Button } from '../ui/button';

export interface BackButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /**
   * Where "back" goes. With it the control is a real link (open in a new tab,
   * prefetch, right-click); without it, a button that runs `onClick`.
   */
  href?: string;
  /**
   * Go back the way the browser's own back button does: when this tab has an earlier page of the same site, the
   * click returns to it (with the address it had: its filters, page and sort), and `href` is only where a visitor
   * who arrived from outside (a shared link, a new tab) goes. Needs `href`.
   */
  historyBack?: boolean;
}

/** The earlier page of this tab, when it is a page of the same site (the Navigation API, else the referrer). */
function hasSameSiteHistory(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = (window as Window & { navigation?: { canGoBack?: boolean; currentEntry?: { index: number } | null } })
    .navigation;
  // The Navigation API lists only this tab's same-origin entries, so an earlier one is a page of this site.
  if (nav && typeof nav.canGoBack === 'boolean') return nav.canGoBack && (nav.currentEntry?.index ?? 0) > 0;
  try {
    return (
      window.history.length > 1 && !!document.referrer && new URL(document.referrer).origin === window.location.origin
    );
  } catch {
    return false;
  }
}

/** Its place in the page: the start of the column, above the title. The box is the `link` button's at `default` size. */
const BACK_BUTTON_LAYOUT_CLASS = 'self-start';

/**
 * The footprint of a `BackButton`, for a loading skeleton that must not move the page: the `default` button's height
 * (44px, 48px from md), and a typical label's width.
 */
export const BACK_BUTTON_SKELETON_CLASS = 'h-11 w-40 rounded-md md:h-12';

/**
 * THE back navigation of a page: the chevron and its label, above the title.
 * Every detail page renders this one (through `PageLayout`'s `backButton` or
 * directly), never a hand-built link.
 */
export function BackButton({
  label = 'Back',
  className,
  type = 'button',
  href,
  historyBack = false,
  ...props
}: BackButtonProps) {
  const content = (
    <>
      <Chevron02LeftIcon className="size-6 shrink-0" />
      <span className="text-h4">{label}</span>
    </>
  );
  if (href) {
    // A link takes everything a button and an anchor share (id, title, data-*, aria-*,
    // handlers); what only a button understands is left off.
    const {
      disabled: _disabled,
      form: _form,
      formAction: _formAction,
      formEncType: _formEncType,
      formMethod: _formMethod,
      formNoValidate: _formNoValidate,
      formTarget: _formTarget,
      name: _name,
      value: _value,
      ...shared
    } = props;
    return (
      <Button asChild variant="link" noPaddingX className={cn(BACK_BUTTON_LAYOUT_CLASS, className)}>
        <Link
          {...(shared as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          href={href}
          onClick={
            historyBack
              ? (event: React.MouseEvent<HTMLAnchorElement>) => {
                  (shared.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined)?.(event);
                  // A modified click (new tab, new window) keeps the link's own behaviour.
                  if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  if (!hasSameSiteHistory()) return;
                  event.preventDefault();
                  window.history.back();
                }
              : (shared.onClick as unknown as React.MouseEventHandler<HTMLAnchorElement> | undefined)
          }
        >
          {content}
        </Link>
      </Button>
    );
  }
  return (
    <Button variant="link" noPaddingX type={type} className={cn(BACK_BUTTON_LAYOUT_CLASS, className)} {...props}>
      {content}
    </Button>
  );
}

export default BackButton;
