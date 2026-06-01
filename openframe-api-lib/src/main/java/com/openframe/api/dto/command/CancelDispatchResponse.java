package com.openframe.api.dto.command;

import lombok.Builder;
import lombok.Data;

/**
 * Response returned to the dashboard immediately after a cancel request is
 * dispatched. Echoes the {@code executionId} so the client can correlate any
 * follow-up agent response on the same id.
 */
@Data
@Builder
public class CancelDispatchResponse {

    /** The {@code executionId} that was asked to be cancelled. */
    private String executionId;
}
