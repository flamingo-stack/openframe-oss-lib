/**
 * What the Source column shows for a log row.
 *
 * System events (Fleet audit: "User logged in", "Created saved query") arrive
 * with the literal string "null" in `hostname`, `organizationName` and
 * `organizationId`, not with null. The ingest side is being fixed, but log rows
 * are immutable, so the ones already written keep the literal; it is mapped
 * here, once, for every table that renders the column.
 */
const NULL_LITERAL = 'null';

/** The Source column's label for a system event, which has no device. */
export const SYSTEM_SOURCE_LABEL = 'System';

export interface LogSourceLabels {
  deviceName: string;
  organization: string | undefined;
}

export function logSourceLabels(device: { name: string; organization?: string }): LogSourceLabels {
  return {
    deviceName: device.name === NULL_LITERAL ? SYSTEM_SOURCE_LABEL : device.name,
    organization: device.organization === NULL_LITERAL ? undefined : device.organization,
  };
}
