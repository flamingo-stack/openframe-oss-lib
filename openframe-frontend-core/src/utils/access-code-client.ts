/**
 * Access Code Client Utilities — pure standalone functions.
 *
 * Endpoint paths are NOT hardcoded — every function takes an
 * `endpoints` argument. The React-side wrapper that binds them from
 * `EndpointsRuntimeContext` lives separately at
 * `hooks/use-access-code-integration.ts` (`useAccessCodeIntegration`).
 *
 * Keep this file **free of React imports** — it lives in the
 * server-safe `utils/index` tsup bundle. Any module-top-level call
 * into `createContext()` (which the runtime context file does) would
 * be pulled into the server bundle and crash SSR with
 * `createContext is not a function`.
 */

import {
  AccessCodeValidation,
  AccessCodeValidationResponse,
  AccessCodeConsumptionResponse
} from '../types/access-code-cohorts';

/** Endpoints required by the standalone client utilities. The
 *  `useAccessCodeIntegration` hook (in `hooks/`) resolves these from
 *  `EndpointsRuntimeContext.accessCode` automatically. */
export interface AccessCodeEndpoints {
  validateUrl: string
  consumeUrl: string
}

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
  code: string,
  endpoints: AccessCodeEndpoints,
): Promise<AccessCodeValidationResponse> {
  try {
    const response = await fetch(endpoints.validateUrl, {
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
  code: string,
  endpoints: AccessCodeEndpoints,
): Promise<AccessCodeConsumptionResponse> {
  try {
    const response = await fetch(endpoints.consumeUrl, {
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
  code: string,
  endpoints: AccessCodeEndpoints,
): Promise<AccessCodeValidationResponse & { consumed?: boolean }> {
  // First validate
  const validation = await validateAccessCode(email, code, endpoints);

  if (!validation.valid) {
    return validation;
  }

  // If valid, consume the code
  const consumption = await consumeAccessCode(email, code, endpoints);

  return {
    ...validation,
    consumed: consumption.consumed,
    message: consumption.consumed
      ? `Access granted for ${validation.cohort_name}`
      : consumption.message || validation.message,
  };
}

// `useAccessCodeIntegration` (the React-side wrapper) lives in
// `hooks/use-access-code-integration.ts`. It binds the endpoints from
// `EndpointsRuntimeContext` so React callers don't have to plumb URLs.
