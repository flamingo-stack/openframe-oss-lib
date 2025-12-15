import * as React from 'react';
import { Button, type ButtonProps } from "../ui/button";
import { OpenFrameLogo } from "../icons";

export interface JoinWaitlistButtonProps
  extends Omit<ButtonProps, 'variant' | 'size' | 'leftIcon' | 'rightIcon'> {
  loading?: boolean;
  lowerPathColor?: string;
  upperPathColor?: string;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
  platform?: string;
}

/**
 * Unified "Join Waitlist" button used across the site.
 * – Primary yellow background
 * – DM Sans bold typography inherited from Button
 * – Shows OpenFrame icon on the left when not loading
 * – Uses built-in Button spinner when `loading` is true
 */
export const JoinWaitlistButton = React.forwardRef<
  HTMLButtonElement,
  JoinWaitlistButtonProps
>(({ loading = false, className, children = 'Join Waitlist', lowerPathColor, upperPathColor, buttonBackgroundColor, buttonTextColor, platform, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      variant="primary"
      size="touch"
      loading={loading}
      leftIcon={!loading ? <OpenFrameLogo className="w-5 h-5 sm:w-6 sm:h-6" lowerPathColor={lowerPathColor ?? "#ffffff"} upperPathColor={upperPathColor ?? "#1A1A1A"} /> : undefined}
      className={className}
      style={{ backgroundColor: buttonBackgroundColor, color: buttonTextColor }}
      {...props}
    >
      {children}
    </Button>
  );
});
JoinWaitlistButton.displayName = 'JoinWaitlistButton';