import * as React from "react"
import { Button } from "./ui/button"
import { cn } from "../utils/cn"

interface ProviderButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  provider: 'google' | 'microsoft' | 'slack' | 'github';
  variant?: 'primary' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  loading?: boolean;
}

const ProviderButton = React.forwardRef<HTMLButtonElement, ProviderButtonProps>(
  ({ className, provider, variant = 'outline', size = 'default', children, ...props }, ref) => {
    const providerNames = {
      google: 'Google',
      microsoft: 'Microsoft',
      slack: 'Slack',
      github: 'GitHub'
    };

    return (
      <Button
        className={cn(
          "w-full",
          className
        )}
        variant={variant}
        size={size}
        ref={ref}
        {...props}
      >
        {children || `Sign in with ${providerNames[provider]}`}
      </Button>
    )
  }
)
ProviderButton.displayName = "ProviderButton"

export { ProviderButton }