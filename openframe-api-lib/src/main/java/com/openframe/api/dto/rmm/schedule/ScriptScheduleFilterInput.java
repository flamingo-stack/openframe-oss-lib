package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScriptScheduleFilterInput {

    private List<ScriptStatus> statuses;

    private List<ScriptPlatform> supportedPlatforms;

    private List<String> authorIds;
}
