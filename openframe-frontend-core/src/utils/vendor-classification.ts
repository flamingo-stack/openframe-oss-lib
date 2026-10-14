/**
 * Vendor classifications: whatever `vendor_classification.classification` holds on the
 * server. The database owns the vocabulary (its CHECK constraint is the list), the catalog
 * builds its filters from the rows that exist, and nothing here limits which values are valid.
 *
 * This module only ENRICHES the values we want to present specially: a curated label, a
 * tooltip description and a group. A value with no entry still works everywhere, labelled
 * by title case. To present a new value better, add an entry here; to make it exist, add it
 * to the database.
 *
 * Groups:
 *   - `license`: how the software is licensed.
 *   - `lifecycle`: where the product is in its life (a tag and a filter; a card's one tag stays the license).
 *   - `openframe`: drawn with the OpenFrame mark and ONE word (`word`).
 */
export type VendorClassificationValue = string;

export type VendorClassificationGroup = 'license' | 'lifecycle' | 'openframe';

export interface VendorClassificationCopy {
  /** The label on a tag, a filter and a plain-text surface. */
  label: string;
  /** What the classification means, for a tooltip. */
  description: string;
  group: VendorClassificationGroup;
  /** OpenFrame group only: the one word drawn beside the OpenFrame mark. */
  word?: string;
}

export const VENDOR_CLASSIFICATION_COPY: Readonly<Record<string, VendorClassificationCopy>> = {
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
  openframe_selected: {
    label: 'OpenFrame Selected',
    word: 'Selected',
    description:
      'OpenFrame is a unified platform that integrates multiple open-source IT and security tools into a single dashboard for MSPs. This filter shows vendors selected by our team for their excellence, community support, and MSP-specific value.',
    group: 'openframe',
  },
  openframe_shipped: {
    label: 'OpenFrame Shipped',
    word: 'Shipped',
    description: 'Tools and OpenFrame products that are in the released OpenFrame product today, not on the roadmap.',
    group: 'openframe',
  },
  openframe_connect: {
    label: 'OpenFrame Connect',
    word: 'Connect',
    description:
      'Services OpenFrame connects to and manages for every client, such as Microsoft 365 and Google Workspace, beside devices and tickets.',
    group: 'openframe',
  },
};

/** The enrichment of a classification, or undefined for a value we do not present specially. */
export function vendorClassificationCopy(value: string | null | undefined): VendorClassificationCopy | undefined {
  if (!value || !Object.prototype.hasOwnProperty.call(VENDOR_CLASSIFICATION_COPY, value)) return undefined;
  return VENDOR_CLASSIFICATION_COPY[value];
}

/** The group of a classification, or undefined for a value with no enrichment. */
export function vendorClassificationGroup(value: string | null | undefined): VendorClassificationGroup | undefined {
  return vendorClassificationCopy(value)?.group;
}

/** A classification drawn with the OpenFrame mark (it has a `word`). */
export function isOpenFrameClassification(value: string | null | undefined): boolean {
  return vendorClassificationGroup(value) === 'openframe';
}
