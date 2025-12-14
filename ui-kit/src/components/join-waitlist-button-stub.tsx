import React from 'react';
import { Button } from './ui/button';

export interface JoinWaitlistButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  lowerPathColor?: string;
  upperPathColor?: string;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
  loading?: boolean;
}

export const JoinWaitlistButton = React.forwardRef<HTMLButtonElement, JoinWaitlistButtonProps>(
  ({ className, lowerPathColor, upperPathColor, buttonBackgroundColor, buttonTextColor, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={className}
        style={{
          backgroundColor: buttonBackgroundColor,
          color: buttonTextColor
        }}
        {...props}
      >
        {children || 'Join Waitlist'}
      </Button>
    );
  }
);

JoinWaitlistButton.displayName = "JoinWaitlistButton";