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

'use client';

import type { DocumentNode } from 'graphql';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from '../../embed-shims/next-navigation';

import { flattenQueryVariables, mergeDefaults, validateSchema, type FlattenedParam } from './flatten-schema';
import { extractVariablesFromQuery } from './graphql-parser';
import { introspector } from './introspection';
import {
  urlParamsToVariables,
  variablesToUrlParams,
  mergeVariables,
  clearParams,
  type GraphQLVariables,
} from './url-converter';

/**
 * Options for useQueryParams hook
 */
export interface UseQueryParamsOptions {
  /** Default values for parameters */
  defaultValues?: GraphQLVariables;

  /** GraphQL endpoint for introspection (defaults to process.env.NEXT_PUBLIC_API_URL/graphql) */
  introspectionEndpoint?: string;

  /** HTTP headers for introspection (e.g., authentication) */
  introspectionHeaders?: Record<string, string>;

  /** Skip introspection (use only AST parsing, no nested type flattening) */
  skipIntrospection?: boolean;

  /** Custom parameter name mapping (override auto-generated names) */
  paramMapping?: Record<string, string>;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Return type for useQueryParams hook
 */
export interface UseQueryParamsReturn<TVariables = GraphQLVariables> {
  /** GraphQL variables ready for Apollo Client */
  variables: TVariables;

  /** Raw URL parameters (before conversion to variables). Repeated keys
   *  collapse into an array, in URL order. */
  params: Record<string, string | string[]>;

  /** Flattened parameter schema */
  schema: Record<string, FlattenedParam>;

  /** Set a single parameter */
  setParam: (key: string, value: unknown) => void;

  /** Set multiple parameters at once */
  setParams: (params: GraphQLVariables) => void;

  /** Clear specific parameters */
  clearParams: (keys: string[]) => void;

  /** Reset all parameters (clear URL) */
  resetParams: () => void;

  /** Whether schema is ready (introspection complete) */
  isReady: boolean;

  /** Loading state during initialization */
  isLoading: boolean;

