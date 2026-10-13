/**
 * The two kinds of FAQ. An `answer` is a question with its written answer (the
 * accordion, FAQPage JSON-LD). An `ask` is a question the assistant answers: it
 * has a `prompt` (what is sent to the chat) and no written answer, and is what
 * every "ask the assistant" surface offers.
 */
export const FAQ_KINDS = ['answer', 'ask'] as const;
export type FaqKind = (typeof FAQ_KINDS)[number];

export interface Faq {
  id: number;
  question: string;
  answer: string;
  section?: string | null;
  /** Absent on a host that predates kinds: an `answer`. */
  kind?: FaqKind;
  /** An `ask` FAQ's prompt for the chat; null on an `answer`. */
  prompt?: string | null;
  /**
   * The places the FAQ is written for, shared by both kinds: a page's topic
   * (`pricing`, `careers`, `home`) or a section's. Empty: written for no place.
   */
  topics?: string[];
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
