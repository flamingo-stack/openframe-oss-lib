'use client';

import React from 'react';
import { Ellipsis01Icon } from '../icons-v2-generated';
import { Button, type ButtonProps } from './button';

export interface ActionsMenuTriggerProps extends Omit<ButtonProps, 'children'> {
  /** The trigger's glyph. Default: the "…" icon. */
  trigger?: React.ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
}

/**
 * The "…" button an `ActionsMenuDropdown` opens from when the host gives no trigger of its own. A module of its own,
 * so a menu that loads on demand (`ActionsMenuDropdownOnDemand`) draws the very same button while it loads. It takes
 * the ref and the props the menu's trigger hands its child (`asChild`).
 */
export const ActionsMenuTriggerButton = React.forwardRef<HTMLButtonElement, ActionsMenuTriggerProps>(
  ({ trigger, triggerAriaLabel = 'More actions', triggerClassName, ...props }, ref) => (
    <Button
      {...props}
      ref={ref}
      variant="outline"
      size="icon"
      aria-label={triggerAriaLabel}
      className={
        triggerClassName ||
        'flex items-center justify-center border-ods-border bg-ods-card hover:bg-ods-bg-hover focus-visible:ring-0'
      }
      leftIcon={trigger ?? <Ellipsis01Icon size={24} className="text-ods-text-primary" />}
    />
  ),
);
ActionsMenuTriggerButton.displayName = 'ActionsMenuTriggerButton';
