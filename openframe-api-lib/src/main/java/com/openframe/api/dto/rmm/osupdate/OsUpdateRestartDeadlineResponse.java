package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OsUpdateRestartDeadlineResponse {
    private OsUpdateUrgency urgency;
    private Integer focusDays;
    private Integer softDays;
    private Integer hardDays;
}
