/**
 * useApiParams Hook - REST API Integration for URL State Management
 *
 * Manual schema definition for REST APIs. Provides same URL sync functionality
 * as useQueryParams but without GraphQL dependency.
 *
 * @example
 * const { params, setParam } = useApiParams({
 *   search: { type: 'string', default: '' },
 *   page: { type: 'number', default: 1 },
 *   tags: { type: 'array', default: [] }
 * })
 *
 * fetch(`/api/items?${new URLSearchParams(params)}`)
 *
 * // URL: /items?search=laptop&page=2&tags=electronics&tags=sale
 * // params: { search: 'laptop', page: 2, tags: ['electronics', 'sale'] }
 */

'use client'

import { useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { JSType } from './graphql-parser'
import { FlattenedParam, shouldIncludeInUrl } from './flatten-schema'
import { coerceValue } from './url-converter'

/**
 * REST API parameter schema definition
 */
export interface ParamSchema {
  [key: string]: {
    /** JavaScript type for URL parameter */
    type: JSType
    /** Default value */
    default?: any
    /** Whether parameter is required */
    required?: boolean
  }
}

/**
 * Options for useApiParams hook
 */
export interface UseApiParamsOptions {
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Return type for useApiParams hook
 */
export interface UseApiParamsReturn<TParams = Record<string, any>> {
  /** Parsed parameters object */
  params: TParams

  /** URLSearchParams for fetch/axios */
  urlSearchParams: URLSearchParams

  /** Set a single parameter */
  setParam: (key: string, value: any) => void

  /** Set multiple parameters at once */
  setParams: (params: Record<string, any>) => void

  /** Clear specific parameters */
  clearParams: (keys: string[]) => void

  /** Reset all parameters (clear URL) */
  resetParams: () => void
}

/**
 * useApiParams - Manual URL state for REST APIs
 *
 * This hook:
 * 1. Reads URL search parameters
 * 2. Coerces to correct types based on schema
 * 3. Provides type-safe parameter updates
 * 4. Syncs changes to URL automatically
 *
 * @param schema - Parameter schema definition
 * @param options - Configuration options
 * @returns Hook API for managing URL state
 */
export function useApiParams<TParams = Record<string, any>>(
  schema: ParamSchema,
  options: UseApiParamsOptions = {}
): UseApiParamsReturn<TParams> {
  const router = useRouter()
  const searchParams = useSearchParams()
  const debug = options.debug || false

  // Convert schema to flattened format for reuse
  const flattenedSchema = useMemo((): Record<string, FlattenedParam> => {
    const flattened: Record<string, FlattenedParam> = {}

    for (const [key, config] of Object.entries(schema)) {
      flattened[key] = {
        urlParamName: key,
        graphqlPath: key,
        type: config.type,
        defaultValue: config.default,
        required: config.required,
        isArray: config.type === 'array'
      }
    }

    return flattened
  }, [schema])

  // Parse URL parameters with type coercion
  const params = useMemo((): TParams => {
    const result: Record<string, any> = {}

    for (const [key, config] of Object.entries(schema)) {
      // Read from URL
      const rawValue = config.type === 'array'
        ? searchParams.getAll(key)
        : searchParams.get(key)

      // Use value from URL or default
      if (rawValue && (Array.isArray(rawValue) ? rawValue.length > 0 : true)) {
        result[key] = coerceValue(rawValue, config.type)
      } else {
        result[key] = config.default
      }
    }

    if (debug) {
      console.log('[useApiParams] Parsed params:', result)
    }

    return result as TParams
  }, [searchParams, schema, debug])

  // Get URLSearchParams for fetch/axios
  const urlSearchParams = useMemo((): URLSearchParams => {
    const newParams = new URLSearchParams()

    for (const [key, config] of Object.entries(schema)) {
      const value = (params as Record<string, any>)[key]
      const paramConfig = flattenedSchema[key]

      // Skip if should not include
      if (!shouldIncludeInUrl(value, paramConfig)) {
        continue
      }

      // Add to params
      if (Array.isArray(value)) {
        value.forEach(v => {
          if (v !== null && v !== undefined && v !== '') {
            newParams.append(key, String(v))
          }
        })
      } else {
        newParams.set(key, String(value))
      }
    }

    return newParams
  }, [params, schema, flattenedSchema])

  // Update URL with new parameters (preserve other params not managed by this hook)
  const updateUrl = useCallback((newParams: URLSearchParams) => {
    // Preserve all existing params, then override with new ones
    const finalParams = new URLSearchParams(searchParams)

    // Override with new params from this hook
    newParams.forEach((value, key) => {
      finalParams.set(key, value)
    })

    // Remove params that were deleted (exist in schema but not in newParams)
    Object.keys(schema).forEach(key => {
      if (!newParams.has(key)) {
        finalParams.delete(key)
      }
    })

    const url = finalParams.toString() ? `?${finalParams.toString()}` : window.location.pathname

    if (debug) {
      console.log('[useApiParams] Updating URL:', url)
    }

    // Use replace for shallow routing (no page reload, no history spam)
    router.replace(url, { scroll: false })
  }, [router, debug, searchParams, schema])

  // Set a single parameter
  const setParam = useCallback((key: string, value: any) => {
    const newParams = new URLSearchParams(searchParams)
    const config = schema[key]

    if (!config) {
      console.warn(`[useApiParams] Unknown parameter: ${key}`)
      return
    }

    // Clear existing values
    newParams.delete(key)

    // Add new value(s)
    if (value === null || value === undefined || value === '') {
      // Remove from URL
    } else if (Array.isArray(value)) {
      value.forEach(v => {
        if (v !== null && v !== undefined && v !== '') {
          newParams.append(key, String(v))
        }
      })
    } else {
      newParams.set(key, String(value))
    }

    updateUrl(newParams)
  }, [searchParams, schema, updateUrl])

  // Set multiple parameters
  const setParams = useCallback((updates: Record<string, any>) => {
    const newParams = new URLSearchParams(searchParams)

    for (const [key, value] of Object.entries(updates)) {
      const config = schema[key]

      if (!config) {
        console.warn(`[useApiParams] Unknown parameter: ${key}`)
        continue
      }

      // Clear existing values
      newParams.delete(key)

      // Add new value(s)
      if (value === null || value === undefined || value === '') {
        // Remove from URL
      } else if (Array.isArray(value)) {
        value.forEach(v => {
          if (v !== null && v !== undefined && v !== '') {
            newParams.append(key, String(v))
          }
        })
      } else {
        newParams.set(key, String(value))
      }
    }

    updateUrl(newParams)
  }, [searchParams, schema, updateUrl])

  // Clear specific parameters
  const clearParams = useCallback((keys: string[]) => {
    const newParams = new URLSearchParams(searchParams)

    for (const key of keys) {
      newParams.delete(key)
    }

    updateUrl(newParams)
  }, [searchParams, updateUrl])

  // Reset all parameters
  const resetParams = useCallback(() => {
    if (debug) {
      console.log('[useApiParams] Resetting params')
    }

    router.replace(window.location.pathname, { scroll: false })
  }, [router, debug])

  return {
    params,
    urlSearchParams,
    setParam,
    setParams,
    clearParams,
    resetParams
  }
}

/**
 * Helper: Create URLSearchParams from object
 *
 * Handles arrays as repeated parameters
 *
 * @param params - Parameters object
 * @returns URLSearchParams
 */
export function createSearchParams(params: Record<string, any>): URLSearchParams {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach(v => {
        if (v !== null && v !== undefined && v !== '') {
          searchParams.append(key, String(v))
        }
      })
    } else {
      searchParams.set(key, String(value))
    }
  }

  return searchParams
}
