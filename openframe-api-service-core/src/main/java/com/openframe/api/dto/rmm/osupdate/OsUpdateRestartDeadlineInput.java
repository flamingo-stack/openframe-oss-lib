package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateRestartDeadlineInput {
    private OsUpdateUrgency urgency;
    private Integer focusDays;
    private Integer softDays;
    private Integer hardDays;
}
