'use client';

/**
 * useLegalDocs — fetches a legal document (privacy policy, terms of
 * service, or any other markdown-backed legal page) from a hub API.
 *
 * Endpoint configuration — `apiEndpoint`:
 *   Default `/api/legal/<docType>`. Reverse-proxy embedders override
 *   with their proxied path (e.g. `/proxy/legal/privacy`).
 *
 * Data shape mirrors the hub's `lib/data/legal-utils.ts:LegalDocument`
 * server type. The hook intentionally re-declares the type here so
 * lib consumers don't need to import a server-side type.
 */

import { useState, useEffect, useRef } from 'react';
import { contentFetch } from '../../../utils/embed-content-fetch';

export interface LegalDocument {
  title: string;
  content: string;
  sourceFile: string;
  lastSynced: string | null;
  githubSha: string | null;
  sections: Array<{ id: string; title: string; level: number }>;
  docType: string;
  meta: {
    sectionsCount: number;
    contentLength: number;
    lastSyncedAgo: string;
  };
}

export interface UseLegalDocsReturn {
  data: LegalDocument | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseLegalDocsOptions {
  /** Optional pre-fetched payload from server (SSR / RSC). When set,
   *  the hook skips the initial client fetch. */
  initialData?: LegalDocument | null;
  /** Full GET endpoint URL. Default `/api/legal/<docType>`. */
  apiEndpoint?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** `Array.isArray` narrows `unknown` to `any[]`; this keeps the elements `unknown`. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function toSections(value: unknown): LegalDocument['sections'] {
  if (!isUnknownArray(value)) return [];
  const sections: LegalDocument['sections'] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = readString(entry, 'id');
    const title = readString(entry, 'title');
    const level = entry.level;
    if (id === undefined || title === undefined || typeof level !== 'number') continue;
    sections.push({ id, title, level });
  }
  return sections;
}

/**
 * Decode the endpoint's answer into a `LegalDocument`.
 *
 * `Response.json()` is typed `any`, so the body used to be stored as a
 * `LegalDocument` after a single `!result.content` check — every other field of
 * the interface was a promise the wire had never been asked to keep. Missing
 * ones surfaced downstream as `undefined` (`sections` is indexed by the
 * markdown renderer) or as `NaN` (`meta.sectionsCount` / `meta.contentLength`
 * are declared `number` and are counts, so any arithmetic on an absent one
 * poisons the result rather than reading as zero).
 *
 * `content` stays the one hard requirement — null here reproduces the previous
 * "document content is empty" failure exactly. The remaining fields fall back
 * to values derived from what did arrive, so a sparse-but-usable document
 * still renders.
 */
function toLegalDocument(payload: unknown, docType: string): LegalDocument | null {
  if (!isRecord(payload)) return null;

  const content = readString(payload, 'content');
  if (!content) return null;

  const lastSynced = payload.lastSynced;
  const githubSha = payload.githubSha;
  const sections = toSections(payload.sections);
  const meta = isRecord(payload.meta) ? payload.meta : {};
  const sectionsCount = meta.sectionsCount;
  const contentLength = meta.contentLength;

  return {
    title: readString(payload, 'title') ?? '',
    content,
    sourceFile: readString(payload, 'sourceFile') ?? '',
    lastSynced: typeof lastSynced === 'string' ? lastSynced : null,
    githubSha: typeof githubSha === 'string' ? githubSha : null,
    sections,
    docType: readString(payload, 'docType') ?? docType,
    meta: {
      sectionsCount: typeof sectionsCount === 'number' ? sectionsCount : sections.length,
      contentLength: typeof contentLength === 'number' ? contentLength : content.length,
      lastSyncedAgo: readString(meta, 'lastSyncedAgo') ?? '',
    },
  };
}

/**
 * Hook to fetch a legal document.
 * @param docType — short identifier for the document (drives the
 *   default endpoint path AND the error-log prefix). Common values:
 *   `'privacy'` (SECURITY.md), `'terms'` (LICENSE). Embedders may use
 *   any string — the hook treats it as opaque.
 */
export function useLegalDocs(docType: string, options: UseLegalDocsOptions = {}): UseLegalDocsReturn {
  const { initialData = null, apiEndpoint } = options;
  const effectiveEndpoint = apiEndpoint ?? `/api/legal/${docType}`;

  const [data, setData] = useState<LegalDocument | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Monotonic request id. The fetch re-runs on every `docType` / endpoint
  // change AND on every `refetch()`, so two runs can overlap; only the newest
  // may write. The reset below clears the state, but on its own it cannot stop
  // the OLD doc's in-flight response from landing afterwards and pinning the
  // PREVIOUS document's content permanently.
  const requestIdRef = useRef(0);
  // Bumped by `refetch()`. The effect is the single owner of the request, the
  // way `useSelfFetch` is built — a component-scope `fetchDocument` that the
  // effect called synchronously read as a setState in an effect body.
  const [reloadCount, setReloadCount] = useState(0);

  // Reset cached data when docType changes — otherwise an embedder using
  // the same hook instance for sequential docTypes (privacy → terms)
  // would briefly render the OLD doc's content while the new fetch is
  // in-flight. Not currently triggered by hub's per-route SSR (each
  // docType mounts in a fresh component), but enforces the contract.
  //
  // Adjusted while rendering — React's documented pattern for a prop-driven
  // reset — rather than from an effect, which is precisely one commit too late:
  // the render that switched docType still painted the previous document. The
  // endpoint joins the key because a changed `apiEndpoint` also means a
  // different source for the same docType, and it is what re-fires the fetch
  // below. A fresh source also drops any pending `refetch()` count: the skip
  // for server-provided data applies again to the NEW data.
  const [syncedFor, setSyncedFor] = useState({ docType, initialData, effectiveEndpoint });
  if (
    syncedFor.docType !== docType ||
    syncedFor.initialData !== initialData ||
    syncedFor.effectiveEndpoint !== effectiveEndpoint
  ) {
    setSyncedFor({ docType, initialData, effectiveEndpoint });
    setData(initialData ?? null);
    setError(null);
    setIsLoading(!initialData);
    setReloadCount(0);
  }

  // Fetch on mount (only if we don't already have server-provided initialData),
  // and on every explicit `refetch()`.
  useEffect(() => {
    if (initialData && reloadCount === 0) return;

    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;

    const fetchDocument = async () => {
      try {
        const response = await contentFetch(effectiveEndpoint);

        if (!response.ok) {
          throw new Error(`Failed to fetch ${docType} document: ${response.status} ${response.statusText}`);
        }

        const payload: unknown = await response.json();

        // Validate the response has required fields
        const document = toLegalDocument(payload, docType);
        if (!document) {
          throw new Error(`${docType} document content is empty`);
        }

        if (!isCurrent()) return;
        setData(document);
      } catch (err) {
        if (!isCurrent()) return;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        // `docType` is externally controlled (URL path segment in embedders), so it must NOT sit in
        // console.error's FIRST (format-string) argument — Node interprets %s/%j/%o there
        // (CodeQL js/tainted-format-string). Keep the format string constant; pass docType + err as
        // plain trailing args.
        console.error('Error fetching legal document:', docType, err);
        setError(errorMessage);
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    };

    // Never rejects — settles every failure into `error` state.
    void fetchDocument();
  }, [docType, effectiveEndpoint, initialData, reloadCount]);

  const refetch = () => {
    // An explicit retry starts from a settled (usually errored) state, so it
    // enters the loading phase itself — on mount and after a reset the pair
    // already says "loading, no error" before the effect above runs.
    setIsLoading(true);
    setError(null);
    setReloadCount(c => c + 1);
  };

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
