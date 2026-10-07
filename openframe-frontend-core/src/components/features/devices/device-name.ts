/**
 * The name fields a device source hands to `getDeviceName`.
 *
 * `nickname` is a required key on purpose. The two agent-reported names were
 * selected by every device operation long before the user-defined one existed,
 * so the field an operation forgets is `nickname`, and with an optional key
 * that operation would compile and quietly render the hostname. That is the
 * silent-fallback trap the fragment ladder in `src/graphql/devices/` was built
 * to close, so the sink closes it too: a source may say its nickname is null or
 * undefined, but it has to say so.
 */
export interface DeviceNameSource {
  nickname: string | null | undefined;
  displayName?: string | null;
  hostname?: string | null;
}

/**
 * Single source of truth for a device's display name.
 *
 * The name comes from GraphQL only: the user-defined `nickname` when set,
 * then `displayName`, then `hostname`. Nothing else stands in for a registry
 * device's name (description, machineId, deviceId, Fleet display_name, …) ,
 * those diverge across screens. A caller that renders something which is not
 * a registry device (a Fleet host with no device record, a log row whose device
 * is gone) appends its own identifier after the empty string it gets back.
 */
export function getDeviceName(device?: DeviceNameSource | null): string {
  return device?.nickname || device?.displayName || device?.hostname || '';
}

/**
 * Whether a client-side device list finds `device` by `search`: through the
 * name it renders under, or through its hostname.
 *
 * Hostname stays a match even when a nickname is set, on purpose. The server's
 * `devices(search:)` matches hostname regardless of nickname (alongside ip,
 * serial, manufacturer, model), and a list that filters what it already
 * loaded must not be stricter than the page it stands in for, a device an
 * admin knows by hostname from Fleet or MeshCentral stays findable after
 * someone gives it a nickname.
 *
 * Case-insensitive substring, like the server. Blank search matches everything.
 */
export function matchesDeviceName(device?: DeviceNameSource | null, search = ''): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return (
    getDeviceName(device).toLowerCase().includes(needle) || (device?.hostname ?? '').toLowerCase().includes(needle)
  );
}
