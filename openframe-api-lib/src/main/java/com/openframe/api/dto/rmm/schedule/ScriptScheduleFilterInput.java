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

    /** Match schedules whose {@code status} is in this set. Default excludes DELETED when null/empty. */
    private List<ScriptStatus> statuses;

    /** Match schedules whose {@code supportedPlatforms} contains ANY of these platforms. */
    private List<ScriptPlatform> supportedPlatforms;

    /** Match schedules created by ANY of these users — raw {@code createdBy} ids (not Relay-encoded). */
    private List<String> authorIds;
}
