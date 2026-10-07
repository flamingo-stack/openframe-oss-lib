// Presentation tables of the cloud tenants list.
//
// Every value → label/variant decision of the list lives here, declared with
// `satisfies Record<Union, …>`. The unions restate the directory enums of the
// product's GraphQL schema (the library holds no generated types); the product
// app asserts that its generated enums are covered, so a widened enum stops
// type-checking there until the new value is given an answer here. Values reach
// the UI as plain strings and a backend ahead of the schema is a runtime
// possibility, so every reader takes a `string` and degrades to a neutral answer.

import type { ComponentType, SVGProps } from 'react';
import { formatRelativeTimeFrom } from '../../../utils/date-utils';
import { formatDate } from '../../../utils/format-date';
import { GoogleLogoIcon } from '../../icons-v2-generated/brand-logos/google-logo-icon';
import { Office365LogoIcon } from '../../icons-v2-generated/brand-logos/office-365-logo-icon';
import { CodingForkIcon } from '../../icons-v2-generated/coding/coding-fork-icon';
import type { TagProps } from '../../ui/tag';

/** What a cell shows when it has no value. */
export const TENANT_EMPTY_VALUE = '—';

type TagVariant = NonNullable<TagProps['variant']>;

export interface TenantStatusTag {
  label: string;
  variant: TagVariant;
}

/** What the last probe of a directory connection found. */
export type TenantAccessState =
  'DISCONNECTED' | 'NOT_AUTHORISED' | 'CONSENT_REVOKED' | 'READ_ONLY' | 'WRITE_AVAILABLE' | 'WRITE_ENABLED';

/** The directory providers a tenant connects to. */
export type TenantProvider = 'MICROSOFT_365' | 'GOOGLE_WORKSPACE';

function presentationFor<K extends string, V>(map: Record<K, V>, key: string | null | undefined): V | undefined {
  return key != null && key in map ? map[key as K] : undefined;
}

// Colours read off the Figma list (node 1699-8249): red for the two states that
// need the customer's admin, grey for read-only, outline for write-available,
// green for write-enabled. NOT_AUTHORISED has no frame of its own
// and follows CONSENT_REVOKED: it is the other "the directory refused us" state.
const ACCESS_STATE_PRESENTATION = {
  DISCONNECTED: { label: 'Disconnected', variant: 'error' },
  NOT_AUTHORISED: { label: 'Not authorised', variant: 'error' },
  CONSENT_REVOKED: { label: 'Consent revoked', variant: 'error' },
  READ_ONLY: { label: 'Read only', variant: 'grey' },
  WRITE_AVAILABLE: { label: 'Write available', variant: 'outline' },
  WRITE_ENABLED: { label: 'Write enabled', variant: 'success' },
} satisfies Record<TenantAccessState, TenantStatusTag>;

/** Tag props for an access state; an unknown value renders as itself in grey. */
export function accessStateTag(state: string | null | undefined): TenantStatusTag {
  return presentationFor(ACCESS_STATE_PRESENTATION, state) ?? { label: state || TENANT_EMPTY_VALUE, variant: 'grey' };
}

/** An icons-v2 brand mark: sized by `size`, labelled for assistive tech where it stands alone. */
export type ProviderLogo = ComponentType<
  { className?: string; size?: number } & Pick<SVGProps<SVGSVGElement>, 'role' | 'aria-label'>
>;

export interface ProviderMark {
  label: string;
  Logo: ProviderLogo;
}

const PROVIDER_MARK = {
  MICROSOFT_365: { label: 'Microsoft 365', Logo: Office365LogoIcon },
  GOOGLE_WORKSPACE: { label: 'Google Workspace', Logo: GoogleLogoIcon },
} satisfies Record<TenantProvider, ProviderMark>;

/** Name and brand mark of a provider; an unknown value keeps its raw name and a neutral mark. */
export function providerMark(provider: string | null | undefined): ProviderMark {
  return presentationFor(PROVIDER_MARK, provider) ?? { label: provider || 'Unknown provider', Logo: CodingForkIcon };
}

/**
 * The instant "Last read" reports: the directory sync, not the access probe. A probe proves the
 * link, a sync is when the data was read. The instant arrives untyped, so anything but text is absent.
 */
export function lastReadAt(connection: { readonly lastSyncAt?: unknown }): string | null {
  return typeof connection.lastSyncAt === 'string' && connection.lastSyncAt !== '' ? connection.lastSyncAt : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// `Date` reads three fraction digits; Safari rejects a longer fraction outright, and V8 truncates it.
const FRACTION_PAST_MILLIS = /(\.\d{3})\d+(?=Z$)/;

function toValidInstant(iso: string | null | undefined): Date | null {
  if (iso == null || iso === '') return null;
  const date = new Date(iso.replace(FRACTION_PAST_MILLIS, '$1'));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "41m ago" while fresh, the calendar date once a day old (the design shows
 * "Last read: 10/10/2016" on a stale row), the empty mark when there was never a read.
 */
export function formatLastRead(iso: string | null | undefined, now: Date = new Date()): string {
  const date = toValidInstant(iso);
  if (!date) return TENANT_EMPTY_VALUE;
  return now.getTime() - date.getTime() < DAY_MS ? formatRelativeTimeFrom(date, now) : formatDate(date);
}

/** "227 Users" under the customer, the empty mark before the first read. */
export function usersCountLabel(count: number | null | undefined): string {
  if (count == null) return TENANT_EMPTY_VALUE;
  return `${count} ${count === 1 ? 'User' : 'Users'}`;
}
