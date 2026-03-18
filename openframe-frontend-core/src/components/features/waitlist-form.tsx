"use client"

import { OpenFrameLogo } from '../icons'
import { InfoCircleIcon } from '../icons-v2-generated'
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
  /** Hint shown below inputs when no warning is active */
  defaultHint?: string
  /** Warning shown when a generic email domain is detected */
  genericEmailHint?: string
  /** Warning shown when phone validation fails */
  invalidPhoneHint?: string
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
      <div className={cn("flex flex-col md:flex-row items-center gap-3 md:gap-4 w-full max-w-md", className)}>
        <div className="w-full md:flex-1 h-12 bg-ods-card border border-ods-border rounded-md animate-pulse" />
        <div className="w-full md:w-auto h-12 min-w-[160px] bg-[#FFC008] rounded-md animate-pulse opacity-50" />
      </div>
    )
  }

  const showEmailWarning = isMailDomainGeneric
  const showPhoneWarning = !showEmailWarning && isPhoneInvalid

  const hintMessage = showEmailWarning
    ? genericEmailHint
    : showPhoneWarning
      ? invalidPhoneHint
      : defaultHint

  const hintColor = (showEmailWarning || showPhoneWarning)
    ? "text-[var(--ods-attention-yellow-warning)]"
    : "text-white"
  const showIcon = showEmailWarning || showPhoneWarning

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div id={id} className={cn("flex flex-col gap-2 w-full", className)}>
      <div className="flex flex-col items-center gap-3 md:gap-4 w-full">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isSubmitting}
          placeholder="Enter your Email"
          onKeyDown={handleKeyDown}
        />

        <PhoneInput
          value={phone}
          countryCode={countryCode}
          onPhoneChange={setPhone}
          onCountryChange={setCountryCode}
          onValidationChange={setIsPhoneInvalid}
          disabled={isSubmitting}
          placeholder="Phone Number (optional)"
          onKeyDown={handleKeyDown}
        />

        <div className="flex items-center justify-between w-full gap-4 md:flex-row flex-col">
          <p className={cn("text-h6 flex items-center gap-[var(--spacing-system-xs)] text-left w-full", hintColor)}>
            {showIcon && <InfoCircleIcon size={16} className="shrink-0" />}
            {hintMessage}
          </p>
          <Button
            type="button"
            loading={isSubmitting}
            disabled={isSubmitting}
            leftIcon={<OpenFrameLogo />}
            onClick={handleSubmit}
          >
            {isSuccess ? successLabel : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
