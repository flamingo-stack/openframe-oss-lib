"use client"

import { useState, useEffect, useRef } from "react"

/**
 * Hook to use localStorage with state
 * @param key - localStorage key
 * @param initialValue - Initial value if key doesn't exist
 * @returns [storedValue, setValue] tuple
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue)

  // Use a ref to track if we've initialized from localStorage
  const isInitialized = useRef(false)
  // Use a ref to track if the current state change came from a storage event
  const isFromStorageEvent = useRef(false)

  // Initialize from localStorage on mount only
  useEffect(() => {
    if (isInitialized.current) return

    try {
      // Get from local storage by key
      if (typeof window !== "undefined") {
        const item = window.localStorage.getItem(key)
        // Parse stored json or if none return initialValue
        if (item) {
          setStoredValue(JSON.parse(item))
        }
      }
    } catch (error) {
      // If error also return initialValue
      console.error(`Error reading localStorage key "${key}":`, error)
    } finally {
      isInitialized.current = true
    }
  }, [key, initialValue])

  // Listen for storage events to sync with other tabs/components
  useEffect(() => {
    if (!isInitialized.current) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue)
          isFromStorageEvent.current = true
          setStoredValue(newValue)
          console.log(`🔄 Updated localStorage key "${key}" from storage event`)
        } catch (error) {
          console.error(`Error parsing storage event for key "${key}":`, error)
        }
      }
    }

    const handleCustomStorageUpdate = (e: CustomEvent) => {
      if (e.detail.key === key) {
        try {
          if (e.detail.newValue === null || e.detail.newValue === undefined) {
            // localStorage was cleared or key was removed
            isFromStorageEvent.current = true
            setStoredValue(initialValue)
            console.log(`🔄 Cleared localStorage key "${key}" from custom storage event`)
          } else {
            const newValue = JSON.parse(e.detail.newValue)
            isFromStorageEvent.current = true
            setStoredValue(newValue)
            console.log(`🔄 Updated localStorage key "${key}" from custom storage event`)
          }
        } catch (error) {
          console.error(`Error parsing custom storage event for key "${key}":`, error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('localStorageUpdate', handleCustomStorageUpdate as EventListener)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localStorageUpdate', handleCustomStorageUpdate as EventListener)
    }
  }, [key])

  // Update localStorage when state changes, but only after initialization and NOT from storage events
  useEffect(() => {
    if (!isInitialized.current) return

    // Skip localStorage write if this state change came from a storage event
    if (isFromStorageEvent.current) {
      isFromStorageEvent.current = false
      return
    }

    try {
      // Save state to localStorage
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(storedValue))
      }
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      // Save state
      setStoredValue(valueToStore)
    } catch (error) {
      console.error(`Error setting value for localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue]
}
