"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { Progress } from "../ui/progress"

type LoadingContextType = {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  // Simulate progress when loading
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isLoading) {
      setProgress(10)

      interval = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 90) {
            clearInterval(interval)
            return prevProgress
          }
          return prevProgress + (90 - prevProgress) * 0.1
        })
      }, 200)
    } else {
      setProgress(100)
      const timeout = setTimeout(() => {
        setProgress(0)
      }, 500)

      return () => clearTimeout(timeout)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isLoading])

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {progress > 0 && (
        <Progress
          value={progress}
          className="fixed top-0 left-0 right-0 z-50 h-1 w-full rounded-none bg-transparent"
          indicatorClassName="bg-white transition-all duration-300 ease-in-out"
        />
      )}
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error("useLoading must be used within a LoadingProvider")
  }
  return context
}
