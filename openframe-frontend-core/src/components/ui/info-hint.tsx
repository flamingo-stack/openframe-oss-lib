'use client'

import * as React from 'react'
import { Info } from 'lucide-react'
import { Button } from './button'
import { FloatingTooltip } from './floating-tooltip'
import { cn } from '../../utils/cn'

export interface InfoHintProps {
  children: React.ReactNode
  /** What this hint is ABOUT — 15 buttons all named "More information" name nothing. */
  label?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

/**
 * The "what does this mean?" affordance — an ⓘ icon that reveals a definition
 * on hover.
 *
 * Config-heavy screens carry vocabulary that is obvious to whoever built the
 * feature and opaque to everyone else — `judged`, `deterministic`, `observe`,
 * `error`. A term nobody can define is a term nobody configures correctly, so
 * every one of them gets a hint rather than a wiki page somebody has to go find.
 *
 * This is a thin cap over `FloatingTooltip`, not a second tooltip: it fixes the
 * icon, the trigger element and the sizing so every hint looks and behaves the
 * same. All the hover/portal/placement behaviour is the shared component's.
 */
export function InfoHint({ children, label, side = 'top', className }: InfoHintProps) {
  const describedById = React.useId()
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)}>
      <FloatingTooltip
        content={children}
        side={side}
        as="span"
        triggerClassName="inline-flex shrink-0 items-center"
        className="max-w-[280px] text-h6"
      >
        {/*
          `icon-inline` is a Button variant, not a className stack. The hint sits
          inside a line of badges, so `icon-sm`'s 32px target would swamp a 10px
          badge — and shrinking it at the call site is exactly the override the
          house rule forbids.
        */}
        <Button
          type="button"
          variant="transparent"
          size="icon-inline"
          // A hint lives inside interactive rows (e.g. a role="checkbox" rule
          // row): asking "what does this mean?" must never toggle the row it
          // sits in.
          onClick={(e) => e.stopPropagation()}
          aria-label={label ? `About ${label}` : 'More information'}
          aria-describedby={describedById}
          className="text-ods-text-secondary hover:text-ods-text-primary"
        >
          <Info className="h-3.5 w-3.5 shrink-0" />
        </Button>
      </FloatingTooltip>
      {/*
        The tooltip opens on HOVER only — `FloatingTooltip` composes
        `useHover`/`useDismiss`/`useRole` and no `useFocus`, so a keyboard user
        tabbing here would otherwise reach a button that reveals nothing. This
        visually-hidden copy is the same text, exposed via `aria-describedby`,
        so assistive tech reads the definition without depending on hover.
      */}
      <span id={describedById} className="sr-only">
        {children}
      </span>
    </span>
  )
}
