'use client';

/**
 * useLegalDocuments — the list of legal documents a hub publishes (privacy
 * policy, terms of service, payment terms, license, security policy, and
 * whatever it adds later), each with its page and the version it states.
 *
 * A host that lists legal pages reads this list, shows one entry per published
 * document, each leading to that document's own page, and names no document
 * itself: a document the hub adds appears with no change here.
 *
 * Endpoint: default `/api/legal`; an embedder passes its proxied path.
 */

import { useEffect, useState } from 'react';
import { contentFetch } from '../../../utils/embed-content-fetch';
import { useLoadingScope } from '../../ui/loading-scope';

export interface LegalDocumentSummary {
  /** The identifier `useLegalDocs` and `<LegalDocumentPage>` take. */
  docType: string;
  title: string;
  /** One line saying what the document is, for a card that lists it. */
  summary: string;
  /** The document's page on the hub's own site (a path). */
  route: string;
  sourceFile: string;
  version: string | null;
  effectiveDate: string | null;
  /** False while the hub has no content for it yet. */
  published: boolean;
}

export interface UseLegalDocumentsOptions {
  /** Full GET endpoint URL. Default `/api/legal`. */
  apiEndpoint?: string;
  /** False: read nothing and answer an empty list. Default true. */
  enabled?: boolean;
}

export interface UseLegalDocumentsReturn {
  documents: LegalDocumentSummary[];
  isLoading: boolean;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function text(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value ? value : null;
}

/** Decode the endpoint's answer; a row without a type and a title is left out. */
export function toLegalDocumentSummaries(payload: unknown): LegalDocumentSummary[] {
  const rows: unknown = isRecord(payload) ? payload.documents : null;
  if (!Array.isArray(rows)) return [];
  const documents: LegalDocumentSummary[] = [];
  for (const row of rows as readonly unknown[]) {
    if (!isRecord(row)) continue;
    const docType = text(row, 'docType');
    const title = text(row, 'title');
    if (!docType || !title) continue;
    documents.push({
      docType,
      title,
      summary: text(row, 'summary') ?? '',
      route: text(row, 'route') ?? '',
      sourceFile: text(row, 'sourceFile') ?? '',
      version: text(row, 'version'),
      effectiveDate: text(row, 'effectiveDate'),
      published: row.published === true,
    });
  }
  return documents;
}

export function useLegalDocuments(options: UseLegalDocumentsOptions = {}): UseLegalDocumentsReturn {
  const endpoint = options.apiEndpoint ?? '/api/legal';
  // In a loading scope nothing is fetched.
  const held = useLoadingScope();
  const enabled = (options.enabled ?? true) && !held;
  const [state, setState] = useState<UseLegalDocumentsReturn>({ documents: [], isLoading: enabled, error: null });

  useEffect(() => {
    let current = enabled;
    const load = async () => {
      try {
        const response = await contentFetch(endpoint);
        if (!response.ok) throw new Error(`Failed to fetch legal documents: ${response.status} ${response.statusText}`);
        const payload: unknown = await response.json();
        if (current) setState({ documents: toLegalDocumentSummaries(payload), isLoading: false, error: null });
      } catch (err) {
        console.error('Error fetching legal documents:', err);
        if (current) {
          setState({
            documents: [],
            isLoading: false,
            error: err instanceof Error ? err.message : 'Unknown error occurred',
          });
        }
      }
    };
    if (enabled) void load();
    return () => {
      current = false;
    };
  }, [endpoint, enabled]);

  return state;
}
