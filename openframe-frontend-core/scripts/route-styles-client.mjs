'use client';
/**
 * The client part of `RouteStyles` (`./route-styles-server.mjs`). In the server render it asks the resolver the
 * server part put in the process for the rules of the page's path, and renders them. In the browser it renders the
 * same `<style>` empty, under the same `href`: React finds the server's copy in the head by its `href` and keeps it,
 * and after a client navigation the complete sheet holds every rule. The loader starts the complete sheet when the HTML reaches it,
 * without blocking paint, and appends it after every other stylesheet so its rules are the last copy of each.
 *
 * A page the server did not render (Next answers a 404 with an empty error shell and draws it from its data in the
 * browser) has neither the rules nor the loader: the effect then loads the complete sheet itself, from the address
 * the build wrote into the bundle.
 */
import { usePathname } from 'next/navigation';
import { createElement, Fragment, useEffect } from 'react';
import markers from './route-styles-markers.cjs';

const REGISTRY = Symbol.for(markers.REGISTRY_KEY);
const FULL_URL = process.env.NEXT_STYLES_FULL_URL || '';
/** Appends the complete sheet named by its own `<script data-next-styles-full>` once, at low priority. */
const LOADER =
  "(function(s){var h=s&&s.getAttribute('data-next-styles-full');" +
  "if(!h||document.querySelector('link[data-next-styles-full]'))return;" +
  "var l=document.createElement('link');l.rel='stylesheet';l.href=h;l.fetchPriority='low';" +
  "l.setAttribute('data-next-styles-full','');document.head.appendChild(l)})(document.currentScript)";

/** The complete sheet, once, unless the server wrote this page's rules (its loader then started the sheet already). */
function loadCompleteSheet(build) {
  if (!FULL_URL || document.querySelector('link[data-next-styles-full]')) return;
  if (document.querySelector(`style[data-href="next-styles:${build}"]`)?.textContent) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FULL_URL;
  link.setAttribute('data-next-styles-full', '');
  document.head.appendChild(link);
}

export function RouteStyle({ build, complete }) {
  const pathname = usePathname();
  useEffect(() => loadCompleteSheet(build), [build]);
  let entry;
  if (typeof window === 'undefined') {
    const resolve = globalThis[REGISTRY]?.get(build);
    if (!resolve) {
      // The server part runs first in this process; without its resolver the page would have no utilities.
      throw new Error('next-styles: RouteStyle rendered without RouteStyles in this process');
    }
    entry = resolve(pathname, complete);
  }
  return createElement(
    Fragment,
    null,
    createElement(
      'style',
      // One href for every page of the build: the browser keeps the first page's copy, and a client
      // navigation inserts no other (the complete sheet already holds every rule by then).
      { href: `next-styles:${build}`, precedence: 'next-styles' },
      entry?.css ?? '',
    ),
    // The complete sheet's address is the server's to state; the browser renders the script without it and
    // keeps the server's attribute (the script already ran when the HTML reached it).
    createElement('script', {
      'data-next-styles-full': entry?.fullUrl ?? undefined,
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: { __html: LOADER },
    }),
  );
}
