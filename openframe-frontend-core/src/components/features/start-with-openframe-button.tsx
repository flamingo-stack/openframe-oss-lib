"use client"

import * as React from 'react';
import { Button, type ButtonProps } from "../ui/button";
import { cn } from "../../utils";

export interface StartWithOpenFrameButtonProps extends Omit<ButtonProps, 'variant' | 'size' | 'leftIcon'> {
  children?: React.ReactNode;
  mode?: 'outline' | 'yellow' | 'pink' | 'purple' | 'cyan';
  buttonSize?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
}

/**
 * "Start with OpenFrame" button for Flamingo header
 * – Five modes: 'outline' (default), 'yellow', 'pink', 'purple', and 'cyan'
 * – Text-only (no leading icon / trailing badge)
 * – Cyan mode uses custom background/text colors like JoinWaitlistButton
 */
export const StartWithOpenFrameButton = React.forwardRef<
  HTMLButtonElement,
  StartWithOpenFrameButtonProps
>(({ children = 'Start Free Trial', mode = 'outline', className, buttonSize, loading = false, buttonBackgroundColor, buttonTextColor, ...props }, ref) => {
  const isYellow = mode === 'yellow';
  const isPink = mode === 'pink' || mode === 'purple';
  const isCyan = mode === 'cyan';

  // Map buttonSize to Button component's size prop
  const mappedSize = buttonSize === 'md' ? 'default' : buttonSize === 'sm' ? 'small-legacy' : buttonSize === 'lg' ? 'default' : undefined;

  // Determine button variant and class names based on mode
  let buttonVariant: 'accent' | 'outline' = 'outline';
  let modeClassName = '';
  let customStyle: React.CSSProperties = {};

  if (isYellow) {
    buttonVariant = "accent";
    modeClassName = 'bg-[var(--ods-open-yellow-base)] hover:bg-[var(--ods-open-yellow-hover)] text-ods-text-on-accent border-[var(--ods-open-yellow-base)]';
  } else if (isPink) {
    buttonVariant = "accent";
    modeClassName = 'bg-[var(--ods-flamingo-pink-base)] hover:bg-[var(--ods-flamingo-pink-hover)] text-[var(--ods-system-greys-black)] border-[var(--ods-flamingo-pink-base)]';
  } else if (isCyan) {
    // Cyan mode: similar to JoinWaitlistButton with custom colors
    buttonVariant = "accent";
    modeClassName = 'bg-[var(--ods-flamingo-cyan-base)] hover:bg-[var(--ods-flamingo-cyan-hover)] text-[var(--ods-system-greys-black)] border-[var(--ods-flamingo-cyan-base)]';
    // Allow override with custom colors if provided
    if (buttonBackgroundColor || buttonTextColor) {
      customStyle = {
        backgroundColor: buttonBackgroundColor,
        color: buttonTextColor
      };
    }
  }

  return (
    <Button
      ref={ref}
      {...props}
      size={mappedSize}
      variant={buttonVariant}
      loading={loading}
      className={cn(
        modeClassName,
        className
      )}
      style={customStyle}
    >
      {children}
    </Button>
  );
});
StartWithOpenFrameButton.displayName = 'StartWithOpenFrameButton';
