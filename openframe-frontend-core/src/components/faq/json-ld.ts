/**
 * Pure FAQ JSON-LD builder. No React, no client-only deps — safe to import from
 * Server Components via the `./components/faq` subpath export. (Do NOT import
 * through the root `./components` barrel — that barrel is `"use client"` and
 * dragging it into a Server Component would force the client graph into the
 * server.)
 *
 * The hub used to harcode `name`/`description` here for OpenMSP; in the lib we
 * accept overrides so every embedder can supply its own platform branding.
 */
import type { Faq } from '../../types/faq'

export interface FaqSchemaOptions {
  name?: string
  description?: string
  url?: string
}

const DEFAULT_NAME = 'Frequently Asked Questions'
const DEFAULT_DESCRIPTION =
  'Answers to common questions.'

export function baseFaqSchema(opts: FaqSchemaOptions = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name: opts.name ?? DEFAULT_NAME,
    description: opts.description ?? DEFAULT_DESCRIPTION,
    ...(opts.url ? { url: opts.url } : {}),
  } as const
}

export function buildFaqJsonLdFromFaqs(faqs: Faq[], opts: FaqSchemaOptions = {}) {
  return {
    ...baseFaqSchema(opts),
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  } as const
}
