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

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useRef } from 'react'
import { FlattenedParam, shouldIncludeInUrl } from './flatten-schema'
import { JSType } from './graphql-parser'
import { coerceValue } from './url-converter'

/**
 * Returns the previous reference if the JSON-serialized content of `value`
 * hasn't changed across renders. Internal helper used to shield consumers from
 * ref churn caused by:
 *   - `useSearchParams()` returning a new `ReadonlyURLSearchParams` instance
 *     on every render even when the URL is unchanged (Next.js behavior).
 *   - Consumers passing the schema as a fresh object literal on every render.
 */
function useContentStable<T>(value: T, key: string): T {
  const ref = useRef<{ value: T; key: string } | undefined>(undefined)
  if (ref.current && ref.current.key === key) return ref.current.value
  ref.current = { value, key }
  return value
}

/**
 * Reuses a previous array reference if its content (shallow string equality)
 * matches the freshly parsed array. Lets `params.tier` etc. stay
 * reference-stable across renders that don't actually change those values.
 */
function reuseIfShallowEqual<T extends string | number | boolean>(
  prev: unknown,
  next: T[],
): T[] {
  if (!Array.isArray(prev) || prev.length !== next.length) return next
  for (let i = 0; i < next.length; i++) {
    if (prev[i] !== next[i]) return next
  }
  return prev as T[]
}

/**
 * Type mapping from JSType to TypeScript types for OUTPUT (reading params)
 */
type OutputTypeMap = {
  string: string
  number: number
  boolean: boolean
  array: string[]
  object: Record<string, unknown>
}

/**
 * Type mapping from JSType to TypeScript types for INPUT (setting params)
 * More permissive to allow null/undefined in arrays which get filtered
 */
type InputTypeMap = {
  string: string | null | undefined
  number: number | null | undefined
  boolean: boolean | null | undefined
  array: (string | null | undefined)[]
  object: Record<string, unknown> | null | undefined
}

/**
 * Get the TypeScript type for OUTPUT (reading from params)
 */
type OutputTypeForJSType<T extends JSType> = OutputTypeMap[T]

/**
 * Get the TypeScript type for INPUT (setting params)
 */
type InputTypeForJSType<T extends JSType> = InputTypeMap[T]

/**
 * Get the default value type for a given JSType
 */
type DefaultValueForType<T extends JSType> =
  T extends 'array' ? string[] :
  T extends 'object' ? Record<string, unknown> :
  OutputTypeMap[T]

/**
 * Parameter configuration for a single parameter
 */
export interface ParamConfig<T extends JSType = JSType> {
  /** JavaScript type for URL parameter */
  type: T
  /** Default value matching the type */
  default?: DefaultValueForType<T>
  /** Whether parameter is required */
  required?: boolean
}

/**
 * REST API parameter schema definition
 * Maps parameter names to their configuration
 */
export type ParamSchema = Record<string, ParamConfig>

/**
 * Helper to create a typed param schema (preserves literal types)
 */
export function defineParamSchema<T extends ParamSchema>(schema: T): T {
  return schema
}

/**
 * Options for useApiParams hook
 */
