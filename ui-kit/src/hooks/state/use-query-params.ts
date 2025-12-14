/**
 * useQueryParams Hook - GraphQL Integration for URL State Management
 *
 * Automatically generates URL state management from GraphQL queries.
 * Parses query AST at runtime, flattens nested input types, and syncs with URL.
 *
 * @example
 * const LOGS_QUERY = gql`
 *   query GetLogs($search: String, $filter: LogFilterInput) { ... }
 * `
 *
 * const { variables, setParam } = useQueryParams(LOGS_QUERY)
 * const { data } = useQuery(LOGS_QUERY, { variables })
 *
 * // URL: /logs?search=error&severity=critical
 * // variables: { search: 'error', filter: { severity: ['critical'] } }
 */

'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DocumentNode } from 'graphql'

import { extractVariablesFromQuery } from './graphql-parser'
import { flattenQueryVariables, mergeDefaults, validateSchema, FlattenedParam } from './flatten-schema'
import { urlParamsToVariables, variablesToUrlParams, mergeVariables, clearParams } from './url-converter'
import { introspector } from './introspection'

/**
 * Options for useQueryParams hook
 */
export interface UseQueryParamsOptions {
  /** Default values for parameters */
  defaultValues?: Record<string, any>

  /** GraphQL endpoint for introspection (defaults to process.env.NEXT_PUBLIC_API_URL/graphql) */
  introspectionEndpoint?: string

  /** HTTP headers for introspection (e.g., authentication) */
  introspectionHeaders?: Record<string, string>

  /** Skip introspection (use only AST parsing, no nested type flattening) */
  skipIntrospection?: boolean

  /** Custom parameter name mapping (override auto-generated names) */
  paramMapping?: Record<string, string>

  /** Enable debug logging */
  debug?: boolean
}

/**
 * Return type for useQueryParams hook
 */
export interface UseQueryParamsReturn<TVariables = Record<string, any>> {
  /** GraphQL variables ready for Apollo Client */
  variables: TVariables

  /** Raw URL parameters (before conversion to variables) */
  params: Record<string, any>

  /** Flattened parameter schema */
  schema: Record<string, FlattenedParam>

  /** Set a single parameter */
  setParam: (key: string, value: any) => void

  /** Set multiple parameters at once */
  setParams: (params: Record<string, any>) => void

  /** Clear specific parameters */
  clearParams: (keys: string[]) => void

  /** Reset all parameters (clear URL) */
  resetParams: () => void

  /** Whether schema is ready (introspection complete) */
  isReady: boolean

  /** Loading state during initialization */
  isLoading: boolean

  /** Error during initialization */
  error: Error | null
}

/**
 * useQueryParams - Auto-generate URL state from GraphQL query
 *
 * This hook:
 * 1. Parses GraphQL query AST to extract variable definitions
 * 2. Fetches GraphQL schema via introspection (optional, cached)
 * 3. Flattens nested input types to simple URL parameters
 * 4. Syncs URL ↔ GraphQL variables bidirectionally
 * 5. Provides type-safe parameter updates
 *
 * @param query - GraphQL DocumentNode (from gql`` template tag)
 * @param options - Configuration options
 * @returns Hook API for managing URL state
 */
