package com.openframe.api.dto.script;

import lombok.Builder;
import lombok.Data;

/**
 * Result of dispatching a script: the server-minted {@code executionId} used to
 * correlate the agent's asynchronous result.
 */
@Data
@Builder
public class ScriptDispatchResponse {

    private String executionId;
}
