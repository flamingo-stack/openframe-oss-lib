
import * as React from 'react';
import { Button, type ButtonProps } from "../ui/button";
import { StatusBadge } from "../ui/status-badge";
import { OpenFrameLogo } from "../icons";
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
 * – Shows OpenFrame icon on the left
 * – Same pattern as OpenFrame Github button in hero section
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
  const mappedSize = buttonSize === 'md' ? 'default' : buttonSize;
  
  // Determine button variant and class names based on mode
  let buttonVariant: 'primary' | 'outline' = 'outline';
  let modeClassName = '';
  let iconLowerPath = "var(--ods-open-yellow-base)";
  let iconUpperPath = "var(--ods-system-greys-white)";
  let customStyle: React.CSSProperties = {};
  
  if (isYellow) {
    buttonVariant = 'primary';
    modeClassName = 'bg-[var(--ods-open-yellow-base)] hover:bg-[var(--ods-open-yellow-hover)] text-ods-text-on-accent border-[var(--ods-open-yellow-base)]';
    iconLowerPath = "var(--ods-system-greys-white)";
    iconUpperPath = "var(--ods-system-greys-black)";
  } else if (isPink) {
    buttonVariant = 'primary';
    modeClassName = 'bg-[var(--ods-flamingo-pink-base)] hover:bg-[var(--ods-flamingo-pink-hover)] text-[var(--ods-system-greys-black)] border-[var(--ods-flamingo-pink-base)]';
    iconLowerPath = "var(--ods-system-greys-white)";
    iconUpperPath = "var(--ods-system-greys-black)";
  } else if (isCyan) {
    // Cyan mode: similar to JoinWaitlistButton with custom colors
    buttonVariant = 'primary';
    modeClassName = 'bg-[var(--ods-flamingo-cyan-base)] hover:bg-[var(--ods-flamingo-cyan-hover)] text-[var(--ods-system-greys-black)] border-[var(--ods-flamingo-cyan-base)]';
    // Allow override with custom colors if provided
    if (buttonBackgroundColor || buttonTextColor) {
      customStyle = { 
        backgroundColor: buttonBackgroundColor, 
        color: buttonTextColor
      };
    }
    // For cyan mode with black text, use white/black icon for contrast
    iconLowerPath = "#ffffff";
    iconUpperPath = "#1A1A1A";
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
      leftIcon={!loading ? <OpenFrameLogo className="w-5 h-5"
        lowerPathColor={iconLowerPath}
        upperPathColor={iconUpperPath} /> : undefined}
      rightIcon={
        <StatusBadge
          text="Beta"
          variant="button"
          colorScheme="yellow"
        />
      }
    >
      {children}
    </Button>
  );
});
StartWithOpenFrameButton.displayName = 'StartWithOpenFrameButton'; 