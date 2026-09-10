import shared from './eslint-config/prettier.js';

/*
 * Formatting settings come from the shared preset — they reproduce the outgoing
 * Biome formatter byte-for-byte so that switching engines is not also a
 * restyling. Nothing repo-specific is needed here yet; keep it that way.
 */
export default shared;
