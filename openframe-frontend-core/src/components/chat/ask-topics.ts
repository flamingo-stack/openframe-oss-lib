/**
 * THE topics an "ask" surface asks for: one vocabulary for every host. A topic
 * is what a place is ABOUT (its page or its section), never who serves it: the
 * onboarding guides ask for onboarding questions wherever they are embedded.
 * The host's questions endpoint receives the topic as `section`
 * (`AssistantRuntime.askPromptsUrl`); the questions themselves are the host's.
 *
 * A lib page says what it is about once (`useAskPageTopic`), and every FAQ on
 * that page asks for it. A page that says nothing asks for `faq`.
 */
export const ASK_TOPICS = {
  /** The general FAQ: what a FAQ asks for on a page with no topic of its own. */
  faq: 'faq',
  onboarding: 'onboarding',
  roadmap: 'roadmap',
  releases: 'releases',
  delivery: 'delivery',
  trustCenter: 'trust-center',
  customers: 'customers',
  pricing: 'pricing',
  prompts: 'prompts',
  howIWork: 'how-i-work',
  whatIShipped: 'what-i-shipped',
  investorUpdates: 'investor-updates',
} as const;

export type AskTopic = (typeof ASK_TOPICS)[keyof typeof ASK_TOPICS];
