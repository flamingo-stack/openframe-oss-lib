import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';
import { Button } from './ui/button';

interface ProviderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  provider: 'google' | 'microsoft' | 'slack' | 'github' | 'apple';
  variant?: 'accent' | 'outline';
  size?: 'default' | 'small-legacy';
  loading?: boolean;
}

const ProviderButton = forwardRef<HTMLButtonElement, ProviderButtonProps>(
  ({ className, provider, variant = 'outline', size = 'default', children, ...props }, ref) => {
    const providerNames = {
      google: 'Google',
      microsoft: 'Microsoft',
      slack: 'Slack',
      github: 'GitHub',
      apple: 'Apple',
    };

    return (
      <Button className={cn('w-full', className)} variant={variant} size={size} ref={ref} {...props}>
        {children || `Sign in with ${providerNames[provider]}`}
      </Button>
    );
  },
);
ProviderButton.displayName = 'ProviderButton';

export { ProviderButton };
