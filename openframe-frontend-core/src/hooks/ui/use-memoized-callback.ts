"use client"

import { useCallback, useRef } from "react"

/**
 * Hook to memoize a callback with dependencies
 * Similar to useCallback but with deep comparison of dependencies
 * @param callback - Function to memoize
 * @param dependencies - Dependencies array
 * @returns Memoized callback
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(callback: T, dependencies: any[]): T {
  // Store the callback and dependencies
  const callbackRef = useRef<T>(callback)
  const dependenciesRef = useRef<any[]>(dependencies)

  // Update the callback if it changes
  callbackRef.current = callback

  // Check if dependencies have changed
  const depsChanged = dependencies.some((dep, i) => !Object.is(dep, dependenciesRef.current[i]))

  // Update dependencies if they've changed
  if (depsChanged) {
    dependenciesRef.current = dependencies
  }

  // Return memoized callback
  return useCallback(((...args: any[]) => callbackRef.current(...args)) as T, [depsChanged])
}
