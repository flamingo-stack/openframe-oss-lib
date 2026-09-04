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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from '../../embed-shims/next-navigation';
import { type FlattenedParam, shouldIncludeInUrl } from './flatten-schema';
import type { JSType } from './graphql-parser';
import { coerceValue } from './url-converter';
import { parseSchemaParams, type ParamSchema } from '../../utils/search-params';

/**
 * Returns the previous reference if the JSON-serialized content of `value`
 * hasn't changed across renders. Internal helper used to shield consumers from
 * ref churn caused by:
 *   - `useSearchParams()` returning a new `ReadonlyURLSearchParams` instance
 *     on every render even when the URL is unchanged (Next.js behavior).
 *   - Consumers passing the schema as a fresh object literal on every render.
 */
function useContentStable<T>(value: T, key: string): T {
  // React's "adjust state while rendering" pattern rather than a ref written
  // during render: the cache must not be updated by a render attempt React
  // discards (concurrent interruption, error retry), or a value that never
  // committed would be handed to every later render as the stable one. The
  // extra render pass only happens when the content key actually changes,
  // which for the one caller (the param schema) is essentially never after
  // mount.
  const [cached, setCached] = useState<{ value: T; key: string }>({ value, key });
  if (cached.key !== key) setCached({ value, key });
  // Same object either way: the pass that stores `value` also returns it.
  return cached.key === key ? cached.value : value;
}

/**
 * Reuses a previous array reference if its content (shallow string equality)
 * matches the freshly parsed array. Lets `params.tier` etc. stay
 * reference-stable across renders that don't actually change those values.
 */
function reuseIfShallowEqual<T extends string | number | boolean>(prev: unknown, next: T[]): T[] {
  if (!Array.isArray(prev) || prev.length !== next.length) return next;
  for (let i = 0; i < next.length; i++) {
    if (prev[i] !== next[i]) return next;
  }
  return prev as T[];
}

/** Cached params snapshot plus the raw parse it was derived from. */
interface ParamsCache {
  src: Record<string, unknown>;
  value: Record<string, unknown>;
}

/**
 * Copy of `next` in which every array field whose content matches `prev`'s
 * keeps `prev`'s instance. Returns `next` untouched when nothing was reusable,
 * so an unrelated change costs no extra allocation.
 */
function reuseArrayRefs(prev: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  let merged: Record<string, unknown> | undefined;
  for (const [key, value] of Object.entries(next)) {
    if (!Array.isArray(value)) continue;
    const reused = reuseIfShallowEqual(prev[key], value as (string | number | boolean)[]);
    if (reused === value) continue;
    merged ??= { ...next };
    merged[key] = reused;
  }
  return merged ?? next;
}

/**
 * Type mapping from JSType to TypeScript types for OUTPUT (reading params)
 */
type OutputTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  array: string[];
  object: Record<string, unknown>;
  int: number;
};

/**
 * Type mapping from JSType to TypeScript types for INPUT (setting params)
 * More permissive to allow null/undefined in arrays which get filtered
 */
type InputTypeMap = {
  string: string | null | undefined;
  number: number | null | undefined;
  boolean: boolean | null | undefined;
  array: (string | null | undefined)[];
  object: Record<string, unknown> | null | undefined;
  int: number | null | undefined;
};

/**
 * Get the TypeScript type for OUTPUT (reading from params)
 */
type OutputTypeForJSType<T extends JSType> = OutputTypeMap[T];

/**
 * Get the TypeScript type for INPUT (setting params)
 */
type InputTypeForJSType<T extends JSType> = InputTypeMap[T];

/**
 * Get the default value type for a given JSType
 */
type DefaultValueForType<T extends JSType> = T extends 'array'
  ? string[]
  : T extends 'object'
    ? Record<string, unknown>
    : OutputTypeMap[T];

// Schema types + the schema helper live in the search-params leaf, so the hook's
// `params` ARE the same parsed contract a server route produces for that URL.
export type { ParamConfig, ParamSchema } from '../../utils/search-params';
export { defineParamSchema } from '../../utils/search-params';

/**
 * Options for useApiParams hook
 */
