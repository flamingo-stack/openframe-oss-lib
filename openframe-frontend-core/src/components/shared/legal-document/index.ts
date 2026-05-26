/**
 * Shared legal-document surface barrel.
 *
 * Exports one parameterized `<LegalDocumentPage>` that replaces hub's
 * formerly-duplicated `PrivacyPolicyPage` + `TermsOfServicePage`
 * (95% identical, differing only in copy strings).
 */

export {
  LegalDocumentPage,
  type LegalDocumentPageProps,
  type LegalDocumentMarkdownRendererProps,
} from './legal-document-page';
export {
  useLegalDocs,
  type LegalDocument,
  type UseLegalDocsOptions,
  type UseLegalDocsReturn,
} from './use-legal-docs';
