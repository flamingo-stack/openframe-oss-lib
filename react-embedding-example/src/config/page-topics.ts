import type { PageTopics } from '@flamingo-stack/openframe-frontend-core/utils/page-topics'

/**
 * This embed's route to topic map: the ONE place a page's topic is declared.
 * The lib reads every page's topic from its address through it
 * (`PageTopicsProvider`, in app-providers.tsx) for the FAQ block, its "Ask
 * Mingo" card and the chat's quick actions; no page passes a topic. The topics
 * are the hub's (its FAQ admin and quick-action editor), so each page names the
 * topic of the hub page it mirrors.
 */
export const PAGE_TOPICS: PageTopics = {
  '/faqs': 'faqs',
  '/trust-center': 'trust-center',
  '/roadmap': 'roadmap',
  '/releases': 'releases',
  '/releases/[slug]': 'product_release',
  '/delivery': 'bug-fixes-and-enhancements',
  '/onboarding-guides': 'onboarding-guides',
  '/onboarding-guides/[slug]': 'onboarding_guide',
  // Each legal document is the hub page it mirrors.
  '/legal/privacy': 'privacy-policy',
  '/legal/terms': 'terms-of-service',
  '/legal/payment': 'payment-terms',
  '/legal/license': 'license',
  '/legal/security': 'security-policy',
}