export interface UseApiParamsOptions {
  /** Enable debug logging */
  debug?: boolean;
  /**
   * What an ABSENT scalar with no declared `default` reads as. Passed straight
   * through to `parseSchemaParams`, so the hook's `params` ARE the same parsed
   * contract the server produces for the same URL.
   */
  absent?: 'undefined' | 'null';
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
    : never;
};

/**
 * Infer the INPUT params type from a ParamSchema (for setting)
 * More permissive to allow null/undefined values
 */
export type InferInputParamsFromSchema<TSchema extends ParamSchema> = {
  [K in keyof TSchema]: TSchema[K]['type'] extends infer T ? (T extends JSType ? InputTypeForJSType<T> : never) : never;
};

/**
 * Type for parameter values that can be set
 * Allows setting values that match the schema types or can be coerced to them
 */
export type ParamValue =
  string | number | boolean | string[] | (string | null | undefined)[] | Record<string, unknown> | null | undefined;

/**
 * Return type for useApiParams hook with strict typing
 */
export interface UseApiParamsReturn<TSchema extends ParamSchema, TParams = InferParamsFromSchema<TSchema>> {
  /** Parsed parameters object with strict typing */
  params: TParams;

  /**
   * `params` of the last write this hook issued, or `params` itself when no
   * write is in flight. The URL is authoritative; this is the latest INTENT.
   */
  pendingParams: TParams;

  /** URLSearchParams for fetch/axios */
  urlSearchParams: URLSearchParams;

  /** Set a single parameter with type-safe key and value */
  setParam: <K extends keyof TSchema & string>(key: K, value: InferInputParamsFromSchema<Pick<TSchema, K>>[K]) => void;

  /** Set multiple parameters at once */
  setParams: (updates: Partial<InferInputParamsFromSchema<TSchema>>) => void;

  /** Clear specific parameters */
  clearParams: (keys: (keyof TSchema & string)[]) => void;