export interface UseApiParamsOptions {
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Infer the OUTPUT params type from a ParamSchema (for reading)
 * Maps each key in the schema to its corresponding TypeScript type
 *
 * @example
 * const schema = defineParamSchema({
 *   search: { type: 'string', default: '' },
 *   page: { type: 'number', default: 1 },
 *   tags: { type: 'array', default: [] }
 * })
 * type Params = InferParamsFromSchema<typeof schema>
 * // { search: string; page: number; tags: string[] }
 */
export type InferParamsFromSchema<TSchema extends ParamSchema> = {
  [K in keyof TSchema]: TSchema[K]['type'] extends infer T
    ? T extends JSType
      ? OutputTypeForJSType<T>
      : never
    : never
}

/**
 * Infer the INPUT params type from a ParamSchema (for setting)
 * More permissive to allow null/undefined values
 */
export type InferInputParamsFromSchema<TSchema extends ParamSchema> = {
  [K in keyof TSchema]: TSchema[K]['type'] extends infer T
    ? T extends JSType
      ? InputTypeForJSType<T>
      : never
    : never
}

/**
 * Type for parameter values that can be set
 * Allows setting values that match the schema types or can be coerced to them
 */
export type ParamValue = 
  | string 
  | number 
  | boolean 
  | string[] 
  | (string | null | undefined)[]
  | Record<string, unknown> 
  | null 
  | undefined

/**
 * Return type for useApiParams hook with strict typing
 */
export interface UseApiParamsReturn<
  TSchema extends ParamSchema,
  TParams = InferParamsFromSchema<TSchema>
> {
  /** Parsed parameters object with strict typing */
  params: TParams

  /** URLSearchParams for fetch/axios */
  urlSearchParams: URLSearchParams

  /** Set a single parameter with type-safe key and value */
  setParam: <K extends keyof TSchema & string>(
    key: K,
    value: InferInputParamsFromSchema<Pick<TSchema, K>>[K]
  ) => void

  /** Set multiple parameters at once */
  setParams: (updates: Partial<InferInputParamsFromSchema<TSchema>>) => void

  /** Clear specific parameters */
  clearParams: (keys: (keyof TSchema & string)[]) => void

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
export function useApiParams<TSchema extends ParamSchema>(
  schema: TSchema,
  options: UseApiParamsOptions = {}
): UseApiParamsReturn<TSchema> {
  const router = useRouter()
  const searchParamsLive = useSearchParams()
  const debug = options.debug || false

  // ───── Reference-stability layer ──────────────────────────────────────
  //
  // Goal: `params`, `params.<arrayField>`, and the setter callbacks must keep
  // the SAME reference across renders unless the URL or schema content
  // actually changes. Otherwise consumer `useMemo`/`useEffect` deps that
  // include `params.foo` invalidate on every parent re-render.
  //
  // Without this, every call site has to defensively `JSON.stringify` filter
  // arrays into a content-key — a known footgun. The stability is provided
  // here, once, instead of in 17 consumers.

  // 1. URL string is the canonical, value-stable representation of search params.
  const searchString = searchParamsLive.toString()

  // 2. Schema reference stabilized by content. Consumers commonly pass an
  //    object literal each render, which would otherwise invalidate every memo.
  const schemaKey = useMemo(() => JSON.stringify(schema), [schema])
  const stableSchema = useContentStable(schema, schemaKey)

  // ──────────────────────────────────────────────────────────────────────

  // Convert schema to flattened format for reuse
  // biome-ignore lint/correctness/useExhaustiveDependencies: schemaKey is the content-stable key for `stableSchema`.
  const flattenedSchema = useMemo((): Record<string, FlattenedParam> => {
    const flattened: Record<string, FlattenedParam> = {}

    for (const [key, config] of Object.entries(stableSchema)) {
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
  }, [schemaKey])

  // Parse URL parameters with type coercion. Reuse previous array refs when
  // their content is unchanged so `params.<arrayField>` stays stable across
  // renders that don't touch that specific field.
  const prevParamsRef = useRef<Record<string, unknown> | undefined>(undefined)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `searchString` and `schemaKey` are content-stable representations of `searchParamsLive` and `stableSchema`.
  const params = useMemo((): InferParamsFromSchema<TSchema> => {
    const sp = new URLSearchParams(searchString)
    const result: Record<string, unknown> = {}
    const prev = prevParamsRef.current

    for (const [key, config] of Object.entries(stableSchema)) {
      // Read from URL
      const rawValue = config.type === 'array'
        ? sp.getAll(key)
        : sp.get(key)

      // Use value from URL or default
      let value: unknown
      if (rawValue && (Array.isArray(rawValue) ? rawValue.length > 0 : true)) {
        value = coerceValue(rawValue, config.type)
      } else {
        value = config.default
      }

      // Reuse previous reference when content matches — keeps array fields
      // reference-stable when an unrelated param changed.
      if (Array.isArray(value) && prev) {
        value = reuseIfShallowEqual(prev[key], value as (string | number | boolean)[])
      }

      result[key] = value
    }

    if (debug) {
      console.log('[useApiParams] Parsed params:', result)
    }

    prevParamsRef.current = result
    return result as InferParamsFromSchema<TSchema>
  }, [searchString, schemaKey, debug])

  // Helper: Add parameter value to URLSearchParams
  const addParamToSearchParams = useCallback((
    searchParams: URLSearchParams,
    key: string,
    value: ParamValue
  ): void => {
    if (value === undefined || value === '' || value === null) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach(v => {
        if (v !== undefined && v !== '' && v !== null) {
          searchParams.append(key, String(v))
        }
      })
    } else if (typeof value === 'object') {
      // For objects, convert to JSON string
      searchParams.set(key, JSON.stringify(value))
    } else {
      searchParams.set(key, String(value))
    }
  }, [])

  // Get URLSearchParams for fetch/axios. Iterates `stableSchema` (not raw
  // `schema`) so consumers passing an inline schema literal don't invalidate
  // this memo on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `schemaKey` is the content-stable key for `stableSchema`.
  const urlSearchParams = useMemo((): URLSearchParams => {
    const newParams = new URLSearchParams()

    for (const key of Object.keys(stableSchema)) {
      const value = (params as Record<string, unknown>)[key]
      const paramConfig = flattenedSchema[key]

      // Skip if should not include
      if (!shouldIncludeInUrl(value, paramConfig)) {
        continue
      }

      addParamToSearchParams(newParams, key, value as ParamValue)
    }

    return newParams
  }, [params, schemaKey, flattenedSchema, addParamToSearchParams])

  // Update URL with new parameters (preserve other params not managed by this
  // hook). Depends only on value-stable inputs (`searchString`, `schemaKey`),
  // so the callback ref itself is stable across renders that don't change URL
  // or schema — important for consumers that put `setParam`/`setParams` in
  // `useEffect` deps.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `searchString` and `schemaKey` are content-stable representations of `searchParamsLive` and `stableSchema`.
  const updateUrl = useCallback((newParams: URLSearchParams, keysToRemove: string[] = []) => {
    // Preserve all existing params, then override with new ones
    const finalParams = new URLSearchParams(searchString)

    // Remove keys that are explicitly marked for removal
    keysToRemove.forEach(key => {
      if (key in stableSchema) {
        finalParams.delete(key)
      }
    })

    // Remove keys that are being updated (from newParams)
    // This preserves other schema parameters that aren't being changed
    newParams.forEach((_, key) => {
      // Only remove keys that are in our schema
      if (key in stableSchema) {
        finalParams.delete(key)
      }
    })

    // Add all new values (including multiple values for array params)
    // Only add parameters that are in our schema to avoid duplicating external params
    newParams.forEach((value, key) => {
      // Only process keys that are in our schema
      if (key in stableSchema) {
        if (finalParams.has(key)) {
          // Key already exists (from array params), append
          finalParams.append(key, value)
        } else {
          // First value for this key, use set
          finalParams.set(key, value)
        }
      }
    })

    const url = finalParams.toString()
      ? `?${finalParams.toString()}`
      : window.location.pathname

    if (debug) {
      console.log('[useApiParams] Updating URL:', url)
    }

    // Use replace for shallow routing (no page reload, no history spam)
    router.replace(url, { scroll: false })
  }, [router, debug, searchString, schemaKey])

  // Helper to check if value is empty
  const isEmptyValue = (value: unknown): boolean => {
    if (value === undefined || value === null || value === '') {
      return true
    }
    if (Array.isArray(value)) {
      // Empty array or array with all empty/null/undefined values
      return value.length === 0 || value.every(v => v === undefined || v === null || v === '')
    }
    return false
  }

  // Set a single parameter
  // biome-ignore lint/correctness/useExhaustiveDependencies: `schemaKey` is the content-stable key for `stableSchema`.
  const setParam = useCallback(<K extends keyof TSchema & string>(
    key: K,
    value: InferInputParamsFromSchema<Pick<TSchema, K>>[K]
  ) => {
    const config = stableSchema[key]

    if (!config) {
      console.warn(`[useApiParams] Unknown parameter: ${key}`)
      return
    }

    const newParams = new URLSearchParams()

    if (isEmptyValue(value)) {
      updateUrl(newParams, [key])
    } else {
      addParamToSearchParams(newParams, key, value as ParamValue)
      updateUrl(newParams)
    }
  }, [schemaKey, updateUrl, addParamToSearchParams])

  // Set multiple parameters
  // biome-ignore lint/correctness/useExhaustiveDependencies: `schemaKey` is the content-stable key for `stableSchema`.
  const setParams = useCallback((
    updates: Partial<InferInputParamsFromSchema<TSchema>>
  ) => {
    const newParams = new URLSearchParams()
    const keysToRemove: string[] = []

    for (const [key, value] of Object.entries(updates)) {
      const config = stableSchema[key]

      if (!config) {
        console.warn(`[useApiParams] Unknown parameter: ${key}`)
        continue
      }

      if (isEmptyValue(value)) {
        keysToRemove.push(key)
      } else {
        addParamToSearchParams(newParams, key, value as ParamValue)
      }
    }

    updateUrl(newParams, keysToRemove)
  }, [schemaKey, updateUrl, addParamToSearchParams])

  // Clear specific parameters
  const clearParams = useCallback((keys: (keyof TSchema & string)[]) => {
    const newParams = new URLSearchParams()
    updateUrl(newParams, keys)
  }, [updateUrl])

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
 * Handles arrays as repeated parameters. Filters out undefined, and empty values.
 *
 * @param params - Parameters object
 * @returns URLSearchParams
 */
export function createSearchParams(params: Record<string, ParamValue>): URLSearchParams {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === null) {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach(v => {
        if (v !== undefined && v !== '' && v !== null) {
          searchParams.append(key, String(v))
        }
      })
    } else if (typeof value === 'object') {
      // For objects, convert to JSON string
      searchParams.set(key, JSON.stringify(value))
    } else {
      searchParams.set(key, String(value))
    }
  }

  return searchParams
}