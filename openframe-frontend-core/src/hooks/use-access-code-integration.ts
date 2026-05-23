'use client'

/**
 * Access Code Integration Hook
 *
 * React-side wrapper around the pure `access-code-client` utilities.
 * Lives in `hooks/` (client bundle) so the `createContext()` call in
 * `endpoints-runtime-context` doesn't get pulled into the server-safe
 * `utils/index` bundle.
 *
 * The pure standalone functions (`validateAccessCode`,
 * `consumeAccessCode`, `validateAndConsumeAccessCode`) remain importable
 * from `@flamingo-stack/openframe-frontend-core/utils` — they take the
 * endpoints object as an argument. This hook binds those endpoints from
 * `EndpointsRuntimeContext` so React callers don't have to plumb URLs.
 */

import React from 'react'

import { useRequiredEndpointsRuntime } from '../contexts/endpoints-runtime-context'
import {
  validateAccessCode,
  consumeAccessCode,
  validateAndConsumeAccessCode,
} from '../utils/access-code-client'

/**
 * Resolves access-code endpoints from `EndpointsRuntimeContext` (throws
 * if no provider is mounted) and exposes loading-state-aware wrappers
 * around the standalone helpers in `utils/access-code-client`.
 *
 * @returns the following fields. The `validate` / `consume` /
 *   `validateAndConsume` functions and the returned object identity are
 *   NOT memoized — they're re-created each render. Wrap with
 *   `useCallback` / `useMemo` at the call site if downstream effect
 *   dep arrays depend on stable identities.
 *   - `validate(email, code)`: validates only.
 *   - `consume(email, code)`: consumes only.
 *   - `validateAndConsume(email, code)`: one-step validate-then-consume.
 *   - `isValidating: boolean`: a validate call is in flight.
 *   - `isConsuming: boolean`: a consume call is in flight.
 *   - `isProcessing: boolean`: convenience — `isValidating || isConsuming`.
 *     Use this for a single "in-flight" indicator on UI affordances that
 *     should disable during both phases.
 *
 * @example
 * const { validate, consume, isProcessing } = useAccessCodeIntegration();
 *
 * const handleRegistration = async (formData) => {
 *   const validation = await validate(formData.email, formData.accessCode);
 *   if (!validation.valid) {
 *     setError(validation.message);
 *     return;
 *   }
 *
 *   // Process registration...
 *   const registrationResult = await registerUser(formData);
 *
 *   if (registrationResult.success) {
 *     await consume(formData.email, formData.accessCode);
 *   }
 * };
 */
export function useAccessCodeIntegration() {
  const runtime = useRequiredEndpointsRuntime()
  const endpoints = runtime.accessCode
  const [isValidating, setIsValidating] = React.useState(false)
  const [isConsuming, setIsConsuming] = React.useState(false)

  const validate = async (email: string, code: string) => {
    setIsValidating(true)
    try {
      return await validateAccessCode(email, code, endpoints)
    } finally {
      setIsValidating(false)
    }
  }

  const consume = async (email: string, code: string) => {
    setIsConsuming(true)
    try {
      return await consumeAccessCode(email, code, endpoints)
    } finally {
      setIsConsuming(false)
    }
  }

  const validateAndConsume = async (email: string, code: string) => {
    setIsValidating(true)
    setIsConsuming(true)
    try {
      return await validateAndConsumeAccessCode(email, code, endpoints)
    } finally {
      setIsValidating(false)
      setIsConsuming(false)
    }
  }

  return {
    validate,
    consume,
    validateAndConsume,
    isValidating,
    isConsuming,
    isProcessing: isValidating || isConsuming,
  }
}
