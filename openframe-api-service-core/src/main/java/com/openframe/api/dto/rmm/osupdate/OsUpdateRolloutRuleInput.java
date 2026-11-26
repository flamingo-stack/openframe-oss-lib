package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateRolloutRuleInput {
    private OsUpdateUrgency urgency;
    private OsUpdateRolloutMode mode;
    private Integer daysAfterRelease;
    private Integer daysLaterToEveryone;
}
