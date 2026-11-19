/**
 * A FAQ: a question with its written answer (the accordion, FAQPage JSON-LD).
 * A question the assistant answers ("Ask Mingo") is a chat quick action, never a
 * FAQ: an "ask" surface reads it from `AssistantRuntime.askPromptsUrl`.
 */
export interface Faq {
  id: number;
  question: string;
  answer: string;
  section?: string | null;
  /**
   * The places the FAQ is written for: a page's topic
   * (`/pricing`, `/careers`, `/`) or a section of one (`/pricing#ai-token-rates`). Empty: written for no place.
   */
  topics?: string[];
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
