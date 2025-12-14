'use client'

import React from 'react'
import { Button } from '../../ui/button'
import { SparklesIcon } from '../../icons/sparkles-icon'
import { cn } from '../../../utils/cn'

export interface AIEnrichButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label?: string
  loadingLabel?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline'
  className?: string
}

const sizeMap = {
  sm: 'sm' as const,
  md: 'default' as const,
  lg: 'lg' as const,
}

const variantMap = {
  primary: 'flamingo-primary' as const,
  secondary: 'flamingo-secondary' as const,
  outline: 'outline' as const,
}

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
  )
}
