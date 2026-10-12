'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Progress } from '../ui/progress';

type LoadingContextType = {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

/**
 * The page-load bar and the switch that drives it.
 *
 * The context value changes ONLY when `isLoading` does. This provider wraps the
 * whole app, and a new value object on every render (the bar's own progress
 * ticks included) reads to React as an update to everything below it: any part
 * of the page that had not hydrated yet was thrown away and drawn again in the
 * browser (measured on a slow connection: the home page's heading was drawn a
 * second time seconds after it was first shown).
 */
export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const value = useMemo(() => ({ isLoading, setIsLoading }), [isLoading]);

  return (
    <LoadingContext.Provider value={value}>
      <LoadingBar isLoading={isLoading} />
      {children}
    </LoadingContext.Provider>
  );
}

/** The bar itself: it creeps towards 90% while loading and completes when the load ends. */
function LoadingBar({ isLoading }: { isLoading: boolean }) {
  const [wasLoading, setWasLoading] = useState(isLoading);
  const [crept, setCrept] = useState(10);
  const [finishing, setFinishing] = useState(false);

  // A load that starts begins at 10%; one that ends completes the bar. A page that never loaded has nothing to complete.
  if (wasLoading !== isLoading) {
    setWasLoading(isLoading);
    setFinishing(!isLoading);
    if (isLoading) setCrept(10);
  }

  useEffect(() => {
    if (!isLoading) return undefined;
    const interval = setInterval(() => {
      setCrept(previous => (previous >= 90 ? previous : previous + (90 - previous) * 0.1));
    }, 200);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (!finishing) return undefined;
    const timeout = setTimeout(() => setFinishing(false), 500);
    return () => clearTimeout(timeout);
  }, [finishing]);

  const progress = isLoading ? crept : finishing ? 100 : 0;
  if (progress <= 0) return null;
  return (
    <Progress
      value={progress}
      className="fixed left-0 right-0 top-0 z-50 h-1 w-full rounded-none bg-transparent"
      indicatorClassName="bg-white transition-all duration-300 ease-in-out"
    />
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
