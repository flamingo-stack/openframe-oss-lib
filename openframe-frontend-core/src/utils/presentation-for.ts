/**
 * The entry of a value → presentation table for a value off the wire, `undefined` for one the table does not know.
 * Own keys only: `in` or a bare index would answer `toString` or `constructor` with the prototype's function.
 */
export function presentationFor<K extends string, V>(
  map: Readonly<Record<K, V>>,
  key: string | null | undefined,
): V | undefined {
  return key != null && Object.prototype.hasOwnProperty.call(map, key) ? map[key as K] : undefined;
}
