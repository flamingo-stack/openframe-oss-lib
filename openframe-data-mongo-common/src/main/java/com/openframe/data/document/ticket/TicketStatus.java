package com.openframe.data.document.ticket;

import java.util.Set;

/**
 * The status model that predates the custom-status lifecycle. Nothing stores it any more — it is
 * derived from {@link TicketStatusKind} for clients that still ask for it: the mobile and desktop
 * shells ship a frozen web bundle and only pick up the lifecycle model on their next store release.
 *
 * TODO(lifecycle-rollout): remove once no released shell reads the legacy status.
 */
public enum TicketStatus {
    ACTIVE,
    TECH_REQUIRED,
    ON_HOLD,
    RESOLVED,
    ARCHIVED;

    /**
     * The legacy equivalent of a lifecycle kind. A custom column has no historical counterpart and
     * reports as TECH_REQUIRED — the ticket left the assistant and a human owns it, which is what
     * the legacy clients read that value as. Never null: a missing status breaks the boards those
     * clients render from it.
     */
    public static TicketStatus fromKind(TicketStatusKind kind) {
        if (kind == null) {
            return ACTIVE;
        }
        return switch (kind) {
            case AI_ASSISTANCE -> ACTIVE;
            case TECH_REQUIRED, CUSTOM -> TECH_REQUIRED;
            case RESOLVED -> RESOLVED;
            case ARCHIVED -> ARCHIVED;
        };
    }

    public boolean canTransitionTo(TicketStatus target) {
        return getAllowedTransitions().contains(target);
    }

    public Set<TicketStatus> getAllowedTransitions() {
        return switch (this) {
            case ACTIVE -> Set.of(TECH_REQUIRED, ON_HOLD, RESOLVED);
            case TECH_REQUIRED -> Set.of(ACTIVE, ON_HOLD, RESOLVED);
            case ON_HOLD -> Set.of(ACTIVE, TECH_REQUIRED, RESOLVED);
            case RESOLVED -> Set.of(ARCHIVED);
            case ARCHIVED -> Set.of(RESOLVED);
        };
    }
}
