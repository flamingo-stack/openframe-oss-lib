/**
 * The topics an "ask" surface can ask for. Whoever renders the surface passes
 * its topic as a prop (`ask={{ topic }}` on `FaqSection`, `topic` on
 * `AssistantAskPrompts`); the host's questions endpoint receives it as
 * `section`. A FAQ given no topic asks for `faq`. A host may pass any other
 * string: the questions are the host's.
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
