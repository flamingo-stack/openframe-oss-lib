package com.openframe.api.dto.rmm.schedulerun;

import com.openframe.data.document.rmm.script.ExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Row on the "Schedule Runs" tab — one dispatch (fire) of the schedule. Zips the
 * {@code ScheduleScriptExecution} header with the runtime-computed responded-devices
 * count (numerator of the "X / Y" progress ratio).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleRunResponse {

    /** Mongo {@code _id} — used to mint the Relay global id in the resolver. */
    private String id;

    private String executionId;
    private String scheduleId;
    private String initiatedBy;
    private ExecutionStatus status;
    private int totalMachineCount;
    private int respondedMachineCount;
    private Instant dispatchedAt;
    private Instant finishedAt;
}
