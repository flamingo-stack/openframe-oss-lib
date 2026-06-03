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

import { useState, useEffect, useCallback } from 'react';

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

/**
 * Hook to fetch a legal document.
 * @param docType — short identifier for the document (drives the
 *   default endpoint path AND the error-log prefix). Common values:
 *   `'privacy'` (SECURITY.md), `'terms'` (LICENSE). Embedders may use
 *   any string — the hook treats it as opaque.
 */
export function useLegalDocs(
  docType: string,
  options: UseLegalDocsOptions = {}
): UseLegalDocsReturn {
  const { initialData = null, apiEndpoint } = options;
  const effectiveEndpoint = apiEndpoint ?? `/api/legal/${docType}`;

  const [data, setData] = useState<LegalDocument | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(effectiveEndpoint);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${docType} document: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // Validate the response has required fields
      if (!result.content) {
        throw new Error(`${docType} document content is empty`);
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      // `docType` is externally controlled (URL path segment in embedders), so it must NOT sit in
      // console.error's FIRST (format-string) argument — Node interprets %s/%j/%o there
      // (CodeQL js/tainted-format-string). Keep the format string constant; pass docType + err as
      // plain trailing args.
      console.error('Error fetching legal document:', docType, err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [docType, effectiveEndpoint]);

  // Reset cached data when docType changes — otherwise an embedder using
  // the same hook instance for sequential docTypes (privacy → terms)
  // would briefly render the OLD doc's content while the new fetch is
  // in-flight. Not currently triggered by hub's per-route SSR (each
  // docType mounts in a fresh component), but enforces the contract.
  useEffect(() => {
    setData(initialData ?? null);
    setError(null);
    setIsLoading(!initialData);
  }, [docType, initialData]);

  // Fetch on mount (only if we don't already have server-provided initialData)
  useEffect(() => {
    if (initialData) return;
    fetchDocument();
  }, [fetchDocument, initialData]);

  const refetch = () => {
    fetchDocument();
  };

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
