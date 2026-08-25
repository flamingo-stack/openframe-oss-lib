'use client';

import { getCountries } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { useHumanitySignals } from '../../hooks/use-humanity-signals';
import { useToast } from '../../hooks/use-toast';
import { cn } from '../../utils/cn';
import { formatPhoneE164 } from '../../utils/country-phone-utils';
import { hasGenericEmailDomain } from '../../utils/generic-domain-utils';
import type { HumanitySignals } from '../../utils/humanity-signals';
import { OpenFrameLogo } from '../icons';
import { Button } from '../ui/button';
import { CheckboxBlock } from '../ui/checkbox-block';
import { HoneypotField } from '../ui/honeypot-field';
import { Input } from '../ui/input';
import { PhoneInput } from '../ui/phone-input';

export interface WaitlistFormProps {
  /** Optional ID for the form container (for anchor links) */
  id?: string;
  /** Optional CSS classes for the container */
  className?: string;
  /**
   * Registration handler — called with email, optional E.164 phone, and the
   * invisible bot-protection signals (honeypot + timing) to forward into the
   * POST body. Must throw on failure (toast is handled by the form). `signals`
   * is optional for backward compatibility with older callers.
   */
  onRegister: (email: string, phone?: string, signals?: HumanitySignals) => Promise<void>;
  /** Whether a registration request is currently in flight */
  isSubmitting?: boolean;
  /** Whether registration completed successfully */
  isSuccess?: boolean;
  /** Pre-filled email (e.g. from auth context) */
  defaultEmail?: string;
  /** Pre-filled phone (e.g. from user profile) */
  defaultPhone?: string;
  /** Geo-detection API endpoint. Defaults to "/api/geo". Set to null to disable. */
  geoApiUrl?: string | null;
  /** Label on the submit button. Defaults to "Get Beta Access" */
  submitLabel?: string;
  /** Label shown after success. Defaults to "You're in!" */
  successLabel?: string;
  /** Label shown on the SMS consent checkbox */
  smsCheckboxLabel?: string;
  /** Warning shown when a generic email domain is detected */
  genericEmailHint?: string;
  /** Warning shown when phone validation fails */
  invalidPhoneHint?: string;
  /** URL for the Terms of Service link in the consent text */
  termsOfServiceUrl?: string;
  /** URL for the Privacy Policy link in the consent text */
  privacyPolicyUrl?: string;
  /** SMS consent text shown below the checkbox label */
  consentText?: string;
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
  id = 'waitlist-form',
  className,
  onRegister,
  isSubmitting = false,
  isSuccess = false,
  defaultEmail = '',
  defaultPhone = '',
  geoApiUrl = '/api/geo',
  submitLabel = 'Get Beta Access',
  successLabel = "You're in!",
  smsCheckboxLabel = 'Send me an SMS if my email gets caught by spam filters',
  genericEmailHint = 'Use a work email \u2014 personal emails may not be verified or approved.',
  invalidPhoneHint = 'Invalid phone number format.',
  termsOfServiceUrl,
  privacyPolicyUrl,
  consentText = 'I agree to receive recurring automated text messages at the phone number provided. Msg & data rates may apply. Msg frequency varies. Reply HELP for help and STOP to cancel.',
}: WaitlistFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [countryCode, setCountryCode] = useState<CountryCode>('US');
  const { toast } = useToast();
  const { honeypotInputProps, getSignals, resetSignals } = useHumanitySignals();
  const [smsConsent, setSmsConsent] = useState(false);
  const isClient = useIsHydrated();
  const [isPhoneInvalid, setIsPhoneInvalid] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);

  const isMailDomainGeneric = hasGenericEmailDomain(email);

  // Sync defaultEmail when it changes (e.g. auth loads). Adjusted while
  // rendering — React's documented prop-sync pattern — rather than from an
  // effect: the field renders from `email`, so an effect showed the empty box
  // for one frame after auth resolved and then filled it in.
  const [syncedDefaultEmail, setSyncedDefaultEmail] = useState(defaultEmail);
  if (syncedDefaultEmail !== defaultEmail) {
    setSyncedDefaultEmail(defaultEmail);
    if (defaultEmail) {
      setEmail(defaultEmail);
    }
  }

  // Geo detection (client-only; `isClient` above is the hydration gate).
  useEffect(() => {
    if (!geoApiUrl) return;

    // `getCountries()` IS the runtime source of truth for the `CountryCode`
    // union, so membership in it is the honest narrowing for a wire string —
    // the geo endpoint's body is untyped (`Response.json()` is `any`) and the
    // previous `country as CountryCode` asserted the very thing the `has`
    // check was there to establish.
    const supportedCountries = new Set<string>(getCountries());
    const isSupportedCountry = (value: string): value is CountryCode => supportedCountries.has(value);

    fetch(geoApiUrl)
      .then((res): Promise<unknown> => res.json())
      .then(body => {
        const country = typeof body === 'object' && body !== null && 'country' in body ? body.country : undefined;
        if (typeof country === 'string' && isSupportedCountry(country)) {
          setCountryCode(country);
        }
      })
      .catch(() => {
        /* keep default US */
      });
  }, [geoApiUrl]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!email.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    if (phone.trim() && !smsConsent) {
      setShowConsentError(true);
      return;
    }

    const finalPhone = phone ? formatPhoneE164(phone, countryCode) : undefined;

    try {
      await onRegister(email, finalPhone, getSignals());
      resetSignals();
    } catch {
      // caller's onRegister should handle its own error toasts if needed
    }
  };

  if (!isClient) {
    return (
      <div
        className={cn(
          'flex flex-col gap-[var(--spacing-system-l)] rounded-[6px] border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]',
          className,
        )}
      >
        {/* Email input skeleton */}
        <div className="h-12 w-full animate-pulse rounded-[6px] border border-ods-border bg-ods-card" />
        {/* Phone input skeleton */}
        <div className="flex w-full gap-[var(--spacing-system-xs)]">
          <div className="h-12 w-[130px] shrink-0 animate-pulse rounded-[6px] border border-ods-border bg-ods-card" />
          <div className="h-12 flex-1 animate-pulse rounded-[6px] border border-ods-border bg-ods-card" />
        </div>
        {/* Disclaimer + button skeleton */}
        <div className="flex w-full flex-col items-end gap-[var(--spacing-system-m)]">
          <div className="w-full animate-pulse rounded-[6px] border border-ods-border bg-ods-bg px-4 py-6" />
          <div className="h-12 w-[200px] animate-pulse rounded-[6px] border border-ods-border bg-ods-card" />
        </div>
      </div>
    );
  }

  const showEmailWarning = isMailDomainGeneric;
  const showPhoneWarning = isPhoneInvalid;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // `handleSubmit` never rejects — it try/catches `onRegister` itself.
      void handleSubmit();
    }
  };

  return (
    <div
      id={id}
      className={cn(
        'flex flex-col items-end gap-[var(--spacing-system-l)] rounded-[6px] border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]',
        className,
      )}
    >
      {/* Invisible honeypot — real users never fill it; bots that fill every field trip it. */}
      <HoneypotField {...honeypotInputProps} />

      {/* Email Input */}
      <Input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
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
          onPhoneChange={val => {
            setPhone(val);
            if (!val.trim()) setShowConsentError(false);
          }}
          onCountryChange={setCountryCode}
          onValidationChange={setIsPhoneInvalid}
          disabled={isSubmitting}
          placeholder="Phone (optional)"
          onKeyDown={handleKeyDown}
        />
        {showPhoneWarning && (
          <p
            className="absolute bottom-0 left-0 translate-y-full truncate text-ods-warning text-h6"
            title={invalidPhoneHint}
          >
            {invalidPhoneHint}
          </p>
        )}
      </div>
      {/* SMS Consent + Button Section */}
      <div className="flex w-full flex-col items-end gap-[var(--spacing-system-l)]">
        {/* SMS Consent Checkbox */}
        <CheckboxBlock
          checked={smsConsent}
          onCheckedChange={checked => {
            setSmsConsent(checked);
            if (checked) setShowConsentError(false);
          }}
          error={showConsentError ? 'Please agree to SMS notifications to continue.' : undefined}
          disabled={isSubmitting}
          label={smsCheckboxLabel}
          description={
            <>
              {consentText}
              {' View our '}
              <a
                href={termsOfServiceUrl || '#'}
                className="text-ods-accent underline"
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
              >
                Terms of Service
              </a>
              {' and '}
              <a
                href={privacyPolicyUrl || '#'}
                className="text-ods-accent underline"
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
              >
                Privacy Policy
              </a>
              .
            </>
          }
        />

        {/* Submit Button — right-aligned */}
        <Button
          type="button"
          loading={isSubmitting}
          disabled={isSubmitting}
          leftIcon={<OpenFrameLogo />}
          onClick={handleSubmit}
          className="w-full md:w-auto"
        >
          {isSuccess ? successLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
