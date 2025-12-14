import { useState, useEffect } from 'react';
import type { PlatformConfig, PlatformOption } from '../../types/platform';
import { transformPlatformConfigsToOptions } from '../../utils/platform-config';
import type { SelectableOption } from '../../components/features';

export interface UsePlatformConfigResult {
  platforms: PlatformConfig[];
  platformOptions: PlatformOption[];
  selectableOptions: SelectableOption[];  // Rich options with icons and colors
  isLoading: boolean;
  error: Error | null;
}

// Cache for platform configs to avoid repeated fetches
let platformCache: PlatformConfig[] | null = null;
let fetchPromise: Promise<PlatformConfig[]> | null = null;

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
    // If we already have cached platforms, use them
    if (platformCache) {
      setPlatforms(platformCache);
      setIsLoading(false);
      return;
    }

    // If a fetch is already in progress, wait for it
    if (fetchPromise) {
      fetchPromise
        .then(data => {
          setPlatforms(data);
          setIsLoading(false);
        })
        .catch(err => {
          setError(err);
          setIsLoading(false);
        });
      return;
    }

    // Start a new fetch
    console.log('🔧 Fetching platform configurations from API (should only happen once)');
    
    fetchPromise = fetch('/api/config/platforms')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch platform config: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        const platforms = data.platforms || data;
        console.log('✅ Platform configurations loaded:', platforms.length, 'platforms');
        platformCache = platforms;
        fetchPromise = null;
        return platforms;
      });

    fetchPromise
      .then(data => {
        setPlatforms(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('❌ Failed to fetch platform config:', err);
        setError(err);
        setIsLoading(false);
        fetchPromise = null;
      });
  }, []);
  
  // Create options for dropdowns with "All Platforms" option
  const platformOptions: PlatformOption[] = [
    { value: 'all', label: 'All Platforms' },
    ...platforms.map((platform: PlatformConfig) => ({
      value: platform.value,
      label: platform.label
    }))
  ];

  // Create rich selectable options with icons and colors
  const selectableOptions = transformPlatformConfigsToOptions(platforms);

  return {
    platforms,
    platformOptions,
    selectableOptions,
    isLoading,
    error
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