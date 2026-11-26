'use client';

import { DataTable, TruncateText, useLoadingScope } from '../../ui';
import { formatDeviceDateTime } from './device-last-online';
import type { DeviceRow } from './types';

/**
 * When the device was last seen, as the LAST SEEN column prints it: its date and time, the empty mark for a device
 * never seen, nothing while the row is read (the text's own skeleton).
 */
function useDeviceLastSeenText(device: DeviceRow): string {
  const loading = useLoadingScope();
  const lastSeen = device.last_seen ?? device.lastSeen;
  if (lastSeen) return formatDeviceDateTime(lastSeen);
  return loading ? '' : '—';
}

/**
 * The devices table's LAST SEEN cell (lifecycle display, Figma 5262:159608): in the grid layout (`grid`) the grid's own
 * cell, in a card row the line of text.
 */
export function DeviceLastSeenCell({ device, grid = false }: { device: DeviceRow; grid?: boolean }) {
  const text = useDeviceLastSeenText(device);
  return grid ? <DataTable.Cell text={text} /> : <TruncateText>{text}</TruncateText>;
}
