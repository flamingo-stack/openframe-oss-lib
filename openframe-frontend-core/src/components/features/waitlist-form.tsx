"use client"

import { OpenFrameLogo } from '../icons'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { PhoneInput } from '../ui/phone-input'
import { useToast } from '../../hooks/use-toast'
import { cn } from '../../utils/cn'
import { hasGenericEmailDomain } from '../../utils/generic-domain-utils'
import { formatPhoneE164 } from '../../utils/country-phone-utils'
import { getCountries } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'
import { useEffect, useState } from 'react'

export interface WaitlistFormProps {
  /** Optional ID for the form container (for anchor links) */
  id?: string
  /** Optional CSS classes for the container */
  className?: string
  /**
   * Registration handler — called with email and optional E.164 phone.
   * Must throw on failure (toast is handled by the form).
   */
  onRegister: (email: string, phone?: string) => Promise<void>
  /** Whether a registration request is currently in flight */
  isSubmitting?: boolean
  /** Whether registration completed successfully */
  isSuccess?: boolean
  /** Pre-filled email (e.g. from auth context) */
  defaultEmail?: string
  /** Geo-detection API endpoint. Defaults to "/api/geo". Set to null to disable. */
  geoApiUrl?: string | null
  /** Label on the submit button. Defaults to "Get Beta Access" */
  submitLabel?: string
  /** Label shown after success. Defaults to "You're in!" */
  successLabel?: string
  /** Hint shown in the disclaimer box */
  defaultHint?: string
  /** Warning shown when a generic email domain is detected */
  genericEmailHint?: string
  /** Warning shown when phone validation fails */
  invalidPhoneHint?: string
  /** URL for the privacy policy link in the disclaimer */
  privacyPolicyUrl?: string
  /** SMS consent text shown below the hint in the disclaimer box */
  consentText?: string
}

/**
 * WaitlistForm
 *
 * Platform-agnostic waitlist registration form.
 * All app-specific logic (auth, API calls, platform detection) is injected via props.
 *
 * Features:
 * - Email + optional phone with country code selector
 * - Generic email domain warning
 * - Phone validation warning
 * - Auto geo-detection for country code
 * - Enter key support
 * - Loading and success states
 * - Hydration-safe skeleton
 */
export function WaitlistForm({
  id = "waitlist-form",
  className,
  onRegister,
  isSubmitting = false,
  isSuccess = false,
  defaultEmail = '',
  geoApiUrl = '/api/geo',
  submitLabel = 'Get Beta Access',
  successLabel = "You're in!",
  defaultHint = "MSP spam filters are aggressive. Drop your number in case email fails.",
  genericEmailHint = "Use a work email \u2014 personal emails may not be verified or approved.",
  invalidPhoneHint = "Invalid phone number format.",
  privacyPolicyUrl,
  consentText = "I agree to receive recurring automated text messages at the phone number provided. Msg & data rates may apply. Msg frequency varies. Reply HELP for help and STOP to cancel.",
}: WaitlistFormProps) {
  const [email, setEmail] = useState(defaultEmail)
  const [phone, setPhone] = useState('')
  const [countryCode, setCountryCode] = useState<CountryCode>('US')
  const { toast } = useToast()
  const [isClient, setIsClient] = useState(false)
  const [isPhoneInvalid, setIsPhoneInvalid] = useState(false)

  const isMailDomainGeneric = hasGenericEmailDomain(email)

  // Sync defaultEmail when it changes (e.g. auth loads)
  useEffect(() => {
    if (defaultEmail) {
      setEmail(defaultEmail)
    }
  }, [defaultEmail])

  // Client-side hydration + geo detection
  useEffect(() => {
    setIsClient(true)
    if (!geoApiUrl) return

    const supportedCountries = new Set(getCountries())
    fetch(geoApiUrl)
      .then(res => res.json())
      .then(({ country }) => {
        if (country && supportedCountries.has(country)) {
          setCountryCode(country as CountryCode)
        }
      })
      .catch(() => { /* keep default US */ })
  }, [geoApiUrl])

  const handleSubmit = async () => {
    if (isSubmitting) return
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter a valid email address.',
        variant: 'destructive'
      })
      return
    }

    const finalPhone = phone ? formatPhoneE164(phone, countryCode) : undefined

    try {
      await onRegister(email, finalPhone)
    } catch {
      // caller's onRegister should handle its own error toasts if needed
    }
  }

  if (!isClient) {
    return (
      <div className={cn(
        "flex flex-col gap-[var(--spacing-system-l)] rounded-[6px] border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]",
        className
      )}>
        {/* Email input skeleton */}
        <div className="w-full h-12 bg-ods-card border border-ods-border rounded-[6px] animate-pulse" />
        {/* Phone input skeleton */}
        <div className="flex gap-[var(--spacing-system-xs)] w-full">
          <div className="w-[130px] h-12 bg-ods-card border border-ods-border rounded-[6px] animate-pulse shrink-0" />
          <div className="flex-1 h-12 bg-ods-card border border-ods-border rounded-[6px] animate-pulse" />
        </div>
        {/* Disclaimer + button skeleton */}
        <div className="flex flex-col gap-[var(--spacing-system-m)] items-end w-full">
          <div className="w-full rounded-[6px] border border-ods-border bg-ods-bg animate-pulse py-6 px-4" />
          <div className="h-12 w-[200px] bg-ods-card border border-ods-border rounded-[6px] animate-pulse" />
        </div>
      </div>
    )
  }

  const showEmailWarning = isMailDomainGeneric
  const showPhoneWarning = isPhoneInvalid

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      id={id}
      className={cn(
        "flex flex-col gap-[var(--spacing-system-l)] items-end rounded-[6px] border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]",
        className
      )}
    >
      {/* Email Input */}
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={isSubmitting}
        placeholder="Enter your Business Email"
        onKeyDown={handleKeyDown}
        error={showEmailWarning ? genericEmailHint : undefined}
        errorVariant="warning"
      />

      {/* Phone Input */}
      <div className="relative w-full">
        <PhoneInput
          value={phone}
          countryCode={countryCode}
          onPhoneChange={setPhone}
          onCountryChange={setCountryCode}
          onValidationChange={setIsPhoneInvalid}
          disabled={isSubmitting}
          placeholder="Phone (optional)"
          onKeyDown={handleKeyDown}
        />
        {showPhoneWarning && (
          <p className="text-h6 absolute bottom-0 left-0 translate-y-full text-[var(--ods-attention-yellow-warning)] truncate">
            {invalidPhoneHint}
          </p>
        )}
      </div>
      {/* Disclaimer + Button Section */}
      <div className="flex flex-col gap-4 items-end w-full">

        {/* Disclaimer Box */}
        <div className="w-full rounded-[6px] border border-ods-border bg-ods-bg px-4 py-3">
          <p className="text-h6 font-medium text-ods-text-primary leading-5">
            {defaultHint}
          </p>
          <p className="text-h6 font-medium text-ods-text-secondary leading-5">
            {consentText}
            {privacyPolicyUrl && (
              <>
                &nbsp;
                <a
                  href={privacyPolicyUrl}
                  className="text-[var(--color-accent-primary)] underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </>
            )}
          </p>
        </div>

        {/* Submit Button — right-aligned */}
        <Button
          type="button"
          loading={isSubmitting}
          disabled={isSubmitting}
          leftIcon={<OpenFrameLogo />}
          onClick={handleSubmit}
          className="w-full @2xl:w-auto"
        >
          {isSuccess ? successLabel : submitLabel}
        </Button>
      </div>
    </div>
  )
}
