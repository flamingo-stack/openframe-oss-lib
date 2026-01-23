import type { TableColumn, TailwindBreakpoint } from './types'

/**
 * Generates Tailwind hide classes based on breakpoint configuration
 * @param hideAt - Breakpoint(s) at which to hide the column
 * @returns Tailwind classes to hide the column at specified breakpoints
 *
 * @example
 * getHideClasses('md') // Returns: 'hidden md:flex'
 * getHideClasses(['sm', 'md']) // Returns: 'sm:hidden md:hidden lg:flex'
 * getHideClasses(undefined, true) // Returns: 'hidden md:flex' (backward compatibility)
 */
export function getHideClasses(
  hideAt?: TailwindBreakpoint | TailwindBreakpoint[],
): string {
  if (!hideAt) {
    return ''
  }

  // Convert single breakpoint to array for uniform handling
  const breakpoints = Array.isArray(hideAt) ? hideAt : [hideAt]

  // Breakpoint order for Tailwind (smallest to largest)
  const breakpointOrder: TailwindBreakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl']

  // Find the largest breakpoint in the hideAt array
  const maxBreakpointIndex = Math.max(
    ...breakpoints.map(bp => breakpointOrder.indexOf(bp))
  )

  // For single breakpoint: hide below, show at and above
  // e.g., hideAt: 'md' -> 'hidden md:flex'
  if (breakpoints.length === 1) {
    return `hidden ${breakpoints[0]}:flex`
  }

  // For multiple breakpoints: hide at specified breakpoints, show after the largest one
  // e.g., hideAt: ['sm', 'md'] -> 'sm:hidden md:hidden lg:flex'
  const hideClasses = breakpoints
    .map(bp => `${bp}:hidden`)
    .join(' ')

  // Find next breakpoint after the max to show the column
  const nextBreakpointIndex = maxBreakpointIndex + 1
  const showBreakpoint = breakpointOrder[nextBreakpointIndex]

  if (showBreakpoint) {
    return `${hideClasses} ${showBreakpoint}:flex`
  }

  // If no next breakpoint (e.g., hideAt: '2xl'), just hide
  return hideClasses
}

/**
 * Checks if a column should be hidden at mobile breakpoints
 * Used for filtering columns in mobile view
 */
export function isHiddenOnMobile<T>(column: TableColumn<T>): boolean {
  if (!column.hideAt) {
    return false
  }

  const breakpoints = Array.isArray(column.hideAt) ? column.hideAt : [column.hideAt]

  // Check if 'sm' or 'md' is in the list (mobile breakpoints)
  return breakpoints.some(bp => bp === 'sm' || bp === 'md')
}
