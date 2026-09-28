import { useState, useEffect } from 'react';
import type { SelectableOption } from '../../components/features';
import type { PlatformConfig, PlatformOption } from '../../types/platform';
import { transformPlatformConfigsToOptions } from '../../utils/platform-config';

export interface UsePlatformConfigResult {
  platforms: PlatformConfig[];
  platformOptions: PlatformOption[];
  selectableOptions: SelectableOption[]; // Rich options with icons and colors
  isLoading: boolean;
  error: Error | null;
}

// Cache for platform configs to avoid repeated fetches
let platformCache: PlatformConfig[] | null = null;
let fetchPromise: Promise<PlatformConfig[]> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** `Array.isArray` narrows `unknown` to `any[]`; this keeps the elements `unknown`. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * Decode `/api/config/platforms`.
 *
 * `Response.json()` is typed `any`, so `data.platforms || data` used to be
 * cached verbatim — including when it was neither an array nor a list of rows
 * (`{ platforms: null }` fell through the `||` and cached the ENVELOPE).
 * That matters more here than at a normal fetch boundary because
 * `platformCache` is MODULE-level: a bad payload is committed once and then
 * served to every later mount for the rest of the session, and
 * `platforms.map(...)` in the hook body throws on each one. Returning null
 * instead routes the payload into the hook's existing `error` state and leaves
 * the cache empty, so a later mount can retry.
 *
 * Row decoding is deliberately tolerant: `value`/`name` and `label`/
 * `display_name` are documented as the same string, so either spelling
 * satisfies the pair, and the purely presentational fields fall back to '' —
 * a platform missing its description should still appear in the filter rather
 * than vanish from it or render `undefined`.
 */
function toPlatformConfigs(payload: unknown): PlatformConfig[] | null {
  const rows = isRecord(payload) && 'platforms' in payload ? payload.platforms : payload;
  if (!isUnknownArray(rows)) return null;

  const configs: PlatformConfig[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const read = (key: string): string | undefined => {
      const value = row[key];
      return typeof value === 'string' && value ? value : undefined;
    };

    const value = read('value') ?? read('name');
    if (value === undefined) continue;
    const label = read('label') ?? read('display_name') ?? value;

    configs.push({
      id: read('id') ?? value,
      value,
      label,
      name: read('name') ?? value,
      display_name: read('display_name') ?? label,
      default_color: read('default_color') ?? '',
      default_icon: read('default_icon') ?? '',
      description: read('description') ?? '',
    });
  }
  return configs;
}

/**
 * Custom hook to fetch platform configurations from API
 * Provides both full platform configs and simplified options for dropdowns
 * Heavily cached to prevent excessive API calls - should only call once per session
 *
 * NOTE: This hook is designed to work without react-query dependency
 */
export function usePlatformConfig(): UsePlatformConfigResult {
  const [platforms, setPlatforms] = useState<PlatformConfig[]>(platformCache || []);
  const [isLoading, setIsLoading] = useState(!platformCache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // `platformCache` / `fetchPromise` are module-level: an external store, as
    // far as React is concerned. Every path below hands its outcome to the same
    // pair of commit callbacks instead of repeating three near-identical
    // setState pairs.
    //
    // The identity bail-out is what keeps the cached path free: the useState
    // initialisers above already read `platformCache`, so re-committing the
    // very same array must not schedule a render. It still commits when the
    // cache was filled by another instance's fetch *between* this component's
    // first render and this effect — the only case where the branch does
    // anything at all.
    const commit = (data: PlatformConfig[]) => {
      setPlatforms(prev => (prev === data ? prev : data));
      setIsLoading(false);
    };
    const fail = (err: unknown) => {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    };

    // If we already have cached platforms, use them
    if (platformCache) {
      commit(platformCache);
      return;
    }

    // If a fetch is already in progress, wait for it
    if (fetchPromise) {
      fetchPromise.then(commit).catch(fail);
      return;
    }

    // Start a new fetch
    console.log('🔧 Fetching platform configurations from API (should only happen once)');

    fetchPromise = fetch('/api/config/platforms')
      .then((response): Promise<unknown> => {
        if (!response.ok) {
          throw new Error(`Failed to fetch platform config: ${response.statusText}`);
        }
        return response.json();
      })
      .then(payload => {
        const loadedPlatforms = toPlatformConfigs(payload);
        if (!loadedPlatforms) {
          // Deliberately thrown rather than cached: see `toPlatformConfigs`.
          throw new Error('Platform config response did not contain a platform list');
        }
        console.log('✅ Platform configurations loaded:', loadedPlatforms.length, 'platforms');
        platformCache = loadedPlatforms;
        fetchPromise = null;
        return loadedPlatforms;
      });

    fetchPromise.then(commit).catch((err: unknown) => {
      console.error('❌ Failed to fetch platform config:', err);
      fail(err);
      fetchPromise = null;
    });
  }, []);

  // Create options for dropdowns with "All Platforms" option
  const platformOptions: PlatformOption[] = [
    { value: 'all', label: 'All Platforms' },
    ...platforms.map((platform: PlatformConfig) => ({
      value: platform.value,
      label: platform.label,
    })),
  ];

  // Create rich selectable options with icons and colors
  const selectableOptions = transformPlatformConfigsToOptions(platforms);

  return {
    platforms,
    platformOptions,
    selectableOptions,
    isLoading,
    error,
  };
}

/**
 * Get platform configuration by value
 */
export function usePlatformByValue(value: string): PlatformConfig | undefined {
  const { platforms } = usePlatformConfig();
  return platforms.find(platform => platform.value === value);
}

/**
 * Check if a platform value is valid
 */
export function useValidatePlatform(value: string): boolean {
  const { platforms } = usePlatformConfig();
  return platforms.some(platform => platform.value === value);
}
