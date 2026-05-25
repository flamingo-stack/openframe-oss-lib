/**
 * Lib-side default ProgramConfig values for the chat dispatch.
 *
 * `<ProgramCard size='sm'>` (the compact chat card) only consumes
 * `config.type` (for branching on podcast vs webinar vs event presentation
 * details) and `config.labels?.singular` (rendered as the subtitle's
 * type label, e.g. "Episode" / "Webinar" / "Event"). Everything else on
 * `ProgramConfig` — `dateField`, `table`, `apiEndpoint`, `icon`,
 * `detailRoute`, `externalLinkLabel`, etc. — is catalog-page metadata,
 * not used by the inline chat card.
 *
 * Previously the chat dispatch REQUIRED `opts.extras.programConfigs.X`
 * to be provided by the embedder; if it was missing the dispatch
 * returned `null` and the chat fell back to a bare text chip ("Ask" +
 * id). That tightly coupled every embedder to the hub-side
 * `program-configs.ts` (which transitively imports `currentPlatform()`
 * + `buildContentURL` — hub-internal). The validation app + any
 * non-hub embedder couldn't render podcast/webinar/event cards at all.
 *
 * These defaults satisfy the compact-card render contract with
 * minimal hard-coded labels. Embedders that need richer catalog
 * configs (full icon, externalLinkLabel, etc.) can still override per
 * type via `opts.extras.programConfigs.X` — the dispatch reads
 * `extras.programConfigs.X ?? DEFAULT_PROGRAM_CONFIGS.X`.
 */
import type { ProgramConfig, BaseProgramItem } from '../types/entities/program-types'

/** Minimal config — fields the compact card actually reads + safe
 *  placeholders for the others so type-checking passes. */
function makeDefault<T extends BaseProgramItem>(
  type: 'podcast' | 'webinar' | 'event',
  singular: string,
  plural: string,
): ProgramConfig<T> {
  return {
    type,
    labels: {
      singular,
      plural,
      upcoming: `Latest ${singular}:`,
      upcomingSection: `Upcoming ${plural}`,
      archive: `Past ${plural}`,
      empty: `No ${plural.toLowerCase()} yet`,
    },
    // dateField / table / apiEndpoint / icon / detailRoute /
    // externalLinkLabel are NOT read by the compact chat card — set to
    // empty / null so the embedder doesn't have to think about catalog
    // page concerns when all they want is the inline chat card.
    dateField: 'date' as keyof T,
    table: '',
    apiEndpoint: '',
    icon: null,
    externalLinkLabel: '',
    detailRoute: '',
  }
}

export const DEFAULT_PROGRAM_CONFIGS = {
  podcast: makeDefault<BaseProgramItem>('podcast', 'Episode', 'Episodes'),
  webinar: makeDefault<BaseProgramItem>('webinar', 'Webinar', 'Webinars'),
  event: makeDefault<BaseProgramItem>('event', 'Event', 'Events'),
} as const
