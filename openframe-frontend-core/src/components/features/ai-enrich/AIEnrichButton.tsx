'use client';

import type React from 'react';
import { cn } from '../../../utils/cn';
import { SparklesIcon } from '../../icons/sparkles-icon';
import { Button } from '../../ui/button';

export interface AIEnrichButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  loadingLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}

const sizeMap = {
  sm: 'small-legacy' as const,
  md: 'default' as const,
  lg: 'default' as const,
};

const variantMap = {
  primary: 'accent' as const,
  secondary: 'outline' as const,
  outline: 'outline' as const,
};

export const AIEnrichButton: React.FC<AIEnrichButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  label = 'AI Enrich',
  loadingLabel = 'Enriching...',
  size = 'md',
  variant = 'outline',
  className,
}) => {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      loading={loading}
      size={sizeMap[size]}
      variant={variantMap[variant]}
      leftIcon={!loading && <SparklesIcon size={18} color="currentColor" />}
      className={cn('gap-2', className)}
    >
      {loading ? loadingLabel : label}
    </Button>
  );
};
