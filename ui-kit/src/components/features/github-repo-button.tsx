import React from 'react';
import { Button, ButtonProps } from '../ui/button';
import { GitHubIcon } from '../icons';

interface GithubRepoButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'variant' | 'size'> {
  children?: React.ReactNode;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function GithubRepoButton({ 
  children = 'Get Started',
  size = 'default',
  href = 'https://github.com/flamingo-stack/openframe-oss-tenant',
  className = '',
  ...props 
}: GithubRepoButtonProps) {
  return (
    <Button
      variant="outline"
      className={className}
      openInNewTab
      size={size}
      href={href}
      leftIcon={<GitHubIcon className="w-6 h-6" />}
      {...props}
    >
      {children}
    </Button>
  );
}