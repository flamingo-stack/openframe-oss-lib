'use client'

import { ChevronLeft } from 'lucide-react'
import React from 'react'
import { cn } from '../../utils/cn'
import type { ActionsMenuGroup } from '../ui/actions-menu'
import { Button } from '../ui/button'
import { PageActions, type PageActionButton } from '../ui/page-actions'

function getInitials(name?: string): string {
  if (!name) return ''
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase()
}

export interface TitleBlockProps {
  title?: string
  subtitle?: string
  image?: { src: string; alt?: string }
  backButton?: { label?: string; onClick: () => void }
  actions?: PageActionButton[]
  actionsVariant?: 'icon-buttons' | 'primary-buttons' | 'menu-primary'
  menuActions?: ActionsMenuGroup[]
  /** Desktop-only slot (e.g. a `TabSelector`) rendered with the actions. Hidden on mobile. */
  selector?: React.ReactNode
  /**
   * Visual variant.
   * - `plain` (default): transparent background, no border.
   * - `card`: card background, border, and padding on mobile only — collapses to plain on md+.
   */
  variant?: 'plain' | 'card'
  className?: string
}

export function TitleBlock({
  title,
  subtitle,
  image,
  backButton,
  actions,
  actionsVariant = 'icon-buttons',
  menuActions,
  selector,
  variant = 'plain',
  className,
}: TitleBlockProps) {
  const hasActions = actions && actions.length > 0
  const [imageFailed, setImageFailed] = React.useState(false)

  React.useEffect(() => {
    setImageFailed(false)
  }, [image?.src])

  const showImageFallback = !!image && (imageFailed || !image.src)
  const initials = getInitials(image?.alt || title)

  return (
    <div
      className={cn(
        'flex items-end justify-between gap-[var(--spacing-system-m)]',
        'md:flex-col md:items-start md:justify-start lg:flex-row lg:items-end lg:justify-between',
        'pt-[var(--spacing-system-l)]',
        variant === 'card'
          ? cn(
              'bg-ods-card border-b border-ods-border',
              'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
              'md:bg-transparent md:border-b-0',
              'md:px-0 md:pb-0',
              'md:mb-[var(--spacing-system-l)]',
            )
          : 'mb-[var(--spacing-system-l)]',
        className,
      )}
    >
      <div className="flex flex-col gap-[var(--spacing-system-xs)] flex-1 min-w-0">
        {backButton && (
          <Button
            onClick={backButton.onClick}
            variant="transparent"
            className="self-start justify-start hidden md:flex"
            leftIcon={<ChevronLeft className="size-6" />}
            noPaddingX
          >
            {backButton.label || 'Back'}
          </Button>
        )}
        {(image || subtitle) ? (
          <div className="flex items-center gap-[var(--spacing-system-m)] min-w-0 w-full">
            {image && (
              showImageFallback ? (
                <div
                  aria-label={image.alt}
                  className="size-[52px] md:size-[60px] shrink-0 rounded-md border border-ods-border bg-ods-bg flex items-center justify-center text-ods-text-secondary text-h4 select-none"
                >
                  {initials || '?'}
                </div>
              ) : (
                <img
                  src={image.src}
                  alt={image.alt ?? ''}
                  onError={() => setImageFailed(true)}
                  className="size-[52px] md:size-[60px] shrink-0 rounded-md border border-ods-border object-cover"
                />
              )
            )}
            <div className="flex flex-col justify-center min-w-0 flex-1">
              {title && (
                <h1 className="text-h2 text-ods-text-primary truncate">{title}</h1>
              )}
              {subtitle && (
                <p className="text-h6 text-ods-text-secondary truncate">{subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          title && <h1 className="text-h2 text-ods-text-primary">{title}</h1>
        )}
      </div>

      {(hasActions || selector) && (
        <div className="flex gap-2 items-center shrink-0">
          <PageActions
            variant={actionsVariant}
            actions={actions ?? []}
            menuActions={menuActions}
            selector={selector}
          />
        </div>
      )}
    </div>
  )
}

export default TitleBlock
