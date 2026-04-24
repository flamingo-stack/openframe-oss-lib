package com.openframe.data.document.ticket;

import java.util.Set;

/**
 * Status of a ticket (matches Figma flow).
 * Separate from DialogStatus for feature flag isolation.
 */
public enum TicketStatus {
    ACTIVE,
    TECH_REQUIRED,
    ON_HOLD,
    RESOLVED,
    ARCHIVED;

    public boolean canTransitionTo(TicketStatus target) {
        return getAllowedTransitions().contains(target);
    }

    private Set<TicketStatus> getAllowedTransitions() {
        return switch (this) {
            case ACTIVE -> Set.of(TECH_REQUIRED, ON_HOLD, RESOLVED);
            case TECH_REQUIRED -> Set.of(ACTIVE, ON_HOLD, RESOLVED);
            case ON_HOLD -> Set.of(ACTIVE, TECH_REQUIRED, RESOLVED);
            case RESOLVED -> Set.of(ACTIVE, ARCHIVED);
            case ARCHIVED -> Set.of(RESOLVED);
        };
    }
}
