package com.openframe.data.document.ticket;

public enum TicketStatusKind {
    AI_ASSISTANCE,
    TECH_REQUIRED,
    RESOLVED,
    ARCHIVED,
    CUSTOM;

    public boolean isSystem() {
        return this != CUSTOM;
    }
}
