/**
 * The types of legal document a hub can publish, each with a page of its own
 * (`/api/legal/<type>`, `<LegalDocumentPage docType>`).
 *
 * WHICH of them are published, and each one's title, version and effective
 * date, is the hub's answer at run time (`GET /api/legal`, `useLegalDocuments`).
 * This list exists for a host that must know every possible page before it
 * runs: a statically exported app prerenders one legal page per type here and
 * links only the ones the hub's list says are published.
 *
 * Pure and server-safe. The hub's own list of legal documents carries exactly
 * these types.
 */
export const LEGAL_DOCUMENT_TYPES = ['privacy', 'terms', 'payment', 'license', 'security'] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

/** True for a type a host has a page for (one of {@link LEGAL_DOCUMENT_TYPES}). */
export function isLegalDocumentType(value: string): value is LegalDocumentType {
  return (LEGAL_DOCUMENT_TYPES as readonly string[]).includes(value);
}
