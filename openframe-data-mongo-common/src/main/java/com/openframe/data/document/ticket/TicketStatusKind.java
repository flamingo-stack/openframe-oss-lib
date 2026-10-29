package com.openframe.data.document.ticket;

import java.util.EnumSet;
import java.util.List;

public enum TicketStatusKind {
    AI_ASSISTANCE,
    TECH_REQUIRED,
    RESOLVED,
    ARCHIVED,
    CUSTOM;

    public static final List<TicketStatusKind> NON_ARCHIVED_KINDS =
            List.copyOf(EnumSet.complementOf(EnumSet.of(ARCHIVED)));

    public boolean isSystem() {
        return this != CUSTOM;
    }
}
