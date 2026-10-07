import type { TableColumn, TailwindBreakpoint } from './types';

/** @deprecated Use `data-table` instead. */
export function getHideClasses(hideAt?: TailwindBreakpoint | TailwindBreakpoint[]): string {
  if (!hideAt) {
    return '';
  }

  // Convert single breakpoint to array for uniform handling
  const breakpoints = Array.isArray(hideAt) ? hideAt : [hideAt];

  // Breakpoint order for Tailwind (smallest to largest)
  const breakpointOrder: TailwindBreakpoint[] = ['md', 'lg', 'xl', '2xl'];

  // Find the largest breakpoint in the hideAt array
  const maxBreakpointIndex = Math.max(...breakpoints.map(bp => breakpointOrder.indexOf(bp)));

  // For single breakpoint: hide below, show at and above
  // e.g., hideAt: 'md' -> 'hidden content-md:flex'
  if (breakpoints.length === 1) {
    return `hidden content-${breakpoints[0]}:flex`;
  }

  // For multiple breakpoints: hide at specified breakpoints, show after the largest one
  // e.g., hideAt: ['md', 'lg'] -> 'content-md:hidden content-lg:hidden content-xl:flex'
  const hideClasses = breakpoints.map(bp => `content-${bp}:hidden`).join(' ');

  // Find next breakpoint after the max to show the column
  const nextBreakpointIndex = maxBreakpointIndex + 1;
  const showBreakpoint = breakpointOrder[nextBreakpointIndex];

  if (showBreakpoint) {
    return `${hideClasses} content-${showBreakpoint}:flex`;
  }

  // If no next breakpoint (e.g., hideAt: '2xl'), just hide
  return hideClasses;
}

/** @deprecated Use `data-table` instead. */
export function isHiddenOnMobile<T>(column: TableColumn<T>): boolean {
  if (!column.hideAt) {
    return false;
  }

  const breakpoints = Array.isArray(column.hideAt) ? column.hideAt : [column.hideAt];

  // Check if 'md' is in the list (mobile breakpoints)
  return breakpoints.some(bp => bp === 'md');
}
