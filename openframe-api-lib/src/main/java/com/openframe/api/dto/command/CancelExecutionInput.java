package com.openframe.api.dto.command;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * GraphQL input for cancelling an in-flight execution on a target agent.
 *
 * <p>Best-effort — by the time the cancel arrives the agent may have already
 * finished. The dashboard correlates the agent's final response (which may
 * be {@code error: "canceled"} or a normal terminal frame, depending on
 * timing) via the supplied {@link #executionId}.
 */
@Data
public class CancelExecutionInput {

    /** Target agent's machineId — same value used at dispatch time. */
    @NotBlank
    private String machineId;

    /** The {@code executionId} returned from the original {@code runCommand} (or other dispatch). */
    @NotBlank
    private String executionId;
}
