package com.openframe.api.dto.execution;

import com.openframe.data.document.rmm.ScriptExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * API-layer filter for the Script Execution History list. Mirrors
 * {@code ScriptFilterInput}; the service maps it to the data-layer
 * {@code ScriptExecutionQueryFilter}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptExecutionFilterInput {

    private List<ScriptExecutionStatus> statuses;
}
