package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.ScriptStatus;
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

    private Instant startAtFrom;
    private Instant startAtTo;
}
