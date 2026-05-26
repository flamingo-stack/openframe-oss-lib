import { z } from 'zod';

// Dropdown option constants — re-exported by `<ContactForm>` consumers
// that want to surface their own custom Select widgets keyed on the
// same allowed-value set.
export const companySizeOptions = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001+',
] as const;

export const referralSourceOptions = [
  'Google',
  'LinkedIn',
  'Twitter/X',
  'Reddit',
  'Friend / Colleague',
  'Other',
] as const;

// Default fallback options — used when the embedder doesn't supply
// platform-specific help-category options via the `helpCategoryOptions`
// prop on `<ContactForm>`.
export const defaultHelpCategoryOptions = [
  'Open-Source Alternatives',
  'Vendor Cost Reduction',
  'MSP Best Practices',
  'Partnerships',
  'Press',
  'Other',
] as const;

// Reusable LinkedIn URL validator — the single source of truth. Every
// public form schema, every admin update schema, every HubSpot push
// validator MUST reference this so validation rules cannot drift
// across boundaries.
export const LinkedInUrlSchema = z
  .string()
  .url({ message: 'Please enter a valid LinkedIn URL' })
  .refine((url) => url.includes('linkedin.com'), {
    message: 'Please enter a valid LinkedIn profile URL',
  })
  .optional()
  .or(z.literal(''));

/**
 * Base schema — fields shared by every contact-style form (main contact
 * form, TMCG join, data-room request, case-study pitch, etc.). Any
 * field that exists on a form but NOT on this schema is silently
 * stripped by `safeParse` — that's exactly the bug the LinkedIn field
 * hit historically.
 */
export const ContactBaseSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Name must be at least 2 characters' })
    .max(255, { message: 'Name is too long' }),
  email: z
    .string()
    .email({ message: 'Please enter a valid email address' })
    .max(255),
  linkedin_url: LinkedInUrlSchema,
  helpCategory: z
    .string()
    .min(1, { message: 'Please select what we can help you with' })
    .max(255, { message: 'Help category is too long' }),
  message: z
    .string()
    .min(10, { message: 'Message must be at least 10 characters' })
    .max(5000, { message: 'Message is too long (5,000 character limit)' }),
  rdt_cid: z.string().optional(),
});

// Public POST /api/contact validator — base + dropdown fields used by
// the generic contact form. Other form-specific schemas extend
// `ContactBaseSchema`.
export const ContactSchema = ContactBaseSchema.extend({
  companySize: z
    .string()
    .optional()
    .refine((val) => !val || companySizeOptions.includes(val as (typeof companySizeOptions)[number]), {
      message: 'Please select a valid company size',
    }),
  referralSource: z
    .string()
    .optional()
    .refine((val) => !val || referralSourceOptions.includes(val as (typeof referralSourceOptions)[number]), {
      message: 'Please select a valid referral source',
    }),
});

export type ContactFormData = z.infer<typeof ContactSchema>;

export interface ContactApiResponse {
  success: boolean;
  error?: string;
}
