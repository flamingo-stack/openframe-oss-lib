/**
 * THE three renderers a program meta line is built from.
 *
 * `programMetaFormatters` adapts them (zone label, date style); this is the set
 * itself. It lives here rather than beside either card because the triple was
 * mirrored byte-for-byte in the two components `programMetaLine` exists to keep
 * in sync, and a third copy sat in the host app's page header — unifying the
 * dispatch and leaving the renderer set mirrored in exactly those files is the
 * arrangement this package documents as the cause of the original drift.
 */
import { formatDurationCompact, formatProgramDate, formatWebinarTimeMeta } from './format';
import type { ProgramMetaRenderers } from './program-instant';

export const PROGRAM_META_RENDERERS: ProgramMetaRenderers = {
  date: formatProgramDate,
  duration: formatDurationCompact,
  webinarMeta: formatWebinarTimeMeta,
};
