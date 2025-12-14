/**
 * URL ↔ Variables Converter for URL State Management
 *
 * Bidirectional conversion between URL parameters and GraphQL variables.
 * Handles type coercion, nested paths, and array parameters.
 */

import { FlattenedParam, shouldIncludeInUrl } from './flatten-schema'
import { JSType } from './graphql-parser'

/**
 * Convert URL search params to GraphQL variables
 *
 * Reads URL parameters and reconstructs the nested GraphQL variables object
 * based on the flattened schema mapping.
 *
 * @param searchParams - URLSearchParams from window.location or Next.js
 * @param schema - Flattened parameter schema
 * @returns GraphQL variables object ready for Apollo Client
 *
 * @example
 * URL: ?search=error&severity=critical&severity=error&cursor=abc
 * Schema: {
 *   search: { graphqlPath: 'search', type: 'string' },
 *   severity: { graphqlPath: 'filter.severity', type: 'array' },
 *   cursor: { graphqlPath: 'cursor', type: 'string' }
 * }
 * Result: {
 *   search: 'error',
 *   filter: { severity: ['critical', 'error'] },
 *   cursor: 'abc'
 * }
 */
export function urlParamsToVariables(
  searchParams: URLSearchParams,
  schema: Record<string, FlattenedParam>
): Record<string, any> {
  const variables: Record<string, any> = {}

  for (const [paramName, paramConfig] of Object.entries(schema)) {
    // Read value from URL
    const rawValue = paramConfig.type === 'array' || paramConfig.isArray
      ? searchParams.getAll(paramName)
      : searchParams.get(paramName)

    // Skip if no value in URL
    if (!rawValue || (Array.isArray(rawValue) && rawValue.length === 0)) {
      // Use default value if available
      if (paramConfig.defaultValue !== undefined) {
        setNestedValue(variables, paramConfig.graphqlPath, paramConfig.defaultValue)
      }
      continue
    }

    // Coerce value to correct type
    const value = coerceValue(rawValue, paramConfig.type)

    // Set value at nested path
    setNestedValue(variables, paramConfig.graphqlPath, value)
  }

  return variables
}

/**
 * Convert GraphQL variables to URL search params
 *
 * Flattens nested GraphQL variables to URL parameters based on schema mapping.
 * Excludes null/undefined/default values to keep URLs clean.
 *
 * @param variables - GraphQL variables object
 * @param schema - Flattened parameter schema
 * @returns URLSearchParams ready for router.push()
 *
 * @example
 * Variables: {
 *   search: 'error',
 *   filter: { severity: ['critical'], toolType: [] },
 *   cursor: null
 * }
 * Result URL: ?search=error&severity=critical
 * (empty arrays and null values excluded)
 */
export function variablesToUrlParams(
  variables: Record<string, any>,
  schema: Record<string, FlattenedParam>
): URLSearchParams {
  const params = new URLSearchParams()

  for (const [paramName, paramConfig] of Object.entries(schema)) {
    // Get value from nested path
    const value = getNestedValue(variables, paramConfig.graphqlPath)

    // Skip if should not include in URL
    if (!shouldIncludeInUrl(value, paramConfig)) {
      continue
    }

    // Add to URL params
    if (Array.isArray(value)) {
      // Array: Use repeated params (e.g., ?tag=foo&tag=bar)
      value.forEach(v => {
        if (v !== null && v !== undefined && v !== '') {
          params.append(paramName, String(v))
        }
      })
    } else {
      // Single value: Use set
      params.set(paramName, String(value))
    }
  }

  return params
}

/**
 * Coerce URL parameter value to correct JavaScript type
 *
 * @param value - Raw value from URLSearchParams (string or string[])
 * @param type - Target JavaScript type
 * @returns Coerced value
 */
export function coerceValue(value: string | string[], type: JSType): any {
  // Array handling
  if (Array.isArray(value)) {
    return value.map(v => coerceValue(v, type === 'array' ? 'string' : type))
  }

  // Type coercion for single values
  switch (type) {
    case 'number':
      const num = parseFloat(value)
      return isNaN(num) ? null : num

    case 'boolean':
      return value === 'true' || value === '1'

    case 'array':
      // Single value treated as array with one element
      return [value]

    case 'string':
    default:
      return value
  }
}

/**
 * Set value at nested path in object
 *
 * Creates intermediate objects as needed.
 *
 * @param obj - Target object to modify
 * @param path - Dot-separated path (e.g., "filter.severity")
 * @param value - Value to set
 *
 * @example
 * setNestedValue({}, 'filter.severity', ['error'])
 * // Result: { filter: { severity: ['error'] } }
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const parts = path.split('.')
  let current = obj

  // Navigate/create intermediate objects
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part]
  }

  // Set final value
  const lastPart = parts[parts.length - 1]
  current[lastPart] = value
}

/**
 * Get value from nested path in object
 *
 * Returns undefined if path doesn't exist.
 *
 * @param obj - Source object
 * @param path - Dot-separated path (e.g., "filter.severity")
 * @returns Value at path or undefined
 *
 * @example
 * getNestedValue({ filter: { severity: ['error'] } }, 'filter.severity')
 * // Result: ['error']
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current?.[key]
  }, obj)
}

/**
 * Merge URL parameters into existing variables
 *
 * Useful for updating specific parameters without losing others.
 *
 * @param currentVariables - Current GraphQL variables
 * @param updates - Parameter updates (flat object)
 * @param schema - Flattened parameter schema
 * @returns Updated variables object
 */
export function mergeVariables(
  currentVariables: Record<string, any>,
  updates: Record<string, any>,
  schema: Record<string, FlattenedParam>
): Record<string, any> {
  const merged = { ...currentVariables }

  for (const [paramName, value] of Object.entries(updates)) {
    const paramConfig = schema[paramName]
    if (!paramConfig) continue

    setNestedValue(merged, paramConfig.graphqlPath, value)
  }

  return merged
}

/**
 * Clear specific parameters from variables
 *
 * @param variables - Current GraphQL variables
 * @param paramNames - Parameter names to clear
 * @param schema - Flattened parameter schema
 * @returns Variables with specified params removed
 */
export function clearParams(
  variables: Record<string, any>,
  paramNames: string[],
  schema: Record<string, FlattenedParam>
): Record<string, any> {
  const cleared = { ...variables }

  for (const paramName of paramNames) {
    const paramConfig = schema[paramName]
    if (!paramConfig) continue

    // Set to undefined (will be excluded from URL)
    setNestedValue(cleared, paramConfig.graphqlPath, undefined)
  }

  return cleared
}

/**
 * Validate GraphQL variables against schema
 *
 * Checks for required parameters and type consistency.
 *
 * @param variables - GraphQL variables to validate
 * @param schema - Flattened parameter schema
 * @returns Validation errors (empty array if valid)
 */
export function validateVariables(
  variables: Record<string, any>,
  schema: Record<string, FlattenedParam>
): string[] {
  const errors: string[] = []

  for (const [paramName, paramConfig] of Object.entries(schema)) {
    const value = getNestedValue(variables, paramConfig.graphqlPath)

    // Check required parameters
    if (paramConfig.required && (value === null || value === undefined)) {
      errors.push(`Required parameter "${paramName}" is missing`)
    }

    // Check type consistency
    if (value !== null && value !== undefined) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      const expectedType = paramConfig.type === 'array' ? 'array' : paramConfig.type

      if (actualType !== expectedType && actualType !== 'object') {
        errors.push(
          `Parameter "${paramName}" has wrong type: expected ${expectedType}, got ${actualType}`
        )
      }
    }
  }

  return errors
}
