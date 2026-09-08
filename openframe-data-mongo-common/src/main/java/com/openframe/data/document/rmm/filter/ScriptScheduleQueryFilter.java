package com.openframe.data.document.rmm.filter;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.ScriptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

// Data-layer filter mirroring the API-layer ScriptScheduleFilterInput, kept here to avoid a repository dependency on the API module.
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

    private Instant startAtFrom;
    private Instant startAtTo;
}
