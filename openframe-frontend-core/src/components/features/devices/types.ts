import type { DeviceNameSource } from './device-name';

/** A tag on a device: one key and the values the device carries for it. */
export interface DeviceTag {
  tagId: string;
  key: string;
  description?: string;
  color?: string;
  values: string[];
  createdAt?: string;
}

/**
 * A device as the list views draw it: the plain fields a row, a card and a
 * picker read, and nothing a details page needs. The product's full device
 * record is a superset of this, so it is passed as is.
 */
export interface DeviceRow extends DeviceNameSource {
  id: string;
  /** The agent's id. Empty when the agent is not connected. */
  machineId: string;
  status: string;
  /** When the device was last seen, ISO. Two spellings, one per source. */
  last_seen?: string;
  lastSeen?: string;
  /** desktop / laptop / server / mobile / tablet. */
  type?: string;
  osType?: string;
  operating_system?: string;
  organizationId?: string;
  organization?: string;
  /** Primary contact of the customer: the CUSTOMER column's second line in the picker. */
  organizationEmail?: string;
  organizationImageUrl?: string | null;
  organizationImageHash?: string | null;
  tags?: DeviceTag[];
}

export interface DeviceFilterValue {
  value: string;
  count: number;
}

export interface DeviceFilterTag {
  value: string;
  label: string;
  count: number;
}

export interface TagFilterOption {
  key: string;
  value: string;
  count: number;
}

/** The facets behind the device filters, as the server counts them. */
export interface DeviceFilters {
  statuses: DeviceFilterValue[];
  deviceTypes: DeviceFilterValue[];
  osTypes: DeviceFilterValue[];
  organizationIds: DeviceFilterTag[];
  tagKeys: TagFilterOption[];
  filteredCount: number;
}

/** What narrows a device list, in the backend's field names. */
export interface DeviceFilterInput {
  statuses?: string[];
  deviceTypes?: string[];
  osTypes?: string[];
  organizationIds?: string[];
  tagKeys?: string[];
  tagValues?: string[];
}
