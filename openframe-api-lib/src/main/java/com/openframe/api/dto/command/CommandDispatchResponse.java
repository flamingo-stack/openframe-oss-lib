package com.openframe.api.dto.command;

import lombok.Builder;
import lombok.Data;

/**
 * Response returned to the dashboard immediately after a command is dispatched.
 *
 * <p>The dashboard uses {@link #executionId} to correlate the asynchronous
 * agent response (delivered via WebSocket fan-out from the execution-service)
 * with the originating UI request.
 */
@Data
@Builder
public class CommandDispatchResponse {

    /** Server-generated correlation id. Will appear in the agent's response. */
    private String executionId;
}
