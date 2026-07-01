package com.openframe.api.dto.timetracking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Update command. Null fields mean "leave unchanged"; empty string on ticketId/notes/organizationId clears them.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTimeEntryCommand {
    private String id;
    private String ticketId;
    private String organizationId;
    private String notes;
    private Instant startedAt;
    private Long durationSeconds;
}
