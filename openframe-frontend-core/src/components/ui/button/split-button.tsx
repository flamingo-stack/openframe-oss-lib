'use client';

import React from 'react';
import { cn } from '../../../utils/cn';
import { Button } from './button';

// Two independent interactive halves, each the lib's `Button` (a `<button>`, or a link with `href`) attached to the
// other (`attach="start"` / `"end"`): one surface with a seam. For a single-target variant (decorative trailing icon),
// use `<Button splitIcon>`.

type SplitButtonVariant = 'accent' | 'outline' | 'transparent' | 'destructive' | 'warning';
type SplitButtonSize = 'default' | 'small';

interface SplitButtonIconAction {
  icon: React.ReactNode;
  /** The icon half is interactive but has no visible text — needs an accessible name. */
  'aria-label': string;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  href?: string;
  /**
   * Opens `href` with `target="_blank"`. Also marks the half as a new-tab
   * affordance, which hides it below `md` (set it for `onClick` handlers that
   * open a new tab/window themselves).
   */
  openInNewTab?: boolean;
  prefetch?: boolean;
  disabled?: boolean;
}

interface SplitButtonProps {
  variant?: SplitButtonVariant;
  size?: SplitButtonSize;
  fullWidth?: boolean;
  className?: string;

  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  href?: string;
  openInNewTab?: boolean;
  prefetch?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Disables both halves. Equivalent to `mainDisabled && iconAction.disabled`. */
  disabled?: boolean;
  /** Disables only the main half. Combine with `iconAction.disabled` for finer control. */
  mainDisabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
  groupAriaLabel?: string;

  iconAction: SplitButtonIconAction;
}

interface HalfOptions {
  variant: SplitButtonVariant;
  size: SplitButtonSize;
  side: 'main' | 'icon';
  soloOnMobile?: boolean;
  href?: string;
  openInNewTab?: boolean;
  prefetch?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  disabled?: boolean;
  /** Stretch this half to fill the group's free space (the icon half stays fixed-width). */
  grow?: boolean;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  children: React.ReactNode;
}

function Half({
  variant,
  size,
  side,
  soloOnMobile,
  href,
  openInNewTab,
  prefetch,
  onClick,
  disabled,
  grow,
  type = 'button',
  ariaLabel,
  children,
}: HalfOptions) {
  return (
    <Button
      type={type}
      variant={variant}
      size={side === 'main' ? size : size === 'small' ? 'small' : 'icon'}
      attach={side === 'main' ? 'start' : 'end'}
      href={href}
      openInNewTab={openInNewTab}
      prefetch={prefetch}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      // Layout only: the main half fills the group's free space; a new-tab icon half is dropped below md.
      className={cn(grow && 'flex-1', side === 'icon' && soloOnMobile && 'max-md:hidden')}
    >
      {children}
    </Button>
  );
}

const SplitButton = React.forwardRef<HTMLDivElement, SplitButtonProps>(function SplitButtonImpl(
  {
    variant = 'accent',
    size = 'default',
    fullWidth = false,
    className,
    children,
    onClick,
    href,
    openInNewTab,
    prefetch,
    leftIcon,
    rightIcon,
    disabled,
    mainDisabled,
    type,
    iconAction,
    'aria-label': ariaLabel,
    groupAriaLabel,
  },
  ref,
) {
  const soloOnMobile = !!iconAction.openInNewTab;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={groupAriaLabel}
      className={cn('inline-flex items-stretch', fullWidth && 'w-full', className)}
    >
      <Half
        variant={variant}
        size={size}
        side="main"
        soloOnMobile={soloOnMobile}
        href={href}
        openInNewTab={openInNewTab}
        prefetch={prefetch}
        onClick={onClick}
        disabled={disabled || mainDisabled}
        grow={fullWidth}
        type={type}
        ariaLabel={ariaLabel}
      >
        {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
      </Half>
      <Half
        variant={variant}
        size={size}
        side="icon"
        soloOnMobile={soloOnMobile}
        href={iconAction.href}
        openInNewTab={iconAction.openInNewTab}
        prefetch={iconAction.prefetch}
        onClick={iconAction.onClick}
        disabled={disabled || iconAction.disabled}
        ariaLabel={iconAction['aria-label']}
      >
        <span className="inline-flex items-center">{iconAction.icon}</span>
      </Half>
    </div>
  );
});
SplitButton.displayName = 'SplitButton';

export { SplitButton, type SplitButtonProps, type SplitButtonIconAction };
