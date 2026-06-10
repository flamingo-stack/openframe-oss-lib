// CLIENT subpath barrel. Re-exports the client `<FaqSection>` only.
//
// The pure JSON-LD builder (`baseFaqSchema`, `buildFaqJsonLdFromFaqs`) is
// intentionally NOT re-exported here because tsup builds this entry with the
// `"use client"` banner. Server Components consumers must import the builder
// directly from the dedicated server-safe subpath:
//
//   import { buildFaqJsonLdFromFaqs } from '@flamingo-stack/openframe-frontend-core/components/faq/json-ld'
//
// (Server-safe subpath is wired in tsup.config.ts under the server/universal
// block and exposed via "./components/faq/json-ld" in package.json#exports.)
export { FaqSection, type FaqSectionProps } from './faq-section'