  /** Reset all parameters (clear URL) */
  resetParams: () => void;
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
  options: UseApiParamsOptions = {},
): UseApiParamsReturn<TSchema> {
  const router = useRouter();
  const searchParamsLive = useSearchParams();
  const debug = options.debug || false;

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
  const searchString = searchParamsLive.toString();

  // Serialized query strings this hook has written and not yet seen committed.
  const pendingRef = useRef<string[]>([]);
  // Bumped on every queued write so `pendingParams` recomputes before the
  // router commits (the ref alone would not re-render).
  const [pendingVersion, setPendingVersion] = useState(0);

  const absentValue = options.absent === 'null' ? null : undefined;

  // 2. Schema reference stabilized by content. Consumers commonly pass an
  //    object literal each render, which would otherwise invalidate every memo.
  const schemaKey = useMemo(() => JSON.stringify(schema), [schema]);
  const stableSchema = useContentStable(schema, schemaKey);

  // ──────────────────────────────────────────────────────────────────────

  // Convert schema to flattened format for reuse
  const flattenedSchema = useMemo((): Record<string, FlattenedParam> => {
    const flattened: Record<string, FlattenedParam> = {};

    for (const [key, config] of Object.entries(stableSchema)) {
      flattened[key] = {
        urlParamName: key,
        graphqlPath: key,
        type: config.type,
        defaultValue: config.default,
        required: config.required,
        isArray: config.type === 'array',
      };
    }

    return flattened;
  }, [stableSchema]);

  // Parse URL parameters with type coercion. PURE — it reads nothing but its
  // own dependencies, so a render attempt React discards leaves no trace.
  const rawParams = useMemo((): Record<string, unknown> => {
    const sp = new URLSearchParams(searchString);
    const result: Record<string, unknown> = {};

    for (const [key, config] of Object.entries(stableSchema)) {
      // Read from URL
      const rawValue = config.type === 'array' ? sp.getAll(key) : sp.get(key);

      // Use value from URL, else the declared default, else the caller's
      // ABSENT value (arrays never take `absent`: an unset array is `[]`).
      let value: unknown;
      if (rawValue && (Array.isArray(rawValue) ? rawValue.length > 0 : true)) {
        value = coerceValue(rawValue, config.type);
      } else if (config.default !== undefined) {
        value = config.default;
      } else {
        value = config.type === 'array' ? [] : absentValue;
      }

      result[key] = value;
    }

    if (debug) {
      console.log('[useApiParams] Parsed params:', result);
    }

    return result;
  }, [searchString, debug, stableSchema]);

  // Carry the previously COMMITTED array instances forward when their content
  // is unchanged, so `params.<arrayField>` stays reference-stable across a URL
  // change that touched some OTHER param. Held in state and updated with
  // React's "adjust state while rendering" pattern rather than in a ref: the
  // carry-forward source must be a params object that actually committed, or a
  // discarded render attempt would seed it with array instances no consumer
  // ever saw. The extra render pass only runs when `rawParams` is recomputed,
  // i.e. when the URL or the schema really changed.
  const [paramsCache, setParamsCache] = useState<ParamsCache>(() => ({ src: rawParams, value: rawParams }));
  let stableParams = paramsCache.value;
  if (paramsCache.src !== rawParams) {
    stableParams = reuseArrayRefs(paramsCache.value, rawParams);
    setParamsCache({ src: rawParams, value: stableParams });
  }
  const params = stableParams as InferParamsFromSchema<TSchema>;

  // Helper: Add parameter value to URLSearchParams
  const addParamToSearchParams = useCallback((searchParams: URLSearchParams, key: string, value: ParamValue): void => {
    if (value === undefined || value === '' || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(v => {
        if (v !== undefined && v !== '' && v !== null) {
          searchParams.append(key, String(v));
        }
      });
    } else if (typeof value === 'object') {
      // For objects, convert to JSON string
      searchParams.set(key, JSON.stringify(value));
    } else {
      searchParams.set(key, String(value));
    }
  }, []);

  // Get URLSearchParams for fetch/axios. Iterates `stableSchema` (not raw
  // `schema`) so consumers passing an inline schema literal don't invalidate
  // this memo on every render.
  const urlSearchParams = useMemo((): URLSearchParams => {
    const newParams = new URLSearchParams();

    for (const key of Object.keys(stableSchema)) {
      const value = (params as Record<string, unknown>)[key];
      const paramConfig = flattenedSchema[key];

      // Skip if should not include
      if (!shouldIncludeInUrl(value, paramConfig)) {
        continue;
      }

      addParamToSearchParams(newParams, key, value as ParamValue);
    }

    return newParams;
  }, [params, flattenedSchema, addParamToSearchParams, stableSchema]);

  // Update URL with new parameters (preserve other params not managed by this
  // hook). Depends only on value-stable inputs (`searchString`, `schemaKey`),
  // so the callback ref itself is stable across renders that don't change URL
  // or schema — important for consumers that put `setParam`/`setParams` in
  // `useEffect` deps.
  const updateUrl = useCallback(
    (newParams: URLSearchParams, keysToRemove: string[] = []) => {
      // Base the write on the LAST WRITE WE ISSUED, not on the committed URL.
      // Next commits each `router.replace` as its own navigation, so two writes
      // fired before the first commits would both rebase on the pre-first URL
      // and the first one's keys would be lost.
      const base = pendingRef.current[pendingRef.current.length - 1] ?? searchString;
      const finalParams = new URLSearchParams(base);

      // Remove keys that are explicitly marked for removal
      keysToRemove.forEach(key => {
        if (key in stableSchema) {
          finalParams.delete(key);
        }
      });

      // Remove keys that are being updated (from newParams)
      // This preserves other schema parameters that aren't being changed
      newParams.forEach((_, key) => {
        // Only remove keys that are in our schema
        if (key in stableSchema) {
          finalParams.delete(key);
        }
      });

      // Add all new values (including multiple values for array params)
      // Only add parameters that are in our schema to avoid duplicating external params
      newParams.forEach((value, key) => {
        // Only process keys that are in our schema
        if (key in stableSchema) {
          if (finalParams.has(key)) {
            // Key already exists (from array params), append
            finalParams.append(key, value);
          } else {
            // First value for this key, use set
            finalParams.set(key, value);
          }
        }
      });

      const merged = finalParams.toString();

      // A NO-OP write (re-selecting the current option, clearing an already
      // empty picker) must not enter the queue: `router.replace` with an
      // identical URL produces no commit, so the entry would never drain and
      // every later write would rebase on a phantom.
      if (merged === base) return;

      pendingRef.current = [...pendingRef.current, merged];
      setPendingVersion(v => v + 1);

      const url = merged ? `?${merged}` : window.location.pathname;

      if (debug) {
        console.log('[useApiParams] Updating URL:', url);
      }

      // Use replace for shallow routing (no page reload, no history spam)
      router.replace(url, { scroll: false });
    },
    [router, debug, searchString, stableSchema],
  );

  // Drain the queue as commits arrive. A commit EQUAL to a queued write drops
  // that entry and everything before it (so `[A, B, A']` survives A's commit
  // with `[B, A']` intact); a commit matching NOTHING is a FOREIGN navigation
  // (Back/Forward, another hook's replace) and invalidates the whole base.
  useEffect(() => {
    const queue = pendingRef.current;
    if (queue.length === 0) return;
    const hit = queue.indexOf(searchString);
    pendingRef.current = hit === -1 ? [] : queue.slice(hit + 1);
    setPendingVersion(v => v + 1);
  }, [searchString]);

  // Helper to check if value is empty
  const isEmptyValue = (value: unknown): boolean => {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    if (Array.isArray(value)) {
      // Empty array or array with all empty/null/undefined values
      return value.length === 0 || value.every(v => v === undefined || v === null || v === '');
    }
    return false;
  };

  // Set a single parameter
  const setParam = useCallback(
    <K extends keyof TSchema & string>(key: K, value: InferInputParamsFromSchema<Pick<TSchema, K>>[K]) => {
      const config = stableSchema[key];

      if (!config) {
        console.warn(`[useApiParams] Unknown parameter: ${key}`);
        return;
      }

      const newParams = new URLSearchParams();

      if (isEmptyValue(value)) {
        updateUrl(newParams, [key]);
      } else {
        addParamToSearchParams(newParams, key, value);
        updateUrl(newParams);
      }
    },
    [updateUrl, addParamToSearchParams, stableSchema],
  );

  // Set multiple parameters
  const setParams = useCallback(
    (updates: Partial<InferInputParamsFromSchema<TSchema>>) => {
      const newParams = new URLSearchParams();
      const keysToRemove: string[] = [];

      for (const [key, value] of Object.entries(updates)) {
        const config = stableSchema[key];

        if (!config) {
          console.warn(`[useApiParams] Unknown parameter: ${key}`);
          continue;
        }

        if (isEmptyValue(value)) {
          keysToRemove.push(key);
        } else {
          addParamToSearchParams(newParams, key, value);
        }
      }

      updateUrl(newParams, keysToRemove);
    },
    [updateUrl, addParamToSearchParams, stableSchema],
  );

  // Clear specific parameters
  const clearParams = useCallback(
    (keys: (keyof TSchema & string)[]) => {
      const newParams = new URLSearchParams();
      updateUrl(newParams, keys);
    },
    [updateUrl],
  );

  // Reset all parameters
  const resetParams = useCallback(() => {
    if (debug) {
      console.log('[useApiParams] Resetting params');
    }

    router.replace(window.location.pathname, { scroll: false });
  }, [router, debug]);

  // The params of the LAST write we issued, or `params` when nothing is in
  // flight. Adapters read this as "the user's latest intent" so a decision made
  // while a `router.replace` is uncommitted compares against the click, not the
  // stale URL.
  const pendingParams = useMemo((): InferParamsFromSchema<TSchema> => {
    void pendingVersion;
    const last = pendingRef.current[pendingRef.current.length - 1];
    if (last === undefined || last === searchString) return params;
    return parseSchemaParams(stableSchema, new URLSearchParams(last), {
      absent: options.absent === 'null' ? 'null' : 'undefined',
    }) as InferParamsFromSchema<TSchema>;
  }, [pendingVersion, searchString, params, stableSchema, options.absent]);

  return {
    params,
    pendingParams,
    urlSearchParams,
    setParam,
    setParams,
    clearParams,
    resetParams,
  };
}

// THE serializer lives in the search-params leaf (one array/object/omission
// rule for the hook and for server code); re-exported for existing importers.
export { createSearchParams } from '../../utils/search-params';
