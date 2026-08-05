package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScriptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Data-layer filter criteria for {@code ScriptSchedule} queries. Mirrors the
 * API-layer {@code ScriptScheduleFilterInput} but lives here so the repository
 * stays dependency-free of the API module. The service layer maps between the
 * two.
 *
 * <p>Mirrors {@code ScriptQueryFilter} (minus shell/tag facets, which schedules
 * do not have).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptScheduleQueryFilter {

    private List<ScriptStatus> statuses;
    private List<OsType> supportedPlatforms;

    /**
     * Match schedules whose {@code createdBy} (author user id) is ANY of these.
     * {@code null} = no author constraint.
     */
    private List<String> createdByIds;

    private Instant createdAtFrom;
    private Instant createdAtTo;

    private Instant updatedAtFrom;
    private Instant updatedAtTo;
}
