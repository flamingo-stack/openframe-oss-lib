'use client';

/**
 * Deleted Data Card — generic TOMBSTONE placeholder for an entity a chat
 * action removed (ClickUp task today; any deletable entity tomorrow).
 *
 * Follows the established tombstone pattern (Teams / Slack "This message
 * was deleted"): keep a visible, muted placeholder so the conversation
 * thread's integrity holds — the reader sees WHAT was removed and that
 * it may be recoverable, instead of a dead link or a silent gap.
 *
 * PURE PRESENTATION from the ChatRef — no fetch, no navigation (the
 * underlying entity no longer resolves anywhere). Ref contract:
 *   - `title`                    — the deleted entity's display title
 *   - `metadata.entity_label`    — what kind of thing it was ("ClickUp task")
 *   - `metadata.recovery_note`   — optional recoverability copy
 *     ("Recoverable from the ClickUp Trash for 30 days")
 */

import { Trash2 } from 'lucide-react';
import {
  COMPACT_CARD_ICON_SLOT,
  COMPACT_CARD_META_ROW,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
} from '../utils/compact-card-classes';

export interface DeletedDataCardProps {
  title?: string | null;
  /** What kind of entity was deleted ("ClickUp task", "HubSpot ticket"). */
  entityLabel?: string | null;
  /** Recoverability copy ("Recoverable from the ClickUp Trash for 30 days"). */
  recoveryNote?: string | null;
  className?: string;
}

export function DeletedDataCard({ title, entityLabel, recoveryNote, className }: DeletedDataCardProps) {
  const label = entityLabel || 'Item';
  return (
    <div className={`${COMPACT_CARD_OUTER_STATIC} opacity-70 ${className ?? ''}`}>
      <div className={COMPACT_CARD_ICON_SLOT}>
        <Trash2 className="h-4 w-4 text-ods-text-secondary" />
      </div>
      <div className={COMPACT_CARD_TEXT_COL}>
        <div className={COMPACT_CARD_TITLE_ROW}>
          <span className={`${COMPACT_CARD_TITLE} text-ods-text-secondary line-through`}>
            {title || `Deleted ${label.toLowerCase()}`}
          </span>
        </div>
        <div className={COMPACT_CARD_META_ROW}>
          <span className="text-ods-text-secondary">
            {label} deleted{recoveryNote ? ` · ${recoveryNote}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
