package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TicketFilterInput {
    /**
     * Status-definition ids — the lifecycle column a ticket sits in.
     *
     * <p>The legacy {@code statuses} enum axis was removed from {@code TicketFilterInput} by the
     * lifecycle rollout (saas-tenant #2933, 2026-09-22); the schema's own note reads "drop legacy
     * `statuses` after rollout; `statusIds` replaces it". Sending it now fails the whole query with
     * {@code ValidationError: field name 'statuses' is not defined for input object type
     * 'TicketFilterInput'}, which is what took out seven ticket cases in the e2e run of 2026-09-23.
     *
     * <p>There is no "active" column to ask for: {@code TicketStatusKind} is AI_ASSISTANCE,
     * TECH_REQUIRED, RESOLVED, ARCHIVED, CUSTOM. Archiving transitions a ticket into the ARCHIVED
     * column, so filtering by a column id already excludes archived records, and a case that needs a
     * ticket it may act on selects on the kind client-side with
     * {@link com.openframe.test.data.generator.TicketGenerator#firstTicketWithStatusKindNotIn}.
     */
    private List<String> statusIds;
}
