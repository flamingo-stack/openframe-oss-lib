/**
 * Shared legal-document surface barrel.
 *
 * Exports one parameterized `<LegalDocumentPage>` that replaces hub's
 * formerly-duplicated `PrivacyPolicyPage` + `TermsOfServicePage`
 * (95% identical, differing only in copy strings).
 */

export {
  LegalDocumentPage,
  legalDocumentStampLabel,
  LEGAL_DOCUMENT_SKELETON_SECTIONS,
  type LegalDocumentPageProps,
  type LegalDocumentMarkdownRendererProps,
} from './legal-document-page';
export { useLegalDocs, type LegalDocument, type UseLegalDocsOptions, type UseLegalDocsReturn } from './use-legal-docs';
export {
  useLegalDocuments,
  toLegalDocumentSummaries,
  type LegalDocumentSummary,
  type UseLegalDocumentsOptions,
  type UseLegalDocumentsReturn,
} from './use-legal-documents';