export function useQueryParams<TVariables = Record<string, any>>(
  query: DocumentNode,
  options: UseQueryParamsOptions = {}
): UseQueryParamsReturn<TVariables> {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [schema, setSchema] = useState<Record<string, FlattenedParam>>({})

  // Extract default values
  const defaultValues = options.defaultValues || {}
  const skipIntrospection = options.skipIntrospection || false
  const debug = options.debug || false

  // Initialize: Parse query + fetch schema (once)
  useEffect(() => {
    async function initialize() {
      try {
        if (debug) console.log('[useQueryParams] Initializing...')

        // 1. Extract variables from query AST
        const queryVariables = extractVariablesFromQuery(query)

        if (debug) {
          console.log('[useQueryParams] Extracted variables:', queryVariables)
        }

        // 2. Fetch GraphQL schema via introspection (if needed and not skipped)
        if (!skipIntrospection && !introspector.isLoaded()) {
          const endpoint = options.introspectionEndpoint ||
            (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
              ? `${process.env.NEXT_PUBLIC_API_URL}/graphql`
              : '')

          if (endpoint) {
            try {
              await introspector.fetchSchema(endpoint, options.introspectionHeaders)
              if (debug) console.log('[useQueryParams] Introspection complete')
            } catch (err) {
              console.warn('[useQueryParams] Introspection failed, continuing without it:', err)
              // Continue without introspection - nested types won't be flattened
            }
          }
        }

        // 3. Flatten schema (with or without introspection)
        let flattenedSchema = await flattenQueryVariables(queryVariables, introspector)

        // Apply custom param mapping if provided
        if (options.paramMapping) {
          flattenedSchema = applyParamMapping(flattenedSchema, options.paramMapping)
        }

        // Merge default values
        flattenedSchema = mergeDefaults(flattenedSchema, defaultValues)

        // Validate schema
        validateSchema(flattenedSchema)

        if (debug) {
          console.log('[useQueryParams] Flattened schema:', flattenedSchema)
        }

        setSchema(flattenedSchema)
        setIsReady(true)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('[useQueryParams] Initialization failed:', error)
        setError(error)
      } finally {
        setIsLoading(false)
      }
    }

    initialize()
  }, [query, options.introspectionEndpoint, skipIntrospection, debug])

  // Convert URL params to GraphQL variables
  const variables = useMemo(() => {
    if (!isReady) {
      return defaultValues as TVariables
    }

    try {
      const varsFromUrl = urlParamsToVariables(searchParams, schema)
      const merged = { ...defaultValues, ...varsFromUrl }

      if (debug) {
        console.log('[useQueryParams] Variables from URL:', merged)
      }

      return merged as TVariables
    } catch (err) {
      console.error('[useQueryParams] Failed to convert URL to variables:', err)
      return defaultValues as TVariables
    }
  }, [searchParams, schema, isReady, defaultValues, debug])

  // Raw URL params (before conversion)
  const params = useMemo(() => {
    const result: Record<string, any> = {}
    searchParams.forEach((value, key) => {
      if (result[key]) {
        // Multiple values - convert to array
        if (!Array.isArray(result[key])) {
          result[key] = [result[key]]
        }
        result[key].push(value)
      } else {
        result[key] = value
      }
    })
    return result
  }, [searchParams])

  // Update URL with new parameters
  const updateUrl = useCallback((newParams: URLSearchParams) => {
    const url = newParams.toString() ? `?${newParams.toString()}` : window.location.pathname

    if (debug) {
      console.log('[useQueryParams] Updating URL:', url)
    }

    // Use replace for shallow routing (no page reload, no history spam)
    router.replace(url, { scroll: false })
  }, [router, debug])

  // Set a single parameter
  const setParam = useCallback((key: string, value: any) => {
    if (!isReady) {
      console.warn('[useQueryParams] Schema not ready, cannot set param')
      return
    }

    try {
      const currentVars = variables
      const updated = mergeVariables(currentVars as Record<string, any>, { [key]: value }, schema)
      const newParams = variablesToUrlParams(updated, schema)
      updateUrl(newParams)
    } catch (err) {
      console.error('[useQueryParams] Failed to set param:', err)
    }
  }, [variables, schema, isReady, updateUrl])

  // Set multiple parameters
  const setParams = useCallback((updates: Record<string, any>) => {
    if (!isReady) {
      console.warn('[useQueryParams] Schema not ready, cannot set params')
      return
    }

    try {
      const currentVars = variables
      const updated = mergeVariables(currentVars as Record<string, any>, updates, schema)
      const newParams = variablesToUrlParams(updated, schema)
      updateUrl(newParams)
    } catch (err) {
      console.error('[useQueryParams] Failed to set params:', err)
    }
  }, [variables, schema, isReady, updateUrl])

  // Clear specific parameters
  const clearParamsHandler = useCallback((keys: string[]) => {
    if (!isReady) {
      console.warn('[useQueryParams] Schema not ready, cannot clear params')
      return
    }

    try {
      const currentVars = variables
      const updated = clearParams(currentVars as Record<string, any>, keys, schema)
      const newParams = variablesToUrlParams(updated, schema)
      updateUrl(newParams)
    } catch (err) {
      console.error('[useQueryParams] Failed to clear params:', err)
    }
  }, [variables, schema, isReady, updateUrl])

  // Reset all parameters
  const resetParams = useCallback(() => {
    if (debug) {
      console.log('[useQueryParams] Resetting params')
    }

    router.replace(window.location.pathname, { scroll: false })
  }, [router, debug])

  return {
    variables,
    params,
    schema,
    setParam,
    setParams,
    clearParams: clearParamsHandler,
    resetParams,
    isReady,
    isLoading,
    error
  }
}

/**
 * Apply custom parameter name mapping to schema
 */
function applyParamMapping(
  schema: Record<string, FlattenedParam>,
  mapping: Record<string, string>
): Record<string, FlattenedParam> {
  const mapped: Record<string, FlattenedParam> = {}

  for (const [key, param] of Object.entries(schema)) {
    const newKey = mapping[key] || key
    mapped[newKey] = {
      ...param,
      urlParamName: mapping[key] || param.urlParamName
    }
  }

  return mapped
}
