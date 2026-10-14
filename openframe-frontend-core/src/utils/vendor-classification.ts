/**
 * Vendor classifications: the ONE vocabulary of `vendor_classification.classification`.
 *
 * A vendor may carry several (an OpenFrame product is `open_source` and
 * `openframe_selected`; a retired tool is `open_source` and `end_of_life`).
 * Every value is a filter in the catalog and a tag on a card, so a new value is
 * added HERE (with its copy below) and in the database's CHECK constraint, nowhere else.
 *
 * Three groups:
 *   - license: `open_source` (an OSI license), `source_available` (the source is
 *     public but the license restricts use, e.g. SSPL, BSL, Elastic License, size or
 *     service limits), `commercial`.
 *   - lifecycle: `end_of_life` (the vendor discontinued or retired the product),
 *     `end_of_support` (no more vendor support or security fixes, still obtainable),
 *     `unmaintained` (no release for years and no end-of-life notice).
 *   - OpenFrame: `openframe_selected` (a tool OpenFrame is built on, picked by the
 *     team), `openframe_shipped` (in the released product today), `openframe_connect`
 *     (a service OpenFrame connects to and manages). Drawn with the OpenFrame mark
 *     and ONE word.
 */
export const VENDOR_CLASSIFICATIONS = [
  'open_source',
  'source_available',
  'commercial',
  'end_of_life',
  'end_of_support',
  'unmaintained',
  'openframe_selected',
  'openframe_shipped',
  'openframe_connect',
] as const;

export type VendorClassificationValue = (typeof VENDOR_CLASSIFICATIONS)[number];

export type OpenFrameClassification = Extract<VendorClassificationValue, `openframe_${string}`>;

export interface OpenFrameClassificationCopy {
  /** The word drawn beside the OpenFrame mark. */
  word: string;
  /** The full name, for plain-text surfaces (a select option, an aria label). */
  label: string;
  /** What the classification means, for a tooltip. */
  description: string;
}

export const OPENFRAME_CLASSIFICATIONS: Record<OpenFrameClassification, OpenFrameClassificationCopy> = {
  openframe_selected: {
    word: 'Selected',
    label: 'OpenFrame Selected',
    description:
      'OpenFrame is a unified platform that integrates multiple open-source IT and security tools into a single dashboard for MSPs. This filter shows vendors selected by our team for their excellence, community support, and MSP-specific value.',
  },
  openframe_shipped: {
    word: 'Shipped',
    label: 'OpenFrame Shipped',
    description: 'Tools and OpenFrame products that are in the released OpenFrame product today, not on the roadmap.',
  },
  openframe_connect: {
    word: 'Connect',
    label: 'OpenFrame Connect',
    description:
      'Services OpenFrame connects to and manages for every client, such as Microsoft 365 and Google Workspace, beside devices and tickets.',
  },
};

export type VendorClassificationGroup = 'license' | 'lifecycle' | 'openframe';

export type GeneralClassification = Exclude<VendorClassificationValue, OpenFrameClassification>;

export interface GeneralClassificationCopy {
  /** The label on a tag and a filter. */
  label: string;
  /** What the classification means, for a tooltip. */
  description: string;
  group: Exclude<VendorClassificationGroup, 'openframe'>;
}

export const GENERAL_CLASSIFICATIONS: Record<GeneralClassification, GeneralClassificationCopy> = {
  open_source: {
    label: 'Open Source',
    description: 'Released under an OSI-approved open-source license.',
    group: 'license',
  },
  source_available: {
    label: 'Source-available',
    description:
      'The source code is public, but the license restricts how it may be used (for example SSPL, BSL, the Elastic License, or limits on company size or on offering it as a service).',
    group: 'license',
  },
  commercial: {
    label: 'Commercial',
    description: 'Proprietary software sold by the vendor.',
    group: 'license',
  },
  end_of_life: {
    label: 'End of life',
    description: 'The vendor has discontinued or retired the product. No new releases.',
    group: 'lifecycle',
  },
  end_of_support: {
    label: 'End of support',
    description: 'The vendor no longer provides support or security fixes, though the product can still be obtained.',
    group: 'lifecycle',
  },
  unmaintained: {
    label: 'Unmaintained',
    description: 'No release for years and no official end-of-life notice.',
    group: 'lifecycle',
  },
};

/** The group a classification belongs to (license, lifecycle or OpenFrame). */
export function vendorClassificationGroup(value: VendorClassificationValue): VendorClassificationGroup {
  return isOpenFrameClassification(value) ? 'openframe' : GENERAL_CLASSIFICATIONS[value].group;
}

/** The display label of a classification; an unknown value is title-cased by the caller's fallback. */
export function vendorClassificationLabel(value: string): string | null {
  if (isOpenFrameClassification(value)) return OPENFRAME_CLASSIFICATIONS[value].label;
  if (isVendorClassification(value)) return GENERAL_CLASSIFICATIONS[value as GeneralClassification].label;
  return null;
}

export function isVendorClassification(value: string): value is VendorClassificationValue {
  return (VENDOR_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function isOpenFrameClassification(value: string | null | undefined): value is OpenFrameClassification {
  return !!value && Object.prototype.hasOwnProperty.call(OPENFRAME_CLASSIFICATIONS, value);
}
