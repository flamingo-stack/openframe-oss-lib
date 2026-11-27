package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OsUpdateRolloutRuleResponse {
    private OsUpdateUrgency urgency;
    private OsUpdateRolloutMode mode;
    private Integer daysAfterRelease;
    private Integer daysLaterToEveryone;
}
