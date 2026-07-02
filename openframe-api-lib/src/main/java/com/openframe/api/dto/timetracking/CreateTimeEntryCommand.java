package com.openframe.api.dto.timetracking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTimeEntryCommand {
    private String userId;
    private String ticketId;
    private String organizationId;
    private String notes;
    private Instant startedAt;
    private long durationSeconds;
}
