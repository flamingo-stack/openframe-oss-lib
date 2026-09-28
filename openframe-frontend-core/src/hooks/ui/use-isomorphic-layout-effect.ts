'use client';

import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * `useLayoutEffect` never runs during server rendering — React cannot measure or
 * mutate a layout that has not been laid out — so calling it in a component that
 * SSRs logs a warning on every render pass. Client components still render on the
 * server in Next.js, so `'use client'` alone does not avoid it.
 *
 * Use this wherever the effect writes something the FIRST paint depends on (a CSS
 * custom property, a scroll position, a measured size). A plain `useEffect` there
 * runs after paint, which shows one frame of the pre-effect value; a plain
 * `useLayoutEffect` gets the timing right and pays for it with the warning. This
 * gets both: paint-blocking where there is a paint, a no-op where there is not.
 */
export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;
