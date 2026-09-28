package com.openframe.test.data.dto.timetracking;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Partial update for {@code updateTimeEntry}: an omitted field keeps the stored value, a blank
 * {@code notes}/{@code ticketId} clears it; {@code endedAt} is recomputed when {@code startedAt} or
 * {@code durationSeconds} changes. Rejected on a running timer.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateTimeEntryInput {
    private String id;
    private String userId;
    private String ticketId;
    private String organizationId;
    private String notes;
    private String startedAt;
    private Long durationSeconds;
}
