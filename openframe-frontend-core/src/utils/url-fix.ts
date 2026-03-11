/**
 * Utility functions for fixing URL construction issues
 */

/**
 * Fix double slashes in URLs while preserving protocol slashes
 * @param url The URL to fix
 * @returns Fixed URL with single slashes in path
 */
export function fixUrlDoubleSlashes(url: string): string {
  if (!url) return url;

  // Split on protocol to preserve it
  const protocolMatch = url.match(/^(https?:\/\/)/);
  if (protocolMatch) {
    const protocol = protocolMatch[1];
    const rest = url.substring(protocol.length);
    // Replace multiple consecutive slashes with single slash in the path part
    const fixedRest = rest.replace(/\/+/g, '/');
    return protocol + fixedRest;
  }

  // For relative URLs, just fix multiple slashes
  return url.replace(/\/+/g, '/');
}

/**
 * Properly join URL path segments without creating double slashes
 * @param segments Path segments to join
 * @returns Properly joined path
 */
export function joinUrlPath(...segments: string[]): string {
  return segments
    .map((segment, index) => {
      let s = segment;
      // Remove leading slash from all but first segment
      if (index > 0 && s.startsWith('/')) {
        s = s.substring(1);
      }
      // Remove trailing slash from all but last segment
      if (index < segments.length - 1 && s.endsWith('/')) {
        s = s.substring(0, s.length - 1);
      }
      return s;
    })
    .filter(segment => segment.length > 0)
    .join('/');
}

/**
 * Fix Supabase storage URLs specifically
 * @param url Supabase storage URL
 * @returns Fixed URL
 */
export function fixSupabaseStorageUrl(url: string): string {
  // Early return if nothing to process
  if (!url) return url;

  /**
   * We previously restricted the fix to URLs that contained a specific Supabase
   * domain ("supabase.co"). However, we now serve assets from a custom domain
   * (e.g. app.openmsp.ai) that still uses the same `/storage/v1/object/public/`
   * path structure. The old guard clause prevented those URLs from being
   * cleaned which resulted in paths like:
   *   https://app.openmsp.ai/storage/v1/object/public/logos///Ansible.png
   * Googlebot treats the triple-slash as a distinct resource and reports 404
   * errors which in turn causes the "URL will be indexed only if certain
   * conditions are met" warning in Search Console.
   *
   * Solution: detect the canonical Supabase storage path segment instead of
   * the host name. Whenever we see that path we safely collapse multiple
   * consecutive slashes to a single slash while preserving the protocol
   * (`https://`).
   */

  const SUPABASE_STORAGE_SEGMENT = '/storage/v1/object/public/';

  if (url.includes(SUPABASE_STORAGE_SEGMENT)) {
    return fixUrlDoubleSlashes(url);
  }

  // No known storage segment – return the original URL untouched
  return url;
}
