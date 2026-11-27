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
import { createSearchParams, parseSchemaParams, type ParamSchema, type JSType } from '../../utils/search-params';
import { shouldIncludeInUrl } from '../../utils/search-params';
import type { FlattenedParam } from './flatten-schema';

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
  /**
   * Prefix every URL key with this word, camelCased (`prefix: 'cve'` → `search` lives at `?cveSearch=`), so two tables
   * on one page (a detail page's tabs) keep their own state. `params` and the setters keep the schema's own keys.
   */
  prefix?: string;
  /**
   * Keys (schema-style names, prefixed like the rest) that this hook CLEARS in the same URL write whenever it changes
   * any of its own params: a table's filters pass the pager's `cursor` / `page` here, so a filter change and the cursor
   * drop are ONE navigation. The keys need not be in this hook's schema.
   */
  resetKeys?: readonly string[];
  /**
   * How a write that cleared a present `resetKeys` key enters history (default `replace`). `push` makes a filter change
   * on page 3 a new entry, so Back returns to page 3 under the old filter.
   */
  resetHistory?: ApiParamsHistory;
}

/** How a URL write enters browser history. */
export type ApiParamsHistory = 'push' | 'replace';

/** Options of one write. */
export interface ApiParamsWriteOptions {
  /** `push` adds a history entry (a page move); default `replace`. */
  history?: ApiParamsHistory;
}

