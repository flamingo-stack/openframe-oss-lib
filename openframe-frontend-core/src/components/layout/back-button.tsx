'use client';

import type React from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';

export interface BackButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /**
   * Where "back" goes. With it the control is a real link (open in a new tab,
   * prefetch, right-click); without it, a button that runs `onClick`.
   */
  href?: string;
}

const BACK_BUTTON_CLASS = cn(
  'group inline-flex items-center justify-center self-start rounded-md',
  'gap-[var(--spacing-system-xsf)] py-[var(--spacing-system-sf)]',
  'text-ods-text-secondary hover:text-ods-text-primary',
  'transition-colors duration-200',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
);

/** The footprint of a `BackButton`, for a loading skeleton that must not move the page. */
export const BACK_BUTTON_SKELETON_CLASS = 'h-12 w-40 rounded-md';

/**
 * THE back navigation of a page: the chevron and its label, above the title.
 * Every detail page renders this one (through `PageLayout`'s `backButton` or
 * directly), never a hand-built link.
 */
export function BackButton({ label = 'Back', className, type = 'button', href, ...props }: BackButtonProps) {
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
      <Link
        {...(shared as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        href={href}
        className={cn(BACK_BUTTON_CLASS, className)}
      >
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={cn(BACK_BUTTON_CLASS, className)} {...props}>
      {content}
    </button>
  );
}

export default BackButton;
