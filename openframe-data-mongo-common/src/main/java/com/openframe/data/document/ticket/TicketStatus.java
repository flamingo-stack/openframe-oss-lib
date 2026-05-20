package com.openframe.data.document.ticket;

import java.util.Set;

/**
 * Status of a ticket (matches Figma flow).
 * Separate from DialogStatus for feature flag isolation.
 */
// TODO(lifecycle-rollout): remove entire enum after legacy status field is dropped from Ticket
public enum TicketStatus {
    ACTIVE,
    TECH_REQUIRED,
    ON_HOLD,
    RESOLVED,
    ARCHIVED;

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
