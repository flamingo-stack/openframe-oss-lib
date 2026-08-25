package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Published by the agent on {@code machine.{machineId}.execution.acknowledge} the moment it accepts a
 * dispatched script and starts running it. Flips the leaf {@code ScriptExecution} from {@code QUEUED}
 * to {@code RUNNING} and confirms delivery, so the client stops retrying that (executionId, machineId).
 *
 * <p>{@code scheduleId} is present for schedule-triggered runs and null for others.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptExecutionAcknowledgeMessage {

    private String executionId;
    private String machineId;
    private String scriptId;
    private String scheduleId;
}
