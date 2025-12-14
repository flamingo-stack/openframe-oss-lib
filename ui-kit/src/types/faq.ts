export interface Faq {
  id: number;
  question: string;
  answer: string;
  section?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
} 