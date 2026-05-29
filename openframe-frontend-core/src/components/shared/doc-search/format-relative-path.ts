/**
 * Format a full document path as a breadcrumb trail.
 * Shows parent folders only (excludes the last segment / filename).
 *
 * @example
 *   formatRelativePath('openframe-oss-tenant/architecture/api-controllers.md')
 *   // → 'Openframe oss tenant / Architecture'
 */
export function formatRelativePath(fullPath: string): string {
  if (!fullPath) return ''
  const segments = fullPath.replace(/\.md$/, '').split('/')
  // Show only parent path (exclude the filename itself since the title already shows it)
  const parentSegments = segments.length > 1 ? segments.slice(0, -1) : segments
  return parentSegments
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '))
    .join(' / ')
}
