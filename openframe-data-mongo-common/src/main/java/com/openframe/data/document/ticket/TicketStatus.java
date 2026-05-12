package com.openframe.data.document.ticket;

import java.util.Set;

// TODO(lifecycle-rollout): remove legacy enum after openframe.features.tickets.lifecycle.enabled is permanently on
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
            case RESOLVED -> Set.of(ACTIVE, ARCHIVED);
            case ARCHIVED -> Set.of(RESOLVED);
        };
    }

    public static TicketStatus fromKind(TicketStatusKind kind) {
        return switch (kind) {
            case AI_ASSISTANCE -> ACTIVE;
            case TECH_REQUIRED -> TECH_REQUIRED;
            case RESOLVED -> RESOLVED;
            case ARCHIVED -> ARCHIVED;
            case CUSTOM -> ON_HOLD;
        };
    }

    public TicketStatusKind toKind() {
        return switch (this) {
            case ACTIVE -> TicketStatusKind.AI_ASSISTANCE;
            case TECH_REQUIRED -> TicketStatusKind.TECH_REQUIRED;
            case ON_HOLD -> TicketStatusKind.CUSTOM;
            case RESOLVED -> TicketStatusKind.RESOLVED;
            case ARCHIVED -> TicketStatusKind.ARCHIVED;
        };
    }
}
