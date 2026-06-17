package com.openframe.api.dto.rmm;

import lombok.Builder;
import lombok.Data;

/**
 * Result of a fire-and-forget RMM dispatch over core NATS — running a command,
 * cancelling an in-flight execution, or running a saved script. Carries the
 * server-minted {@code executionId} the dashboard uses to correlate the agent's
 * asynchronous result.
 *
 * <p>Shared by all dispatch mutations ({@code runCommand}, {@code cancelExecution},
 * {@code runScript}): they are structurally identical, so a single type avoids
 * three duplicate one-field DTOs.
 */
@Data
@Builder
public class DispatchResponse {

    private String executionId;
}
