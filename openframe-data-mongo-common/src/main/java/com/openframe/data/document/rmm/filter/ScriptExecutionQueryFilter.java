package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.rmm.ScriptExecutionStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Data-layer filter criteria for {@code ScriptExecution} queries. Mirrors the
 * API-layer {@code ScriptExecutionFilterInput} but lives here so the repository
 * stays dependency-free of the API module. The service maps between the two.
 *
 * <p>Mirrors the {@code ScriptQueryFilter} pattern.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptExecutionQueryFilter {

    /** Match executions whose {@code status} is ANY of these. {@code null}/empty = no status constraint. */
    private List<ScriptExecutionStatus> statuses;

    /** Match executions whose {@code initiatedBy} (initiator user id) is ANY of these. {@code null}/empty = no constraint. */
    private List<String> initiatedByIds;
}