/** The URL name of a schema key under `prefix`: `cve` + `search` → `cveSearch`. */
export function prefixedParamName(prefix: string | undefined, name: string): string {
  return prefix ? `${prefix}${name[0]?.toUpperCase() ?? ''}${name.slice(1)}` : name;
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
  setParam: <K extends keyof TSchema & string>(
    key: K,
    value: InferInputParamsFromSchema<Pick<TSchema, K>>[K],
    options?: ApiParamsWriteOptions,
  ) => void;

  /** Set multiple parameters at once */
  setParams: (updates: Partial<InferInputParamsFromSchema<TSchema>>, options?: ApiParamsWriteOptions) => void;

  /** Clear specific parameters */
  clearParams: (keys: (keyof TSchema & string)[], options?: ApiParamsWriteOptions) => void;

  /** Reset all parameters: the whole URL, or with a `prefix` only this hook's keys */
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
  // The queue's TAIL, mirrored into state: `pendingParams` is render output, and
  // reading a ref during render is both a lint error and a correctness hazard
  // (the value would not re-render the consumer). The ref stays the mutable
  // queue the commit effect drains; this is the one part render may see.
  const [pendingTail, setPendingTail] = useState<string | undefined>(undefined);
  const syncPendingTail = useCallback(() => {
    setPendingTail(pendingRef.current[pendingRef.current.length - 1]);
  }, []);

  // 2. Schema reference stabilized by content. Consumers commonly pass an
  //    object literal each render, which would otherwise invalidate every memo.
  const schemaKey = useMemo(() => JSON.stringify(schema), [schema]);
  const stableSchema = useContentStable(schema, schemaKey);

  // 3. Prefix and reset keys. The parser and the writer speak URL names (`cveSearch`); `params`, the setters and
  //    `urlSearchParams` speak the schema's own names (`search`).
  const prefix = options.prefix ?? '';
  const resetKeysKey = (options.resetKeys ?? []).join('\u0000');
  const resetKeys = useMemo(() => (resetKeysKey ? resetKeysKey.split('\u0000') : []), [resetKeysKey]);
  const resetHistory = options.resetHistory ?? 'replace';
  const urlSchema = useMemo((): ParamSchema => {
    if (!prefix) return stableSchema;
    return Object.fromEntries<ParamSchema[string]>(
      Object.entries(stableSchema).map(([key, config]) => [prefixedParamName(prefix, key), config]),
    );
  }, [stableSchema, prefix]);
  const parseSearch = useCallback(
    (search: string): Record<string, unknown> => {
      const parsed = parseSchemaParams(urlSchema, new URLSearchParams(search), {
        absent: options.absent === 'null' ? 'null' : 'undefined',
      }) as Record<string, unknown>;
      if (!prefix) return parsed;
      return Object.fromEntries(Object.keys(stableSchema).map(key => [key, parsed[prefixedParamName(prefix, key)]]));
    },
    [urlSchema, prefix, stableSchema, options.absent],
  );

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

  // Parse URL parameters. PURE — it reads nothing but its own dependencies, so
  // a render attempt React discards leaves no trace.
  //
  // THE reader, and the SAME one `pendingParams` uses. This used to walk the
  // schema itself through `coerceValue`, which knows only a param's TYPE — so
  // `min`/`max`/`default` were applied to the pending params and not to the
  // committed ones. `?pageSize=9999` then read as 9999 here and 100 there, and
  // `?page=abc` as `null` here and `1` there, which is enough to desynchronize
  // any adapter that compares the two.
  const rawParams = useMemo((): Record<string, unknown> => {
    const result = parseSearch(searchString);

    if (debug) {
      console.log('[useApiParams] Parsed params:', result);
    }

    return result;
  }, [searchString, debug, parseSearch]);

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

  // Helper: Add parameter value to URLSearchParams.
  //
  // Delegates to `createSearchParams`, which owns the ENCODING rule (skip
  // null/undefined/'', repeat the key per array element, JSON objects,
  // `String()` scalars). The rule used to be spelled out here as well; the two
  // sat side by side in one file, and hoisting the shared one into the leaf
  // put them in different modules where drift is much easier.
  const addParamToSearchParams = useCallback((searchParams: URLSearchParams, key: string, value: ParamValue): void => {
    for (const [k, v] of createSearchParams({ [key]: value })) searchParams.append(k, v);
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
    (newParams: URLSearchParams, keysToRemove: string[] = [], writeOptions?: ApiParamsWriteOptions) => {
      // Base the write on the LAST WRITE WE ISSUED, not on the committed URL.
      // Next commits each `router.replace` as its own navigation, so two writes
      // fired before the first commits would both rebase on the pre-first URL
      // and the first one's keys would be lost.
      const base = pendingRef.current[pendingRef.current.length - 1] ?? searchString;
      const finalParams = new URLSearchParams(base);

      const urlName = (key: string) => prefixedParamName(prefix, key);

      // Remove keys that are explicitly marked for removal
      keysToRemove.forEach(key => {
        if (key in stableSchema) {
          finalParams.delete(urlName(key));
        }
      });

      // Remove keys that are being updated (from newParams)
      // This preserves other schema parameters that aren't being changed
      newParams.forEach((_, key) => {
        // Only remove keys that are in our schema
        if (key in stableSchema) {
          finalParams.delete(urlName(key));
        }
      });

      // Add all new values (including multiple values for array params)
      // Only add parameters that are in our schema to avoid duplicating external params
      newParams.forEach((value, key) => {
        // Only process keys that are in our schema
        if (key in stableSchema) {
          const name = urlName(key);
          if (finalParams.has(name)) {
            // Key already exists (from array params), append
            finalParams.append(name, value);
          } else {
            // First value for this key, use set
            finalParams.set(name, value);
          }
        }
      });

      // The reset keys leave in THIS write when any of our own params changed: a filter change and the cursor drop
      // are one navigation, so no history entry (and no request) ever pairs the new filter with the old cursor.
      let clearedReset = false;
      if (resetKeys.length > 0) {
        const before = new URLSearchParams(base);
        const ownChanged = Object.keys(stableSchema).some(key => {
          if (resetKeys.includes(key)) return false;
          const name = urlName(key);
          return before.getAll(name).join('\u0000') !== finalParams.getAll(name).join('\u0000');
        });
        if (ownChanged) {
          for (const key of resetKeys) {
            const name = urlName(key);
            if (finalParams.has(name)) {
              finalParams.delete(name);
              clearedReset = true;
            }
          }
        }
      }

      const merged = finalParams.toString();

      // A NO-OP write (re-selecting the current option, clearing an already
      // empty picker) must not enter the queue: `router.replace` with an
      // identical URL produces no commit, so the entry would never drain and
      // every later write would rebase on a phantom.
      if (merged === base) return;

      pendingRef.current = [...pendingRef.current, merged];
      syncPendingTail();

      const url = merged ? `?${merged}` : window.location.pathname;

      if (debug) {
        console.log('[useApiParams] Updating URL:', url);
      }

      // Replace by default (shallow routing, no history spam); a page move, or a reset the caller wants undoable,
      // pushes.
      const history = writeOptions?.history ?? (clearedReset ? resetHistory : 'replace');
      if (history === 'push') router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, debug, searchString, stableSchema, syncPendingTail, prefix, resetKeys, resetHistory],
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
    syncPendingTail();
  }, [searchString, syncPendingTail]);

  // Set a single parameter
  const setParam = useCallback(
    <K extends keyof TSchema & string>(
      key: K,
      value: InferInputParamsFromSchema<Pick<TSchema, K>>[K],
      writeOptions?: ApiParamsWriteOptions,
    ) => {
      const config = stableSchema[key];

      if (!config) {
        console.warn(`[useApiParams] Unknown parameter: ${key}`);
        return;
      }

      const newParams = new URLSearchParams();

      // THE omission rule, the same one `setParams` uses. This branch moved
      // `setParams` onto `shouldIncludeInUrl` (so a value equal to its schema
      // default is dropped) and left `setParam` on a local emptiness check
      // that knew nothing about defaults — so `setParam('page', 1)` kept
      // `?page=1` on a URL `setParams({ page: 1 })` left clean.
      if (shouldIncludeInUrl(value, config)) {
        addParamToSearchParams(newParams, key, value);
        updateUrl(newParams, [], writeOptions);
      } else {
        updateUrl(newParams, [key], writeOptions);
      }
    },
    [updateUrl, addParamToSearchParams, stableSchema],
  );

  // Set multiple parameters
  const setParams = useCallback(
    (updates: Partial<InferInputParamsFromSchema<TSchema>>, writeOptions?: ApiParamsWriteOptions) => {
      const newParams = new URLSearchParams();
      const keysToRemove: string[] = [];

      for (const [key, value] of Object.entries(updates)) {
        const config = stableSchema[key];

        if (!config) {
          console.warn(`[useApiParams] Unknown parameter: ${key}`);
          continue;
        }

        // The SAME omission rule the reader uses (`urlSearchParams`): empty
        // values AND values equal to the schema default drop out. Writing a
        // default back into the URL left `?page=1&pageSize=15` on a pristine
        // board and made the canonical URL un-shareable.
        if (shouldIncludeInUrl(value, flattenedSchema[key])) {
          addParamToSearchParams(newParams, key, value);
        } else {
          keysToRemove.push(key);
        }
      }

      updateUrl(newParams, keysToRemove, writeOptions);
    },
    [updateUrl, addParamToSearchParams, stableSchema, flattenedSchema],
  );

  // Clear specific parameters
  const clearParams = useCallback(
    (keys: (keyof TSchema & string)[], writeOptions?: ApiParamsWriteOptions) => {
      const newParams = new URLSearchParams();
      updateUrl(newParams, keys, writeOptions);
    },
    [updateUrl],
  );

  // Reset all parameters
  const resetParams = useCallback(() => {
    if (debug) {
      console.log('[useApiParams] Resetting params');
    }

    // A prefixed hook shares the query string with other tables: it clears only its own keys.
    if (prefix) {
      updateUrl(new URLSearchParams(), Object.keys(stableSchema));
      return;
    }

    router.replace(window.location.pathname, { scroll: false });
  }, [router, debug, prefix, updateUrl, stableSchema]);

  // The params of the LAST write we issued, or `params` when nothing is in
  // flight. Adapters read this as "the user's latest intent" so a decision made
  // while a `router.replace` is uncommitted compares against the click, not the
  // stale URL.
  const pendingParams = useMemo((): InferParamsFromSchema<TSchema> => {
    if (pendingTail === undefined || pendingTail === searchString) return params;
    return parseSearch(pendingTail) as InferParamsFromSchema<TSchema>;
  }, [pendingTail, searchString, params, parseSearch]);

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
