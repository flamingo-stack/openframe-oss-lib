'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { Progress } from '../ui/progress';

type LoadingContextType = {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // The jump to 10% (start) and 100% (finish) is a reset driven by a value we
  // already have while rendering, so it happens here rather than in the effect.
  //
  // It also fixes a flash: the effect's `else` branch ran on MOUNT too, so every
  // LoadingProvider painted a full-width white bar at 100% and then spent 500ms
  // fading it away before anything had ever loaded. Edge-triggering means a
  // mount that was never loading shows no bar at all.
  const [progressFor, setProgressFor] = useState(isLoading);
  if (progressFor !== isLoading) {
    setProgressFor(isLoading);
    setProgress(isLoading ? 10 : 100);
  }

  // Simulate progress when loading
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setProgress(prevProgress => {
          if (prevProgress >= 90) {
            clearInterval(interval);
            return prevProgress;
          }
          return prevProgress + (90 - prevProgress) * 0.1;
        });
      }, 200);
      return () => clearInterval(interval);
    }

    const timeout = setTimeout(() => {
      setProgress(0);
    }, 500);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {progress > 0 && (
        <Progress
          value={progress}
          className="fixed left-0 right-0 top-0 z-50 h-1 w-full rounded-none bg-transparent"
          indicatorClassName="bg-white transition-all duration-300 ease-in-out"
        />
      )}
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
