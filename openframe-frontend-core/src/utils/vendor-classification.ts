/**
 * Vendor classifications: the ONE vocabulary of `vendor_classification.classification`.
 *
 * A vendor may carry several (an OpenFrame product is `open_source` and
 * `openframe_selected`). The two OpenFrame ones are drawn with the OpenFrame
 * mark and ONE word, everywhere: a tag on a card, a filter in the catalog.
 *
 *   - `openframe_selected`: a tool OpenFrame is built on, picked by the team.
 *   - `openframe_connect`: a service OpenFrame connects to and manages.
 */
export const VENDOR_CLASSIFICATIONS = ['open_source', 'commercial', 'openframe_selected', 'openframe_connect'] as const;

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
  openframe_connect: {
    word: 'Connect',
    label: 'OpenFrame Connect',
    description:
      'Services OpenFrame connects to and manages for every client, such as Microsoft 365 and Google Workspace, beside devices and tickets.',
  },
};

export function isVendorClassification(value: string): value is VendorClassificationValue {
  return (VENDOR_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function isOpenFrameClassification(value: string | null | undefined): value is OpenFrameClassification {
  return !!value && Object.prototype.hasOwnProperty.call(OPENFRAME_CLASSIFICATIONS, value);
}
