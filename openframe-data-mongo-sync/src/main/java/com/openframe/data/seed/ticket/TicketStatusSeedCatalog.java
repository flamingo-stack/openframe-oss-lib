package com.openframe.data.seed.ticket;

import com.github.pravin.raha.lexorank4j.LexoRank;
import com.openframe.data.document.ticket.TicketStatusDefinition;

import java.util.List;

import static com.openframe.data.document.ticket.TicketStatusKind.AI_ASSISTANCE;
import static com.openframe.data.document.ticket.TicketStatusKind.ARCHIVED;
import static com.openframe.data.document.ticket.TicketStatusKind.CUSTOM;
import static com.openframe.data.document.ticket.TicketStatusKind.RESOLVED;
import static com.openframe.data.document.ticket.TicketStatusKind.TECH_REQUIRED;

public final class TicketStatusSeedCatalog {

    public static final String NAME_AI_ASSISTANCE = "AI Assistance";
    public static final String NAME_TECH_REQUIRED = "Tech Required";
    public static final String NAME_RESOLVED = "Resolved";
    public static final String NAME_ARCHIVED = "Archived";
    public static final String NAME_ON_HOLD = "On Hold";

    public static final String COLOR_AI_ASSISTANCE = "#B39DDB";
    public static final String COLOR_TECH_REQUIRED = "#E1B32F";
    public static final String COLOR_RESOLVED = "#5EA62E";
    public static final String COLOR_ARCHIVED = "#B0B0B0";
    public static final String COLOR_ON_HOLD_DEFAULT = "#F0C674";

    private TicketStatusSeedCatalog() {
    }

    public static List<TicketStatusDefinition> systemStatuses() {
        LexoRank middle = LexoRank.middle();
        LexoRank techRank = middle.genPrev();
        LexoRank aiRank = techRank.genPrev();
        LexoRank resolvedRank = middle.genNext();
        LexoRank archivedRank = resolvedRank.genNext();
        return List.of(
                TicketStatusDefinition.builder()
                        .kind(AI_ASSISTANCE)
                        .name(NAME_AI_ASSISTANCE)
                        .color(COLOR_AI_ASSISTANCE)
                        .position(aiRank.format())
                        .build(),
                TicketStatusDefinition.builder()
                        .kind(TECH_REQUIRED)
                        .name(NAME_TECH_REQUIRED)
                        .color(COLOR_TECH_REQUIRED)
                        .position(techRank.format())
                        .build(),
                TicketStatusDefinition.builder()
                        .kind(RESOLVED)
                        .name(NAME_RESOLVED)
                        .color(COLOR_RESOLVED)
                        .position(resolvedRank.format())
                        .build(),
                TicketStatusDefinition.builder()
                        .kind(ARCHIVED)
                        .name(NAME_ARCHIVED)
                        .color(COLOR_ARCHIVED)
                        .position(archivedRank.format())
                        .build()
        );
    }

    public static TicketStatusDefinition onHoldCustom() {
        return TicketStatusDefinition.builder()
                .kind(CUSTOM)
                .name(NAME_ON_HOLD)
                .color(COLOR_ON_HOLD_DEFAULT)
                .position(LexoRank.middle().format())
                .build();
    }
}
