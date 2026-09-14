package com.openframe.test.data.dto.timetracking;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for {@code createTimeEntry}: a MANUAL entry for {@code userId} (Relay global id) starting
 * at {@code startedAt} and lasting {@code durationSeconds} (must be positive); {@code endedAt} is
 * derived. Requires a ticket or notes.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateTimeEntryInput {
    private String userId;
    private String ticketId;
    private String organizationId;
    private String notes;
    private String startedAt;
    private Long durationSeconds;
}
