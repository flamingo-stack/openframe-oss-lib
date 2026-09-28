/**
 * URL parameter schema engine — the ONE grammar for every URL/API integer,
 * the ONE omission rule, the ONE serializer.
 *
 * Hoisted out of `hooks/state/` so SERVER code (route handlers, DALs) and the
 * CLIENT hook parse the same URL with the same function: a param contract that
 * disagrees across the wire is the bug class this removes. JSX-free leaf with
 * its own `exports` subpath; `hooks/state/*` re-exports every name it used to own.
 */

/** JavaScript types a URL parameter can carry. `int` is a whole number with a floor. */
export type JSType = 'string' | 'number' | 'int' | 'boolean' | 'array' | 'object';

// ── The integer grammar ─────────────────────────────────────────────────────

export interface PositiveIntOptions {
  /** Smallest accepted value (default 1). Anything below falls back. */
  min?: number;
  /** Largest accepted value. Applied to the PARSED value AND to the fallback. */
  max?: number;
}

/**
 * THE integer grammar for URL params, env vars, and page sizes.
 *
 * `null`/`undefined`/`''` → fallback. Otherwise `Math.trunc(Number(raw))`, which
 * accepts `'12'`, `12`, `'12.9'` (→ 12) and `'0x10'` (→ 16), and rejects `'12abc'`
 * and `'abc'` (`NaN`) — the historical `parseInt` accepted `'12abc'` as 12 and
 * produced `NaN` for `'abc'`. A value below `min` falls back. The RESULT (parsed
 * value or fallback alike) is clamped to `max`, so "never exceeds max" has one owner.
 */
export function positiveInt<TFallback = number>(
  raw: string | number | null | undefined,
  fallback: TFallback,
  { min = 1, max }: PositiveIntOptions = {},
): number | TFallback {
  // The fallback is returned AS GIVEN — capping only ever applies to a value
  // parsed out of the input, so a caller with no default (`null`) gets its
  // sentinel back untouched instead of `Math.min(null, max)`.
  const capped = (v: number) => (max == null ? v : Math.min(v, max));
  if (raw === null || raw === undefined || raw === '') {
    return typeof fallback === 'number' ? capped(fallback) : fallback;
  }
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || n < min) {
    return typeof fallback === 'number' ? capped(fallback) : fallback;
  }
  return capped(n);
}

/** Ceilings every paged surface shares. */
export const PAGE_PARAM_LIMITS = { maxPage: 10_000, maxPageSize: 100 } as const;

