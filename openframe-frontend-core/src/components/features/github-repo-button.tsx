"use client"

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
  href = process.env.NEXT_PUBLIC_GITHUB_REPO_URL ?? 'https://github.com/flamingo-stack/openframe-cli',
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