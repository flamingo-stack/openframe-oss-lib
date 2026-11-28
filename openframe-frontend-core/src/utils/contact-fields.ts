/**
 * THE contact and company field contract (design doc #54, "One contact and company structure across the hub").
 *
 * Every table that holds a person and runs the AI contact enrichment (`ENRICHABLE_ENTITIES`) carries every
 * `CONTACT_FIELDS` column under exactly these names, plus `field_sources` (who set each value) and the email check's
 * columns. The enrichment reads and returns these names too. HubSpot's own property names (`firstname`/`lastname`,
 * `jobtitle`, `hs_linkedin_url`) appear only where the hub talks to HubSpot, through `contactToHubspot` /
 * `hubspotToContact` below. The hub's `npm run contact-fields:schema:check` holds the live schema to this list.
 *
 * PURE module (no React, no server imports), its own `exports` subpath (`./utils/contact-fields`): the hub's client
 * dashboards, its server writers and its scripts import it, and the lib's row types (`types/waitlist.ts`) are built
 * from it.
 */

/** A person's fields, named as `profiles` names them. `email` is every table's identity column and is not listed. */
export const CONTACT_FIELDS = [
  'full_name',
  'job_title',
  'company',
  'company_size',
  'website',
  'linkedin_url',
  'phone',
  'country',
  // Kept for ad audiences, which are sent hashed (design doc #54 §9); HubSpot keeps them as Mobile Phone Number and
  // Personal Email.
  'mobile',
  'personal_email',
  'city',
  'zip',
] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactFields = Partial<Record<ContactField, string | null>>;

/** What a person calls each contact field, for every form, table and modal that shows one. */
export const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  full_name: 'Full name',
  job_title: 'Job title',
  company: 'Company',
  company_size: 'Company size',
  website: 'Website',
  linkedin_url: 'LinkedIn',
  phone: 'Phone',
  country: 'Country',
  mobile: 'Mobile phone',
  personal_email: 'Personal email',
  city: 'City',
  zip: 'ZIP code',
};

/** The column recording who set each contact field (the hub's `lib/data/field-sources.ts`). */
export const FIELD_SOURCES_COLUMN = 'field_sources';

/** The email check's columns, the same on every enriched table (the hub's `lib/data/contact-email-verify.ts`). */
export const EMAIL_CHECK_COLUMNS = ['email_status', 'email_method', 'email_free', 'email_checked_at'] as const;

/** What the mail verifier said about an address (`email_status`); the database checks the same list. */
export const EMAIL_STATUSES = ['verified', 'catch_all', 'unknown', 'invalid', 'disposable', 'not_found'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** How an address came to be: a page published it, or it was built from the domain's pattern and verified. */
export const EMAIL_METHODS = ['published', 'pattern'] as const;
export type EmailMethod = (typeof EMAIL_METHODS)[number];

/** The words for each status, so a person knows whether an address may be sent to. */
export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  verified: 'Verified',
  catch_all: 'Domain accepts any address',
  unknown: 'Server did not answer',
  invalid: 'Does not exist',
  disposable: 'Disposable',
  not_found: 'No address found',
};

/** A company's fields, named the same wherever a company is stored. Its identity is its HubSpot company id. */
export const COMPANY_FIELDS = [
  'name',
  'website',
  'company_size',
  'city',
  'state',
  'country',
  'shared_inbox',
  'shared_inbox_source',
] as const;
export type CompanyField = (typeof COMPANY_FIELDS)[number];

/** Split a full name into the first and last name HubSpot keeps. */
export function splitName(full: string | null | undefined): { firstname?: string; lastname?: string } {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return { firstname: parts[0] || undefined, lastname: parts.slice(1).join(' ') || undefined };
}

/**
 * HubSpot's property for each contact field (and `email`): every one is a property the portal already has (a name it
 * does not have would make HubSpot mint a near-duplicate). `full_name` is HubSpot's `firstname` + `lastname`
 * (`splitName`), so it is not here.
 */
export const HUBSPOT_CONTACT_PROPERTY_OF = {
  email: 'email',
  job_title: 'jobtitle',
  linkedin_url: 'hs_linkedin_url',
  company: 'company',
  company_size: 'company_size',
  website: 'website',
  phone: 'phone',
  country: 'country',
  mobile: 'mobilephone',
  personal_email: 'personal_email',
  city: 'city',
  zip: 'zip',
} as const satisfies Record<Exclude<ContactField, 'full_name'> | 'email', string>;
type HubspotMappedField = keyof typeof HUBSPOT_CONTACT_PROPERTY_OF;

/** Contact fields as HubSpot properties: the ONE place the hub's names turn into HubSpot's. */
export function contactToHubspot(fields: ContactFields): Record<string, string> {
  const out: Record<string, string> = {};
  const { firstname, lastname } = splitName(fields.full_name);
  if (firstname) out.firstname = firstname;
  if (lastname) out.lastname = lastname;
  for (const [field, property] of Object.entries(HUBSPOT_CONTACT_PROPERTY_OF) as Array<[HubspotMappedField, string]>) {
    const v = field === 'email' ? undefined : fields[field];
    if (v) out[property] = v;
  }
  return out;
}

/** HubSpot properties (or a HubSpot-keyed form) as contact fields: the ONE place HubSpot's names turn into the hub's. */
export function hubspotToContact(properties: Record<string, unknown>): ContactFields {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const out: ContactFields = {};
  const full = [str(properties.firstname), str(properties.lastname)].filter(Boolean).join(' ');
  if (full) out.full_name = full;
  for (const [field, property] of Object.entries(HUBSPOT_CONTACT_PROPERTY_OF) as Array<[HubspotMappedField, string]>) {
    if (field === 'email') continue;
    const v = str(properties[property]);
    if (v) out[field] = v;
  }
  return out;
}