/** Total pages for a row count. Floors at 1, so an empty result is still "page 1 of 1". */
export function pageCount(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(pageSize) || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Clamp a requested page into `1..totalPages`. */
export function clampPageToTotal(page: number, totalPages: number): number {
  return Math.min(page, Math.max(1, totalPages));
}

// ── Schema ──────────────────────────────────────────────────────────────────

type OutputTypeMap = {
  string: string;
  number: number;
  int: number;
  boolean: boolean;
  array: string[];
  object: Record<string, unknown>;
};

export type OutputTypeForJSType<T extends JSType> = OutputTypeMap[T];

export interface BaseParamConfig<T extends JSType = JSType> {
  type: T;
  default?: OutputTypeMap[T];
  required?: boolean;
}

/** An integer parameter with an optional floor and ceiling. */
export interface IntParamConfig extends BaseParamConfig<'int'> {
  min?: number;
  max?: number;
}

export type ParamConfig<T extends JSType = JSType> = T extends 'int' ? IntParamConfig : BaseParamConfig<T>;

export type ParamSchema = Record<string, ParamConfig>;

/** Identity helper that preserves literal types through a schema object. */
export function defineParamSchema<T extends ParamSchema>(schema: T): T {
  return schema;
}

/**
 * Build a `Record<K, V>` from a key tuple. Keeps `keyof` EXACT when spreading a
 * shared config across derived keys (an inline `Object.fromEntries` widens to
 * `Record<string, V>` and loses the key union).
 */
export function fromKeys<K extends string, V>(keys: readonly K[], value: V): Record<K, V> {
  return Object.fromEntries(keys.map(k => [k, value])) as Record<K, V>;
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** Anything a URL can be read from: `URLSearchParams`, Next's `searchParams`, or a plain record. */
export type ParamInput = URLSearchParams | Record<string, string | string[] | undefined> | null | undefined;

/** THE first-value rule for a duplicated key (`?a=1&a=2` reads as `1`). */
export function firstParamValue(input: ParamInput, key: string): string | undefined {
  if (!input) return undefined;
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Every value for a key (arrays read repeated params, then a `,`-joined single value). */
function allParamValues(input: ParamInput, key: string): string[] {
  if (!input) return [];
  const raw = input instanceof URLSearchParams ? input.getAll(key) : input[key];
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  if (list.length === 1 && list[0]?.includes(',')) return list[0].split(',').filter(Boolean);
  return list.filter(v => v !== undefined && v !== '');
}

export interface ParseSchemaOptions {
  /**
   * What an ABSENT scalar with no declared `default` resolves to.
   * `'undefined'` (default) keeps today's behaviour; `'null'` is the explicit
   * "this filter is unset" spelling that survives JSON and `URLSearchParams`.
   */
  absent?: 'undefined' | 'null';
}

export type AbsentValue<Opts extends ParseSchemaOptions | undefined> = Opts extends { absent: 'null' }
  ? null
  : undefined;

/**
 * The parsed shape of a schema: keys with a `default` and every array key are
 * non-nullable; an undefaulted scalar carries the caller's absent value.
 */
export type InferParsedParams<TSchema extends ParamSchema, Absent = undefined> = {
  [K in keyof TSchema]: TSchema[K] extends { type: 'array' }
    ? string[]
    : TSchema[K] extends { default: infer D }
      ? D
      : TSchema[K]['type'] extends infer T
        ? T extends JSType
          ? OutputTypeForJSType<T> | Absent
          : never
        : never;
};

function coerceScalar(raw: string | undefined, config: ParamConfig): unknown {
  if (raw === undefined || raw === '') return undefined;
  switch (config.type) {
    case 'int': {
      const int = config;
      // ONE integer grammar, default or not. Without a declared default the
      // fallback is `undefined` (an unparseable value is absent), which
      // `positiveInt` returns untouched — the branch used to open-code the
      // truncation, the min floor and the max clamp a second time.
      return positiveInt<undefined>(raw, int.default as undefined, { min: int.min, max: int.max });
    }
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'object':
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    default:
      return raw;
  }
}

/**
 * Parse a URL into a schema's shape. THE reader — the server route and the
 * client hook both call this, so a URL means exactly one thing.
 *
 * PRECEDENCE: an absent or empty SCALAR takes the declared `default` when there
 * is one, else the `absent` value. ARRAY keys never take `absent`: they are `[]`.
 */
export function parseSchemaParams<TSchema extends ParamSchema, Opts extends ParseSchemaOptions = Record<string, never>>(
  schema: TSchema,
  input: ParamInput,
  options?: Opts,
): InferParsedParams<TSchema, AbsentValue<Opts>> {
  const absent = options?.absent === 'null' ? null : undefined;
  const out: Record<string, unknown> = {};
  for (const [key, config] of Object.entries(schema)) {
    if (config.type === 'array') {
      const values = allParamValues(input, key);
      out[key] = values.length > 0 ? values : (config.default ?? []);
      continue;
    }
    const coerced = coerceScalar(firstParamValue(input, key), config);
    out[key] = coerced !== undefined ? coerced : (config.default ?? absent);
  }
  return out as InferParsedParams<TSchema, AbsentValue<Opts>>;
}

// ── Writing ─────────────────────────────────────────────────────────────────

/**
 * A schema entry OR a legacy flattened param (which spells its default
 * `defaultValue`).
 *
 * A UNION, not a bag of two optional fields: with only `default?` and
 * `defaultValue?` this is a WEAK TYPE, and TypeScript rejects any argument
 * sharing neither — including `{ type: 'string' }`, the single most common
 * schema entry there is. Naming the real config shapes fixes that without an
 * index signature, which `FlattenedParam` (an interface) could never satisfy.
 */
type OmissionConfig = ParamConfig | { default?: unknown; defaultValue?: unknown };

/**
 * THE omission rule: `null`, `undefined`, `''`, `[]`, and a value equal to the
 * declared default are left out, so a URL only ever carries what differs.
 */
export function shouldIncludeInUrl(value: unknown, config: OmissionConfig | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (value === '') return false;
  // `in` narrowing rather than a cast: the union's members genuinely differ —
  // a schema entry spells its default `default`, a flattened param spells it
  // `defaultValue`, and neither is obliged to carry the other's field.
  const fromDefault = config && 'default' in config ? config.default : undefined;
  const fromLegacy = config && 'defaultValue' in config ? config.defaultValue : undefined;
  const declared = fromDefault !== undefined ? fromDefault : fromLegacy;
  if (declared !== undefined && value === declared) return false;
  return true;
}

export interface CreateSearchParamsOptions {
  /** Join arrays with this separator instead of repeating the key (`;` for the hub's list APIs). */
  arrayJoin?: string;
}

/** Build `URLSearchParams` from a value record (arrays repeat the key by default). */
export function createSearchParams(
  params: Record<string, unknown>,
  { arrayJoin }: CreateSearchParamsOptions = {},
): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // The emptiness half of the omission rule has ONE owner. (No config here:
    // callers that must also drop schema DEFAULTS filter through
    // `shouldIncludeInUrl` with the config first — see `serializeSchemaParams`.)
    if (!shouldIncludeInUrl(value, undefined)) continue;
    if (Array.isArray(value)) {
      // Empty ELEMENTS are dropped, and an array that filters to nothing is
      // absent (a cleared multi-select must not leave `?tags=` behind).
      const items = value.filter(v => v !== null && v !== undefined && v !== '');
      if (items.length === 0) continue;
      if (arrayJoin) search.set(key, items.join(arrayJoin));
      else for (const item of items) search.append(key, String(item));
      continue;
    }
    if (typeof value === 'object') {
      search.set(key, JSON.stringify(value));
      continue;
    }
    search.set(key, String(value));
  }
  return search;
}

/** Serialize params to a query string, omitting everything `shouldIncludeInUrl` rejects. */
export function serializeSchemaParams<TSchema extends ParamSchema>(
  schema: TSchema,
  params: Record<string, unknown>,
  options?: CreateSearchParamsOptions,
): string {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (shouldIncludeInUrl(value, schema[key])) kept[key] = value;
  }
  return createSearchParams(kept, options).toString();
}

/** Append a query string to a path, or return the path unchanged when it is empty. */
export function withQuery(path: string, queryString: string | null | undefined): string {
  return queryString ? `${path}?${queryString}` : path;
}
