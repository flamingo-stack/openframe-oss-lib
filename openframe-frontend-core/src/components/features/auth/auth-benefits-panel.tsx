'use client'

import * as React from 'react'
import { cn } from '../../../utils/cn'
import { OpenFrameLogo } from '../../icons'
import { CreditCardXmarkIcon } from '../../icons-v2-generated/finance/credit-card-xmark-icon'
import { FileOffIcon } from '../../icons-v2-generated/documents/file-off-icon'
import { FlaskVialIcon } from '../../icons-v2-generated/school/flask-vial-icon'
import { XmarkAltIcon } from '../../icons-v2-generated/signs-and-symbols/xmark-alt-icon'
import { Button } from '../../ui/button'

export interface AuthBenefit {
  icon: React.ReactNode
  label: string
}

export interface AuthBenefitsPanelProps {
  title?: string
  description?: string
  benefits?: AuthBenefit[]
  learnMoreLabel?: string
  learnMoreUrl?: string
  className?: string
}

const DEFAULT_TITLE = 'The All-in-One Open Platform for MSPs'

const DEFAULT_DESCRIPTION =
  'All your core ops in one place - built for MSPs who are done duct-taping tools together. Unified stack, AI-ready, no vendor tax. Just solid software that lets you run lean and fast.'

const DEFAULT_BENEFITS: AuthBenefit[] = [
  { icon: <CreditCardXmarkIcon />, label: 'No card required' },
  { icon: <XmarkAltIcon />, label: 'Cancel Anytime' },
  { icon: <FlaskVialIcon />, label: '14 day free trial' },
  { icon: <FileOffIcon />, label: 'No Contract' },
]

/**
 * Marketing panel shown alongside the auth forms — title, blurb, benefit chips
 * and a "learn more" link. Presentational; content is overridable via props.
 */
export function AuthBenefitsPanel({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  benefits = DEFAULT_BENEFITS,
  learnMoreLabel = 'Learn More About OpenFrame',
  learnMoreUrl = 'https://www.flamingo.run/',
  className,
}: AuthBenefitsPanelProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-[var(--spacing-system-xl)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-xl)]',
        className,
      )}
    >
      <h2 className="text-h2 text-ods-text-primary tracking-[-0.64px]">{title}</h2>
      <p className="text-h4 text-ods-text-primary">{description}</p>

      <div className="flex flex-wrap content-center items-center gap-[var(--spacing-system-m)]">
        {benefits.map((benefit) => (
          <div key={benefit.label} className="flex items-center gap-[var(--spacing-system-xs)]">
            <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary [&_svg]:size-4">
              {benefit.icon}
            </span>
            <span className="whitespace-nowrap text-h4 text-ods-text-primary">{benefit.label}</span>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        href={learnMoreUrl}
        openInNewTab
        leftIcon={
          <OpenFrameLogo
            className="h-6 w-6"
            lowerPathColor="var(--color-accent-primary)"
            upperPathColor="var(--color-text-primary)"
          />
        }
        className="w-full md:w-auto md:self-start"
      >
        {learnMoreLabel}
      </Button>
    </div>
  )
}
