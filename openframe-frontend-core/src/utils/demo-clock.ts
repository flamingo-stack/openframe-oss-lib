/**
 * Times for a scripted conversation (a product demo, an example card): a
 * believable time of day for each turn, chosen from a seed.
 *
 * The same seed always gives the same times, so a server render and the
 * browser agree and a card keeps its time on every visit. Turns of one
 * conversation follow each other: each is the one before it plus a short gap.
 */

/** A 32-bit hash of the seed (FNV-1a), the generator's starting state. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A seeded generator of numbers in [0, 1) (mulberry32). */
function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoClockOptions {
  /** How many turns to time. Default 2. */
  count?: number;
  /** The first turn falls between these hours of the day (24h, end exclusive). Default 8 to 18. */
  fromHour?: number;
  toHour?: number;
  /** The longest gap between two turns, in minutes. Default 3. A gap may be 0: an agent answers within the minute. */
  maxGapMinutes?: number;
}

/** Minutes of the day as "2:47 PM". */
export function formatDemoClock(minutesOfDay: number): string {
  const minutes = ((Math.floor(minutesOfDay) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minutes % 60).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

/** The time of each turn of one scripted conversation, in order, for `seed`. */
export function demoClockTimes(seed: string, options: DemoClockOptions = {}): string[] {
  const { count = 2, fromHour = 8, toHour = 18, maxGapMinutes = 3 } = options;
  const random = seededRandom(seed);
  const span = Math.max(1, (toHour - fromHour) * 60);
  let minutes = fromHour * 60 + Math.floor(random() * span);
  const times: string[] = [];
  for (let i = 0; i < Math.max(0, count); i++) {
    if (i > 0) minutes += Math.floor(random() * (maxGapMinutes + 1));
    times.push(formatDemoClock(minutes));
  }
  return times;
}
