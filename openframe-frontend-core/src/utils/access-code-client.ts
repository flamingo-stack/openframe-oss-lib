/**
 * Access Code Client Utilities
 *
 * Simple client-side utilities for integrating access code validation
 * and consumption into registration forms.
 */

import React from 'react';
import {
  AccessCodeValidation,
  AccessCodeValidationResponse,
  AccessCodeConsumptionResponse
} from '../types/access-code-cohorts';

/**
 * Validate an access code for a given email
 *
 * @param email - User's email address
 * @param code - Access code to validate
 * @returns Promise with validation result
 *
 * @example
 * const result = await validateAccessCode('user@example.com', 'ABC123XY');
 * if (result.valid) {
 *   // Allow user to proceed with registration
 *   console.log(`Welcome to ${result.cohort_name}!`);
 * } else {
 *   // Show error message
 *   console.error(result.message);
 * }
 */
export async function validateAccessCode(
  email: string,
  code: string
): Promise<AccessCodeValidationResponse> {
  try {
    const response = await fetch('/api/validate-access-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code } as AccessCodeValidation),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Validation request failed');
    }

    return await response.json() as AccessCodeValidationResponse;
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

/**
 * Consume an access code after successful registration
 *
 * Call this ONLY after the user has successfully completed registration.
 * This marks the code as used and prevents further usage.
 *
 * @param email - User's email address
 * @param code - Access code to consume
 * @returns Promise with consumption result
 *
 * @example
 * // After successful registration
 * const result = await consumeAccessCode('user@example.com', 'ABC123XY');
 * if (result.consumed) {
 *   console.log('Access code consumed successfully');
 * } else {
 *   console.warn('Failed to consume access code:', result.message);
 * }
 */
export async function consumeAccessCode(
  email: string,
  code: string
): Promise<AccessCodeConsumptionResponse> {
  try {
    const response = await fetch('/api/consume-access-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code } as AccessCodeValidation),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Consumption request failed');
    }

    return await response.json() as AccessCodeConsumptionResponse;
  } catch (error) {
    return {
      success: false,
      consumed: false,
      message: error instanceof Error ? error.message : 'Consumption failed',
    };
  }
}

/**
 * Complete access code flow: validate then consume
 *
 * This is a convenience function that validates an access code and,
 * if valid, immediately consumes it. Use this when you want to
 * validate and consume in one step during registration.
 *
 * @param email - User's email address
 * @param code - Access code to validate and consume
 * @returns Promise with validation and consumption results
 *
 * @example
 * const result = await validateAndConsumeAccessCode('user@example.com', 'ABC123XY');
 * if (result.valid && result.consumed) {
 *   // Registration successful
 *   console.log(`Welcome to ${result.cohort_name}!`);
 * } else {
 *   console.error(result.message);
 * }
 */
export async function validateAndConsumeAccessCode(
  email: string,
  code: string
): Promise<AccessCodeValidationResponse & { consumed?: boolean }> {
  // First validate
  const validation = await validateAccessCode(email, code);

  if (!validation.valid) {
    return validation;
  }

  // If valid, consume the code
  const consumption = await consumeAccessCode(email, code);

  return {
    ...validation,
    consumed: consumption.consumed,
    message: consumption.consumed
      ? `Access granted for ${validation.cohort_name}`
      : consumption.message || validation.message,
  };
}

/**
 * Access Code Integration Hook (for React components)
 *
 * @example
 * const { validate, consume, isValidating, isConsuming } = useAccessCodeIntegration();
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
  const [isValidating, setIsValidating] = React.useState(false);
  const [isConsuming, setIsConsuming] = React.useState(false);

  const validate = async (email: string, code: string) => {
    setIsValidating(true);
    try {
      return await validateAccessCode(email, code);
    } finally {
      setIsValidating(false);
    }
  };

  const consume = async (email: string, code: string) => {
    setIsConsuming(true);
    try {
      return await consumeAccessCode(email, code);
    } finally {
      setIsConsuming(false);
    }
  };

  const validateAndConsume = async (email: string, code: string) => {
    setIsValidating(true);
    setIsConsuming(true);
    try {
      return await validateAndConsumeAccessCode(email, code);
    } finally {
      setIsValidating(false);
      setIsConsuming(false);
    }
  };

  return {
    validate,
    consume,
    validateAndConsume,
    isValidating,
    isConsuming,
    isProcessing: isValidating || isConsuming,
  };
}

