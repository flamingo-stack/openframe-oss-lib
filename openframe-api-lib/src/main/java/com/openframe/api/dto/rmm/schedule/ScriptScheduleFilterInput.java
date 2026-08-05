package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScriptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptScheduleFilterInput {

    private List<ScriptStatus> statuses;

    private List<OsType> supportedPlatforms;

    private List<String> authorIds;

    private Instant createdAtFrom;
    private Instant createdAtTo;

    private Instant updatedAtFrom;
    private Instant updatedAtTo;
}