  /** Error during initialization */
  error: Error | null;
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
export function useQueryParams<TVariables = GraphQLVariables>(
  query: DocumentNode,
  options: UseQueryParamsOptions = {},
): UseQueryParamsReturn<TVariables> {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [schema, setSchema] = useState<Record<string, FlattenedParam>>({});

  // Extract default values. Memoised: `|| {}` minted a new object on every
  // render, so every memo and effect keyed on it re-ran every time.
  const defaultValues = useMemo(() => options.defaultValues || {}, [options.defaultValues]);
  const skipIntrospection = options.skipIntrospection || false;
  const debug = options.debug || false;

  // Latest option bag for the one-time initialiser below. These cannot be
  // dependencies: `introspectionHeaders`, `paramMapping` and `defaultValues`
  // are almost always object literals, so as deps they would re-run schema
  // introspection on every render of the calling component.
  const initSourceRef = useRef({
    introspectionHeaders: options.introspectionHeaders,
    paramMapping: options.paramMapping,
    defaultValues,
  });
  useEffect(() => {
    initSourceRef.current = {
      introspectionHeaders: options.introspectionHeaders,
      paramMapping: options.paramMapping,
      defaultValues,
    };
  });

  // Initialize: Parse query + fetch schema (once)
  useEffect(() => {
    // `initialize` awaits introspection and schema flattening, so a `query`
    // change can start a second run while the first is still in flight. Without
    // this guard the SUPERSEDED run's `setSchema`/`setIsReady` could land last
    // and leave the hook parsing the URL against the PREVIOUS query's schema —
    // params for the new query then silently drop or coerce to the wrong type.
    let cancelled = false;
    async function initialize() {
      try {
        if (debug) console.log('[useQueryParams] Initializing...');

        // 1. Extract variables from query AST
        const queryVariables = extractVariablesFromQuery(query);

        if (debug) {
          console.log('[useQueryParams] Extracted variables:', queryVariables);
        }

        // 2. Fetch GraphQL schema via introspection (if needed and not skipped)
        if (!skipIntrospection && !introspector.isLoaded()) {
          const endpoint =
            options.introspectionEndpoint ||
            (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
              ? `${process.env.NEXT_PUBLIC_API_URL}/graphql`
              : '');

          if (endpoint) {
            try {
              await introspector.fetchSchema(endpoint, initSourceRef.current.introspectionHeaders);
              if (debug) console.log('[useQueryParams] Introspection complete');
            } catch (err) {
              console.warn('[useQueryParams] Introspection failed, continuing without it:', err);
              // Continue without introspection - nested types won't be flattened
            }
          }
        }

        // 3. Flatten schema (with or without introspection). Synchronous — the
        // schema fetch it depends on was already awaited in step 2 above.
        let flattenedSchema = flattenQueryVariables(queryVariables, introspector);

        // Apply custom param mapping if provided
        const { paramMapping, defaultValues: initialDefaults } = initSourceRef.current;
        if (paramMapping) {
          flattenedSchema = applyParamMapping(flattenedSchema, paramMapping);
        }

        // Merge default values
        flattenedSchema = mergeDefaults(flattenedSchema, initialDefaults);

        // Validate schema
        validateSchema(flattenedSchema);

        if (debug) {
          console.log('[useQueryParams] Flattened schema:', flattenedSchema);
        }

        if (cancelled) return;
        setSchema(flattenedSchema);
        setIsReady(true);
      } catch (err) {
        if (cancelled) return;
        const initError = err instanceof Error ? err : new Error(String(err));
        console.error('[useQueryParams] Initialization failed:', initError);
        setError(initError);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Never rejects — settles every failure into `error` state.
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [query, options.introspectionEndpoint, skipIntrospection, debug]);

  // Convert URL params to GraphQL variables. Kept as the plain record shape
  // internally (that is what the converters take); the caller-chosen
  // `TVariables` view is applied once, at the returned value.
  const variables = useMemo<GraphQLVariables>(() => {
    if (!isReady) {
      return defaultValues;
    }

    try {
      const varsFromUrl = urlParamsToVariables(searchParams, schema);
      const merged = { ...defaultValues, ...varsFromUrl };

      if (debug) {
        console.log('[useQueryParams] Variables from URL:', merged);
      }

      return merged;
    } catch (err) {
      console.error('[useQueryParams] Failed to convert URL to variables:', err);
      return defaultValues;
    }
  }, [searchParams, schema, isReady, defaultValues, debug]);

  // Raw URL params (before conversion)
  const params = useMemo(() => {
    const result: Record<string, string | string[]> = {};
    searchParams.forEach((value, key) => {
      const existing = result[key];
      if (existing === undefined) {
        result[key] = value;
      } else if (Array.isArray(existing)) {
        // Multiple values - append to the array
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    });
    return result;
  }, [searchParams]);

  // Update URL with new parameters
  const updateUrl = useCallback(
    (newParams: URLSearchParams) => {
      const url = newParams.toString() ? `?${newParams.toString()}` : window.location.pathname;

      if (debug) {
        console.log('[useQueryParams] Updating URL:', url);
      }

      // Use replace for shallow routing (no page reload, no history spam)
      router.replace(url, { scroll: false });
    },
    [router, debug],
  );

  // Set a single parameter
  const setParam = useCallback(
    (key: string, value: unknown) => {
      if (!isReady) {
        console.warn('[useQueryParams] Schema not ready, cannot set param');
        return;
      }

      try {
        const updated = mergeVariables(variables, { [key]: value }, schema);
        const newParams = variablesToUrlParams(updated, schema);
        updateUrl(newParams);
      } catch (err) {
        console.error('[useQueryParams] Failed to set param:', err);
      }
    },
    [variables, schema, isReady, updateUrl],
  );

  // Set multiple parameters
  const setParams = useCallback(
    (updates: GraphQLVariables) => {
      if (!isReady) {
        console.warn('[useQueryParams] Schema not ready, cannot set params');
        return;
      }

      try {
        const updated = mergeVariables(variables, updates, schema);
        const newParams = variablesToUrlParams(updated, schema);
        updateUrl(newParams);
      } catch (err) {
        console.error('[useQueryParams] Failed to set params:', err);
      }
    },
    [variables, schema, isReady, updateUrl],
  );

  // Clear specific parameters
  const clearParamsHandler = useCallback(
    (keys: string[]) => {
      if (!isReady) {
        console.warn('[useQueryParams] Schema not ready, cannot clear params');
        return;
      }

      try {
        const updated = clearParams(variables, keys, schema);
        const newParams = variablesToUrlParams(updated, schema);
        updateUrl(newParams);
      } catch (err) {
        console.error('[useQueryParams] Failed to clear params:', err);
      }
    },
    [variables, schema, isReady, updateUrl],
  );

  // Reset all parameters
  const resetParams = useCallback(() => {
    if (debug) {
      console.log('[useQueryParams] Resetting params');
    }

    router.replace(window.location.pathname, { scroll: false });
  }, [router, debug]);

  return {
    // The only place the caller's `TVariables` view is applied — this hook
    // builds the object from the URL, so its exact shape is the caller's
    // claim about their own query, not something we can verify here.
    variables: variables as TVariables,
    params,
    schema,
    setParam,
    setParams,
    clearParams: clearParamsHandler,
    resetParams,
    isReady,
    isLoading,
    error,
  };
}

/**
 * Apply custom parameter name mapping to schema
 */
function applyParamMapping(
  schema: Record<string, FlattenedParam>,
  mapping: Record<string, string>,
): Record<string, FlattenedParam> {
  const mapped: Record<string, FlattenedParam> = {};

  for (const [key, param] of Object.entries(schema)) {
    const newKey = mapping[key] || key;
    mapped[newKey] = {
      ...param,
      urlParamName: mapping[key] || param.urlParamName,
    };
  }

  return mapped;
}
